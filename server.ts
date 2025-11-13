import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from "fs";

export interface ServerResourcesArgs {
    vpc: aws.ec2.Vpc;
    publicSubnets: aws.ec2.Subnet[];
    sshSecurityGroup: aws.ec2.SecurityGroup;
    instanceProfile: aws.iam.InstanceProfile;
    assetBucketName: pulumi.Output<string>;
    logLevel: string;
    sshPubKey: pulumi.Output<string>;
    cpuType: string;
    instanceSize: string;
}

export class ServerResources extends pulumi.ComponentResource {
    public readonly instance: aws.ec2.Instance;

    constructor(name: string, args: ServerResourcesArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:ServerResources", name, {}, opts);

        // Determine CPU type and instance type
        let cpuType: "arm64" | "x86_64";
        let instanceType: string;

        if (args.cpuType === "ARM64") {
            cpuType = "arm64";
            // M7g instances for ARM64
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
            cpuType = "x86_64";
            // M5 instances for x86_64
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

        // Get the latest Amazon Linux 2023 AMI
        const ami = aws.ec2.getAmi({
            mostRecent: true,
            owners: ["amazon"],
            filters: [
                {
                    name: "name",
                    values: ["al2023-ami-*"],
                },
                {
                    name: "architecture",
                    values: [cpuType],
                },
                {
                    name: "virtualization-type",
                    values: ["hvm"],
                },
            ],
        });

        // Create a security group for the EC2 instance
        const ec2SecurityGroup = new aws.ec2.SecurityGroup("ec2-sg", {
            vpcId: args.vpc.id,
            description: "Security Group for EC2 Instance",
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
                Name: "EC2InstanceSecurityGroup",
            },
        }, { parent: this });

        // Read CloudWatch agent config
        const cloudwatchConfig = fs.readFileSync(
            "./lib/resources/server/config/amazon-cloudwatch-agent.json",
            "utf8"
        );

        // Read config script
        const configScript = fs.readFileSync(
            "./lib/resources/server/config/config.sh",
            "utf8"
        );

        // Create user data script
        const userData = pulumi.all([args.assetBucketName, args.sshPubKey]).apply(
            ([bucketName, sshKey]) => {
                const stackId = pulumi.getStack();
                
                return `#!/bin/bash -xe
# Update system
yum update -y

# Install required packages
curl -sL https://dl.yarnpkg.com/rpm/yarn.repo | sudo tee /etc/yum.repos.d/yarn.repo
curl -sL https://rpm.nodesource.com/setup_18.x | sudo -E bash -
yum install -y amazon-cloudwatch-agent nodejs python3-pip zip unzip docker yarn

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker

# Create sample directory and download assets from S3
mkdir -p /home/ec2-user/sample
aws s3 cp s3://${bucketName}/sample /home/ec2-user/sample --recursive

# Create config.json file
cat > /etc/config.json <<'EOF'
{
  "STACK_ID": "${stackId}"
}
EOF

# Write CloudWatch agent config
cat > /tmp/amazon-cloudwatch-agent.json <<'EOF'
${cloudwatchConfig}
EOF

# Write config script
cat > /etc/config.sh <<'EOF'
${configScript}
EOF

# Add SSH public key
mkdir -p /home/ec2-user/.ssh
echo "${sshKey}" >> /home/ec2-user/.ssh/authorized_keys
chmod 700 /home/ec2-user/.ssh
chmod 600 /home/ec2-user/.ssh/authorized_keys
chown -R ec2-user:ec2-user /home/ec2-user/.ssh

# Execute config script
chmod +x /etc/config.sh
/etc/config.sh

# Signal completion
echo "User data script completed successfully"
`;
            }
        );

        // Create the EC2 instance
        this.instance = new aws.ec2.Instance("ec2-instance", {
            instanceType: instanceType,
            ami: ami.then(a => a.id),
            subnetId: args.publicSubnets[0].id,
            vpcSecurityGroupIds: [ec2SecurityGroup.id, args.sshSecurityGroup.id],
            iamInstanceProfile: args.instanceProfile.name,
            userData: userData,
            tags: {
                Name: "EC2Example",
            },
        }, { parent: this });

        this.registerOutputs({
            instanceId: this.instance.id,
            publicIp: this.instance.publicIp,
            publicDns: this.instance.publicDns,
        });
    }
}
