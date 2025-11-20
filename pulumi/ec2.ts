import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";
import * as fs from "fs";
import * as path from "path";

export interface Ec2InstanceProps {
    vpc: aws.ec2.Vpc;
    sshSecurityGroup: aws.ec2.SecurityGroup;
    subnetIds: pulumi.Output<string>[];
    instanceProfile: aws.iam.InstanceProfile;
    assetBucketName: pulumi.Output<string>;
    logLevel: string;
    sshPubKey: string;
    cpuType: string;
    instanceSize: string;
}

export interface Ec2InstanceResult {
    instance: aws.ec2.Instance;
    instanceSecurityGroup: aws.ec2.SecurityGroup;
}

export function createEc2Instance(props: Ec2InstanceProps): Ec2InstanceResult {
    // Determine instance type based on CPU type and size
    let instanceType: string;
    if (props.cpuType === "ARM64") {
        switch (props.instanceSize) {
            case "LARGE":
                instanceType = "m7g.large";
                break;
            case "XLARGE":
                instanceType = "m7g.xlarge";
                break;
            case "XLARGE2":
                instanceType = "m7g.2xlarge";
                break;
            case "XLARGE4":
                instanceType = "m7g.4xlarge";
                break;
            default:
                instanceType = "m7g.large";
        }
    } else {
        switch (props.instanceSize) {
            case "LARGE":
                instanceType = "m5.large";
                break;
            case "XLARGE":
                instanceType = "m5.xlarge";
                break;
            case "XLARGE2":
                instanceType = "m5.2xlarge";
                break;
            case "XLARGE4":
                instanceType = "m5.4xlarge";
                break;
            default:
                instanceType = "m5.large";
        }
    }

    // Create security group for EC2 instance
    const ec2InstanceSecurityGroup = new aws.ec2.SecurityGroup("EC2ec2InstanceSecurityGroup", {
        vpcId: props.vpc.id,
        groupDescription: "Security Group for EC2 instance",
        securityGroupEgress: [
            {
                ipProtocol: "-1",
                cidrIp: "0.0.0.0/0",
                description: "Allow all outbound traffic",
            },
        ],
        tags: [{ key: "Name", value: "EC2ec2InstanceSecurityGroup" }],
    });

    // Read CloudWatch agent config
    const cloudwatchAgentConfig = fs.readFileSync(
        path.join(__dirname, "resources/server/config/amazon-cloudwatch-agent.json"),
        "utf8"
    );

    const configScript = fs.readFileSync(
        path.join(__dirname, "resources/server/config/config.sh"),
        "utf8"
    );

    // Build user data script
    const userData = pulumi.all([props.assetBucketName]).apply(([bucketName]) => {
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

# Create sample directory and download assets from S3
mkdir -p /home/ec2-user/sample
aws s3 cp s3://${bucketName}/sample /home/ec2-user/sample --recursive

# Write CloudWatch agent config
cat > /tmp/amazon-cloudwatch-agent.json << 'CWEOF'
${cloudwatchAgentConfig}
CWEOF

# Write config script
cat > /etc/config.sh << 'CONFIGEOF'
${configScript}
CONFIGEOF

# Write SSH public key
mkdir -p /home/ec2-user/.ssh
echo "${props.sshPubKey}" >> /home/ec2-user/.ssh/authorized_keys
chown -R ec2-user:ec2-user /home/ec2-user/.ssh
chmod 700 /home/ec2-user/.ssh
chmod 600 /home/ec2-user/.ssh/authorized_keys

# Write config.json
cat > /etc/config.json << 'JSONEOF'
{
  "STACK_ID": "EC2Example"
}
JSONEOF

# Execute config script
chmod +x /etc/config.sh
/etc/config.sh
`;
        return Buffer.from(script).toString("base64");
    });

    // Get the latest Amazon Linux 2023 AMI
    // Note: AMI ID will be determined during import based on existing instance
    const amiId = props.cpuType === "ARM64" 
        ? "resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
        : "resolve:ssm:/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64";

    // Create EC2 instance
    const instance = new aws.ec2.Instance("EC2Instance", {
        instanceType: instanceType,
        imageId: amiId,
        subnetId: props.subnetIds[0],
        iamInstanceProfile: pulumi.output(props.instanceProfile.instanceProfileName).apply(name => name || ""),
        securityGroupIds: [
            ec2InstanceSecurityGroup.id,
            props.sshSecurityGroup.id,
        ],
        userData: userData,
        tags: [{ key: "Name", value: "EC2Instance" }],
    });

    return {
        instance,
        instanceSecurityGroup: ec2InstanceSecurityGroup,
    };
}
