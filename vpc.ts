import * as pulumi from "@pulumi/pulumi";
import * as awsnative from "@pulumi/aws-native";

export interface VpcResourcesArgs {
    cidrBlock?: string;
    maxAzs?: number;
}

export class VpcResources extends pulumi.ComponentResource {
    public readonly vpc: awsnative.ec2.Vpc;
    public readonly internetGateway: awsnative.ec2.InternetGateway;
    public readonly igwAttachment: awsnative.ec2.VpcGatewayAttachment;
    public readonly subnets: awsnative.ec2.Subnet[];
    public readonly routeTable: awsnative.ec2.RouteTable;
    public readonly sshSecurityGroup: awsnative.ec2.SecurityGroup;

    constructor(name: string, args?: VpcResourcesArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:VpcResources", name, {}, opts);

        const cidrBlock = args?.cidrBlock || "10.0.0.0/16";
        const maxAzs = args?.maxAzs || 2;

        // Create VPC
        this.vpc = new awsnative.ec2.Vpc(`${name}-vpc`, {
            cidrBlock: cidrBlock,
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: [{
                key: "Name",
                value: `${name}-vpc`,
            }],
        }, { parent: this });

        // Create Internet Gateway
        this.internetGateway = new awsnative.ec2.InternetGateway(`${name}-igw`, {
            tags: [{
                key: "Name",
                value: `${name}-igw`,
            }],
        }, { parent: this });

        // Attach Internet Gateway to VPC
        this.igwAttachment = new awsnative.ec2.VpcGatewayAttachment(`${name}-igw-attachment`, {
            vpcId: this.vpc.id,
            internetGatewayId: this.internetGateway.id,
        }, { parent: this });

        // Create Route Table
        this.routeTable = new awsnative.ec2.RouteTable(`${name}-public-rt`, {
            vpcId: this.vpc.id,
            tags: [{
                key: "Name",
                value: `${name}-public-rt`,
            }],
        }, { parent: this });

        // Create route to Internet Gateway
        new awsnative.ec2.Route(`${name}-public-route`, {
            routeTableId: this.routeTable.id,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: this.internetGateway.id,
        }, { parent: this, dependsOn: [this.igwAttachment] });

        // Get available AZs and create subnets
        this.subnets = [];
        const azs = ["a", "b", "c", "d", "e", "f"];
        
        for (let i = 0; i < maxAzs; i++) {
            const subnet = new awsnative.ec2.Subnet(`${name}-public-subnet-${i}`, {
                vpcId: this.vpc.id,
                cidrBlock: `10.0.${i}.0/24`,
                availabilityZone: pulumi.interpolate`${awsnative.config.region}${azs[i]}`,
                mapPublicIpOnLaunch: true,
                tags: [{
                    key: "Name",
                    value: `${name}-ServerPublic-${i}`,
                }],
            }, { parent: this });

            // Associate subnet with route table
            new awsnative.ec2.SubnetRouteTableAssociation(`${name}-subnet-rt-assoc-${i}`, {
                subnetId: subnet.id,
                routeTableId: this.routeTable.id,
            }, { parent: this });

            this.subnets.push(subnet);
        }

        // Create SSH Security Group
        this.sshSecurityGroup = new awsnative.ec2.SecurityGroup(`${name}-ssh-sg`, {
            vpcId: this.vpc.id,
            groupDescription: "Security Group for SSH",
            securityGroupIngress: [{
                ipProtocol: "tcp",
                fromPort: 22,
                toPort: 22,
                cidrIp: "0.0.0.0/0",
                description: "Allow SSH from anywhere",
            }],
            securityGroupEgress: [{
                ipProtocol: "-1",
                cidrIp: "0.0.0.0/0",
                description: "Allow all outbound traffic",
            }],
            tags: [{
                key: "Name",
                value: `${name}-ssh-sg`,
            }],
        }, { parent: this });

        this.registerOutputs({
            vpcId: this.vpc.id,
            sshSecurityGroupId: this.sshSecurityGroup.id,
            subnetIds: this.subnets.map(s => s.id),
        });
    }
}
