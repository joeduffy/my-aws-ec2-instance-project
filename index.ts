import "dotenv/config";
import * as pulumi from "@pulumi/pulumi";
import { VpcResources } from "./vpc";
import { S3AssetBucket } from "./s3-assets";
import { Ec2InstanceRole } from "./iam-role";
import { ServerResources } from "./ec2-server";

// Get configuration from environment variables or Pulumi config
const config = new pulumi.Config();
const sshPubKey = process.env.SSH_PUB_KEY || config.get("sshPubKey") || " ";
const cpuType = process.env.CPU_TYPE || config.get("cpuType") || "ARM64";
const instanceSize = process.env.INSTANCE_SIZE || config.get("instanceSize") || "LARGE";

// Validate configuration
if (cpuType !== "X86" && cpuType !== "ARM64") {
    throw new Error(`Invalid CPU type: ${cpuType}. Valid types are: X86, ARM64`);
}

const validSizes = ["LARGE", "XLARGE", "XLARGE2", "XLARGE4"];
if (!validSizes.includes(instanceSize.toUpperCase())) {
    throw new Error(`Invalid instance size: ${instanceSize}. Valid sizes are: ${validSizes.join(", ")}`);
}

// Create VPC and networking resources
const vpcResources = new VpcResources("ec2-example");

// Create S3 bucket for assets
const assetBucket = new S3AssetBucket("ec2-assets", {
    publicReadAccess: false,
});

// Create IAM role for EC2 instance
const instanceRole = new Ec2InstanceRole("ec2-server", {
    assetBucketArn: assetBucket.bucket.arn,
});

// Create EC2 instance
const server = new ServerResources("ec2-server", {
    vpcId: vpcResources.vpc.id!,
    subnetId: vpcResources.subnets[0].id!,
    sshSecurityGroupId: vpcResources.sshSecurityGroup.id!,
    instanceProfileArn: instanceRole.instanceProfile.arn!,
    assetBucketName: assetBucket.bucketName,
    sshPubKey: sshPubKey,
    cpuType: cpuType,
    instanceSize: instanceSize,
});

// Export stack outputs
export const vpcId = vpcResources.vpc.id;
export const assetBucketName = assetBucket.bucketName;
export const instanceId = server.instance.instanceId;
export const publicDnsName = server.instance.publicDnsName;
export const publicIp = server.instance.publicIp;

// Export connection commands
export const ssmCommand = pulumi.interpolate`aws ssm start-session --target ${server.instance.instanceId}`;
export const sshCommand = pulumi.interpolate`ssh ec2-user@${server.instance.publicDnsName}`;

