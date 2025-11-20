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
        tags: [{ key: "Name", value: "VPC" }],
    });

    // Create Internet Gateway
    const internetGateway = new aws.ec2.InternetGateway("VPCIGW", {
        tags: [{ key: "Name", value: "VPCIGW" }],
    });

    // Attach Internet Gateway to VPC
    const vpcGatewayAttachment = new aws.ec2.VpcGatewayAttachment("VPCGW", {
        vpcId: vpc.id,
        internetGatewayId: internetGateway.id,
    });

    // Get current region for availability zones
    const currentRegion = pulumi.output(aws.getRegionOutput());
    
    // Create public subnets in 2 AZs
    // Note: Availability zones will be determined during import based on existing resources
    const publicSubnet1 = new aws.ec2.Subnet("VPCServerPublicSubnet1", {
        vpcId: vpc.id,
        cidrBlock: "10.0.0.0/24",
        mapPublicIpOnLaunch: true,
        tags: [{ key: "Name", value: "VPCServerPublicSubnet1" }],
    });

    const publicSubnet2 = new aws.ec2.Subnet("VPCServerPublicSubnet2", {
        vpcId: vpc.id,
        cidrBlock: "10.0.1.0/24",
        mapPublicIpOnLaunch: true,
        tags: [{ key: "Name", value: "VPCServerPublicSubnet2" }],
    });

    // Create route table for public subnets
    const publicRouteTable = new aws.ec2.RouteTable("VPCServerPublicSubnetRouteTable", {
        vpcId: vpc.id,
        tags: [{ key: "Name", value: "VPCServerPublicSubnetRouteTable" }],
    });

    // Create route to Internet Gateway
    const publicRoute = new aws.ec2.Route("VPCServerPublicSubnetDefaultRoute", {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: "0.0.0.0/0",
        gatewayId: internetGateway.id,
    }, { dependsOn: [vpcGatewayAttachment] });

    // Associate route table with public subnets
    const routeTableAssociation1 = new aws.ec2.SubnetRouteTableAssociation(
        "VPCServerPublicSubnet1RouteTableAssociation",
        {
            subnetId: publicSubnet1.id,
            routeTableId: publicRouteTable.id,
        }
    );

    const routeTableAssociation2 = new aws.ec2.SubnetRouteTableAssociation(
        "VPCServerPublicSubnet2RouteTableAssociation",
        {
            subnetId: publicSubnet2.id,
            routeTableId: publicRouteTable.id,
        }
    );

    // Create SSH Security Group
    const sshSecurityGroup = new aws.ec2.SecurityGroup("VPCSSHSecurityGroup", {
        vpcId: vpc.id,
        groupDescription: "Security Group for SSH",
        securityGroupIngress: [
            {
                ipProtocol: "tcp",
                fromPort: 22,
                toPort: 22,
                cidrIp: "0.0.0.0/0",
                description: "Allow SSH from anywhere",
            },
        ],
        securityGroupEgress: [
            {
                ipProtocol: "-1",
                cidrIp: "0.0.0.0/0",
                description: "Allow all outbound traffic",
            },
        ],
        tags: [{ key: "Name", value: "VPCSSHSecurityGroup" }],
    });

    return {
        vpc,
        sshSecurityGroup,
        publicSubnetIds: [publicSubnet1.id, publicSubnet2.id],
    };
}
