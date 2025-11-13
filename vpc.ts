import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface VpcResourcesArgs {}

export class VpcResources extends pulumi.ComponentResource {
    public readonly vpc: aws.ec2.Vpc;
    public readonly publicSubnets: aws.ec2.Subnet[];
    public readonly sshSecurityGroup: aws.ec2.SecurityGroup;

    constructor(name: string, args: VpcResourcesArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:VpcResources", name, {}, opts);

        // Create a VPC
        this.vpc = new aws.ec2.Vpc("vpc", {
            cidrBlock: "10.0.0.0/16",
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: {
                Name: "ServerVPC",
            },
        }, { parent: this });

        // Get available AZs
        const availableAzs = aws.getAvailabilityZones({
            state: "available",
        });

        // Create public subnets in 2 AZs
        this.publicSubnets = [];
        for (let i = 0; i < 2; i++) {
            const subnet = new aws.ec2.Subnet(`public-subnet-${i}`, {
                vpcId: this.vpc.id,
                cidrBlock: `10.0.${i}.0/24`,
                availabilityZone: availableAzs.then(azs => azs.names[i]),
                mapPublicIpOnLaunch: true,
                tags: {
                    Name: `ServerPublic-${i}`,
                },
            }, { parent: this });
            this.publicSubnets.push(subnet);
        }

        // Create an Internet Gateway
        const igw = new aws.ec2.InternetGateway("igw", {
            vpcId: this.vpc.id,
            tags: {
                Name: "ServerIGW",
            },
        }, { parent: this });

        // Create a route table for public subnets
        const publicRouteTable = new aws.ec2.RouteTable("public-rt", {
            vpcId: this.vpc.id,
            routes: [
                {
                    cidrBlock: "0.0.0.0/0",
                    gatewayId: igw.id,
                },
            ],
            tags: {
                Name: "PublicRouteTable",
            },
        }, { parent: this });

        // Associate route table with public subnets
        this.publicSubnets.forEach((subnet, i) => {
            new aws.ec2.RouteTableAssociation(`public-rta-${i}`, {
                subnetId: subnet.id,
                routeTableId: publicRouteTable.id,
            }, { parent: this });
        });

        // Create a security group for SSH
        this.sshSecurityGroup = new aws.ec2.SecurityGroup("ssh-sg", {
            vpcId: this.vpc.id,
            description: "Security Group for SSH",
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 22,
                    toPort: 22,
                    cidrBlocks: ["0.0.0.0/0"],
                    description: "Allow SSH inbound traffic",
                },
            ],
            egress: [
                {
                    protocol: "-1",
                    fromPort: 0,
                    toPort: 0,
                    cidrBlocks: ["0.0.0.0/0"],
                    description: "Allow all outbound traffic",
                },
            ],
            tags: {
                Name: "SSHSecurityGroup",
            },
        }, { parent: this });

        this.registerOutputs({
            vpcId: this.vpc.id,
            publicSubnetIds: pulumi.all(this.publicSubnets.map(s => s.id)),
            sshSecurityGroupId: this.sshSecurityGroup.id,
        });
    }
}
