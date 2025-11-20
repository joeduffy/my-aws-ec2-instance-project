import * as pulumi from "@pulumi/pulumi";
import * as awsnative from "@pulumi/aws-native";
import * as fs from "fs";
import * as path from "path";

export interface ServerResourcesArgs {
    vpcId: pulumi.Input<string>;
    subnetId: pulumi.Input<string>;
    sshSecurityGroupId: pulumi.Input<string>;
    instanceProfileArn: pulumi.Input<string>;
    assetBucketName: pulumi.Input<string>;
    sshPubKey: string;
    cpuType: string;
    instanceSize: string;
}

export class ServerResources extends pulumi.ComponentResource {
    public readonly instance: awsnative.ec2.Instance;
    public readonly securityGroup: awsnative.ec2.SecurityGroup;

    constructor(name: string, args: ServerResourcesArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:ServerResources", name, {}, opts);

        // Determine instance type based on CPU type and size
        let instanceType: string;
        if (args.cpuType === "ARM64") {
            switch (args.instanceSize.toLowerCase()) {
                case "large":
                    instanceType = "m7g.large";
                    break;
                case "xlarge":
                    instanceType = "m7g.xlarge";
                    break;
                case "xlarge2":
                    instanceType = "m7g.2xlarge";
                    break;
                case "xlarge4":
                    instanceType = "m7g.4xlarge";
                    break;
                default:
                    instanceType = "m7g.large";
            }
        } else {
            switch (args.instanceSize.toLowerCase()) {
                case "large":
                    instanceType = "m5.large";
                    break;
                case "xlarge":
                    instanceType = "m5.xlarge";
                    break;
                case "xlarge2":
                    instanceType = "m5.2xlarge";
                    break;
                case "xlarge4":
                    instanceType = "m5.4xlarge";
                    break;
                default:
                    instanceType = "m5.large";
            }
        }

        // Create security group for EC2 instance
        this.securityGroup = new awsnative.ec2.SecurityGroup(`${name}-sg`, {
            vpcId: args.vpcId,
            groupDescription: "Security group for EC2 instance",
            securityGroupEgress: [{
                ipProtocol: "-1",
                cidrIp: "0.0.0.0/0",
                description: "Allow all outbound traffic",
            }],
            tags: [{
                key: "Name",
                value: `${name}-instance-sg`,
            }],
        }, { parent: this });

        // Read CloudWatch agent config
        const cloudwatchConfig = fs.readFileSync(
            path.join(__dirname, "lib/resources/server/config/amazon-cloudwatch-agent.json"),
            "utf8"
        );

        // Read config script
        const configScript = fs.readFileSync(
            path.join(__dirname, "lib/resources/server/config/config.sh"),
            "utf8"
        );

        // Build user data script
        // Note: AWS Native provider expects user data to be base64 encoded
        const userDataScript = pulumi.all([args.assetBucketName]).apply(([bucketName]) => {
            const script = `#!/bin/bash -xe
# Update system
yum update -y

# Install required packages
curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
curl -sL https://rpm.nodesource.com/setup_18.x | sudo -E bash -
yum install -y amazon-cloudwatch-agent nodejs python3-pip zip unzip docker yarn

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Create directories
mkdir -p /home/ec2-user/sample
mkdir -p /tmp

# Download assets from S3
aws s3 cp s3://${bucketName}/sample /home/ec2-user/sample --recursive

# Write CloudWatch agent config
cat > /tmp/amazon-cloudwatch-agent.json << 'CWEOF'
${cloudwatchConfig}
CWEOF

# Write config script
cat > /etc/config.sh << 'CONFIGEOF'
${configScript}
CONFIGEOF

# Write SSH public key
echo "${args.sshPubKey}" >> /home/ec2-user/.ssh/authorized_keys

# Make config script executable and run it
chmod +x /etc/config.sh
/etc/config.sh

# Write stack metadata
cat > /etc/config.json << 'EOF'
{
  "STACK_ID": "ec2-instance-pulumi"
}
EOF
`;
            return Buffer.from(script).toString("base64");
        });

        // Get latest Amazon Linux 2023 AMI ID from Pulumi config
        // Note: AWS Native provider doesn't have AMI lookup functions
        // You can set this via: pulumi config set amiId <ami-id>
        const config = new pulumi.Config();
        const defaultAmiId = args.cpuType === "ARM64" 
            ? "ami-0c2644c99d3a96f1e"  // Amazon Linux 2023 ARM64 in us-east-1
            : "ami-0c101f26f147fa7fd";  // Amazon Linux 2023 x86_64 in us-east-1
        const amiId = config.get("amiId") || defaultAmiId;

        // Create EC2 instance
        this.instance = new awsnative.ec2.Instance(`${name}-instance`, {
            imageId: amiId,
            instanceType: instanceType,
            iamInstanceProfile: args.instanceProfileArn,
            subnetId: args.subnetId,
            securityGroupIds: [
                this.securityGroup.id!,
                args.sshSecurityGroupId,
            ],
            userData: userDataScript,
            tags: [{
                key: "Name",
                value: `${name}-instance`,
            }],
        }, { parent: this });

        this.registerOutputs({
            instanceId: this.instance.instanceId,
            publicDnsName: this.instance.publicDnsName,
        });
    }
}
