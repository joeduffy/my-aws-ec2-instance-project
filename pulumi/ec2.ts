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
        groupName: "EC2Example-EC2ec2InstanceSecurityGroupD268D496-h79Gfx9xOloy",
        groupDescription: "EC2Example/EC2/ec2InstanceSecurityGroup",
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
        availabilityZone: "us-west-2a",
        blockDeviceMappings: [{
            deviceName: "/dev/xvda",
            ebs: {
                deleteOnTermination: true,
                encrypted: false,
                iops: 3000,
                snapshotId: "snap-06836f95f1942f4df",
                volumeSize: 8,
                volumeType: "gp3",
            },
        }],
        cpuOptions: {
            coreCount: 2,
            threadsPerCore: 1,
        },
        creditSpecification: {
            cpuCredits: "standard",
        },
        disableApiTermination: false,
        ebsOptimized: false,
        enclaveOptions: {
            enabled: false,
        },
        hibernationOptions: {
            configured: false,
        },
        iamInstanceProfile: pulumi.output(props.instanceProfile.id).apply(id => id || ""),
        imageId: "ami-0a9e99f8d214ea170",
        instanceInitiatedShutdownBehavior: "stop",
        instanceType: instanceType,
        monitoring: false,
        networkInterfaces: [{
            associateCarrierIpAddress: false,
            associatePublicIpAddress: true,
            deleteOnTermination: true,
            deviceIndex: "0",
            groupSet: [
                ec2InstanceSecurityGroup.id,
                props.sshSecurityGroup.id,
            ],
            ipv6AddressCount: 0,
            ipv6Addresses: [],
            networkInterfaceId: "eni-058538e68f79a6f57",
            privateIpAddress: "10.0.0.223",
            privateIpAddresses: [{
                primary: true,
                privateIpAddress: "10.0.0.223",
            }],
            secondaryPrivateIpAddressCount: 0,
            subnetId: props.subnetIds[0],
        }],
        placementGroupName: "",
        privateDnsNameOptions: {
            enableResourceNameDnsARecord: false,
            enableResourceNameDnsAaaaRecord: false,
            hostnameType: aws.ec2.InstancePrivateDnsNameOptionsHostnameType.IpName,
        },
        privateIpAddress: "10.0.0.223",
        securityGroupIds: [
            ec2InstanceSecurityGroup.id,
            props.sshSecurityGroup.id,
        ],
        securityGroups: [
            "EC2Example-EC2ec2InstanceSecurityGroupD268D496-h79Gfx9xOloy",
            "EC2Example-VPCSSHSecurityGroup0495A24F-tbBBR3mq7gfE",
        ],
        sourceDestCheck: true,
        subnetId: props.subnetIds[0],
        tags: [
            { key: "aws:cloudformation:stack-name", value: "EC2Example" },
            { key: "aws:cloudformation:logical-id", value: "EC2Instance1F00751C57ee729c1274d778" },
            { key: "Name", value: "EC2Example/EC2/Instance" },
            { key: "aws:cloudformation:stack-id", value: "arn:aws:cloudformation:us-west-2:616138583583:stack/EC2Example/33e613f0-c638-11f0-94a0-068232599e8f" },
        ],
        tenancy: "default",
        userData: "IyEvYmluL2Jhc2gKeXVtIHVwZGF0ZSAteQpjdXJsIC1zTCBodHRwczovL2RsLnlhcm5wa2cuY29tL3JwbS95YXJuLnJlcG8gfCBzdWRvIHRlZSAvZXRjL3l1bS5yZXBvcy5kL3lhcm4ucmVwbwpjdXJsIC1zTCBodHRwczovL3JwbS5ub2Rlc291cmNlLmNvbS9zZXR1cF8xOC54IHwgc3VkbyAtRSBiYXNoIC0gCnl1bSBpbnN0YWxsIC15IGFtYXpvbi1jbG91ZHdhdGNoLWFnZW50IG5vZGVqcyBweXRob24zLXBpcCB6aXAgdW56aXAgZG9ja2VyIHlhcm4Kc3VkbyBzeXN0ZW1jdGwgZW5hYmxlIGRvY2tlcgpzdWRvIHN5c3RlbWN0bCBzdGFydCBkb2NrZXIKbWtkaXIgLXAgL2hvbWUvZWMyLXVzZXIvc2FtcGxlCmF3cyBzMyBjcCBzMzovL2VjMmV4YW1wbGUtZWMyYXNzZXRidWNrZXRjNTg0YjRhYi1obnZ2dm5lYWR5aG8vc2FtcGxlIC9ob21lL2VjMi11c2VyL3NhbXBsZSAtLXJlY3Vyc2l2ZQojIGZpbmdlcnByaW50OiA1YzMzY2QxOTM4MzA1MGU1CigKICBzZXQgK2UKICAvb3B0L2F3cy9iaW4vY2ZuLWluaXQgLXYgLS1yZWdpb24gdXMtd2VzdC0yIC0tc3RhY2sgRUMyRXhhbXBsZSAtLXJlc291cmNlIEVDMkluc3RhbmNlMUYwMDc1MUM1N2VlNzI5YzEyNzRkNzc4IC0tdXJsIGh0dHBzOi8vY2xvdWRmb3JtYXRpb24udXMtd2VzdC0yLmFtYXpvbmF3cy5jb20gLS1yb2xlIEVDMkV4YW1wbGUtRUMyc2VydmVyRWMyUm9sZTY3NzVBM0Q0LXJJN0UwZ0hjekxnQSAtYyBkZWZhdWx0CiAgL29wdC9hd3MvYmluL2Nmbi1zaWduYWwgLWUgJD8gLS1yZWdpb24gdXMtd2VzdC0yIC0tc3RhY2sgRUMyRXhhbXBsZSAtLXJlc291cmNlIEVDMkluc3RhbmNlMUYwMDc1MUM1N2VlNzI5YzEyNzRkNzc4IC0tdXJsIGh0dHBzOi8vY2xvdWRmb3JtYXRpb24udXMtd2VzdC0yLmFtYXpvbmF3cy5jb20gLS1yb2xlIEVDMkV4YW1wbGUtRUMyc2VydmVyRWMyUm9sZTY3NzVBM0Q0LXJJN0UwZ0hjekxnQQogIGNhdCAvdmFyL2xvZy9jZm4taW5pdC5sb2cgPiYyCik=",
        volumes: [{
            device: "/dev/xvda",
            volumeId: "vol-072f197b1249704e0",
        }],
    }, { protect: true });

    return {
        instance,
        instanceSecurityGroup: ec2InstanceSecurityGroup,
    };
}
