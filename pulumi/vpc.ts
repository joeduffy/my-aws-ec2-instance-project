import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";

export interface VpcResourcesResult {
    vpc: aws.ec2.Vpc;
    sshSecurityGroup: aws.ec2.SecurityGroup;
    publicSubnetIds: pulumi.Output<string>[];
}

export function createVpcResources(): VpcResourcesResult {
    // Create VPC
    const vpc = new aws.ec2.Vpc("VPC", {
        cidrBlock: "10.0.0.0/16",
        enableDnsHostnames: true,
        enableDnsSupport: true,
        instanceTenancy: "default",
        tags: [{ key: "Name", value: "EC2Example/VPC/VPC" }],
    }, { protect: true });

    // Create Internet Gateway
    const internetGateway = new aws.ec2.InternetGateway("VPCIGW", {
        tags: [{ key: "Name", value: "EC2Example/VPC/VPC" }],
    }, { protect: true });

    // Attach Internet Gateway to VPC
    const vpcGatewayAttachment = new aws.ec2.VpcGatewayAttachment("VPCGW", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id,
    }, { protect: true });

    // Create public subnets in 2 AZs
    const publicSubnet1 = new aws.ec2.Subnet("VPCServerPublicSubnet1", {
        vpcId: vpc.id,
        cidrBlock: "10.0.0.0/24",
        availabilityZone: "us-west-2a",
        availabilityZoneId: "usw2-az2",
        mapPublicIpOnLaunch: true,
        assignIpv6AddressOnCreation: false,
        enableDns64: false,
        ipv6Native: false,
        privateDnsNameOptionsOnLaunch: {
            enableResourceNameDnsARecord: false,
            enableResourceNameDnsAaaaRecord: false,
            hostnameType: "ip-name",
        },
        tags: [
            { key: "Name", value: "EC2Example/VPC/VPC/ServerPublicSubnet1" },
            { key: "aws-cdk:subnet-type", value: "Public" },
            { key: "aws-cdk:subnet-name", value: "ServerPublic" },
        ],
    }, { protect: true });

    const publicSubnet2 = new aws.ec2.Subnet("VPCServerPublicSubnet2", {
        vpcId: vpc.id,
        cidrBlock: "10.0.1.0/24",
        availabilityZone: "us-west-2b",
        availabilityZoneId: "usw2-az1",
        mapPublicIpOnLaunch: true,
        assignIpv6AddressOnCreation: false,
        enableDns64: false,
        ipv6Native: false,
        privateDnsNameOptionsOnLaunch: {
            enableResourceNameDnsARecord: false,
            enableResourceNameDnsAaaaRecord: false,
            hostnameType: "ip-name",
        },
        tags: [
            { key: "aws-cdk:subnet-type", value: "Public" },
            { key: "Name", value: "EC2Example/VPC/VPC/ServerPublicSubnet2" },
            { key: "aws-cdk:subnet-name", value: "ServerPublic" },
        ],
    }, { protect: true });

    // Create route table for public subnets
    const publicRouteTable = new aws.ec2.RouteTable("VPCServerPublicSubnetRouteTable", {
        vpcId: vpc.id,
        tags: [{ key: "Name", value: "EC2Example/VPC/VPC/ServerPublicSubnet1" }],
    }, { protect: true });

    // Create route to Internet Gateway
    const publicRoute = new aws.ec2.Route("VPCServerPublicSubnetDefaultRoute", {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.id,
        vpcEndpointId: internetGateway.id,
    }, { dependsOn: [vpcGatewayAttachment], protect: true });

    // Associate route table with public subnets
    const routeTableAssociation1 = new aws.ec2.SubnetRouteTableAssociation(
        "VPCServerPublicSubnet1RouteTableAssociation",
        {
            subnetId: publicSubnet1.id,
            routeTableId: publicRouteTable.id,
        },
        { protect: true }
    );

    // Note: Subnet 2 uses a different route table in the imported state
    const publicRouteTable2 = new aws.ec2.RouteTable("VPCServerPublicSubnet2RouteTable", {
        vpcId: vpc.id,
        tags: [{ key: "Name", value: "EC2Example/VPC/VPC/ServerPublicSubnet2" }],
    }, { protect: true });

    const publicRoute2 = new aws.ec2.Route("VPCServerPublicSubnet2DefaultRoute", {
        routeTableId: publicRouteTable2.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.id,
        vpcEndpointId: internetGateway.id,
    }, { dependsOn: [vpcGatewayAttachment], protect: true });

    const routeTableAssociation2 = new aws.ec2.SubnetRouteTableAssociation(
        "VPCServerPublicSubnet2RouteTableAssociation",
        {
            subnetId: publicSubnet2.id,
            routeTableId: publicRouteTable2.id,
        },
        { protect: true }
    );

    // Create SSH Security Group
    const sshSecurityGroup = new aws.ec2.SecurityGroup("VPCSSHSecurityGroup", {
        vpcId: vpc.id,
        groupName: "EC2Example-VPCSSHSecurityGroup0495A24F-tbBBR3mq7gfE",
        groupDescription: "Security Group for SSH",
        securityGroupIngress: [
            {
                ipProtocol: "tcp",
                fromPort: 22,
                toPort: 22,
                cidrIp: "0.0.0.0/0",
                description: "from 0.0.0.0/0:22",
            },
        ],
        securityGroupEgress: [
            {
                ipProtocol: "-1",
                fromPort: -1,
                toPort: -1,
                cidrIp: "0.0.0.0/0",
                description: "Allow all outbound traffic by default",
            },
        ],
    }, { protect: true });

    return {
        vpc,
        sshSecurityGroup,
        publicSubnetIds: [publicSubnet1.id, publicSubnet2.id],
    };
}
