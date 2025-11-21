import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";
import "dotenv/config";
import { createVpcResources } from "./vpc";
import { createAssetBucket } from "./s3";
import { createEc2Role } from "./iam";
import { createEc2Instance } from "./ec2";

// Get configuration values
const config = new pulumi.Config();
const logLevel = config.get("logLevel") || process.env.LOG_LEVEL || "INFO";
const sshPubKey = config.get("sshPubKey") || process.env.SSH_PUB_KEY || " ";
const cpuType = config.get("cpuType") || process.env.CPU_TYPE || "ARM64";
const instanceSize = config.get("instanceSize") || process.env.INSTANCE_SIZE || "LARGE";

// Validate configuration
function validateConfig() {
    const validCpuTypes = ["X86", "ARM64"];
    if (!validCpuTypes.includes(cpuType)) {
        throw new Error(`Invalid CPU type. Valid CPU Types are ${validCpuTypes.join(", ")}`);
    }

    const validSizes = ["LARGE", "XLARGE", "XLARGE2", "XLARGE4"];
    if (!validSizes.includes(instanceSize)) {
        throw new Error(`Invalid instance size. Valid sizes are: ${validSizes.join(", ")}`);
    }
}

validateConfig();

// Create VPC and Security Group
const vpcResources = createVpcResources();

// Create S3 bucket for assets
const assetBucket = createAssetBucket();

// Create IAM role and instance profile
const iamResources = createEc2Role(assetBucket.bucket.arn!);

// Create EC2 instance
const ec2Resources = createEc2Instance({
    vpc: vpcResources.vpc,
    sshSecurityGroup: vpcResources.sshSecurityGroup,
    subnetIds: vpcResources.publicSubnetIds,
    instanceProfile: iamResources.instanceProfile,
    assetBucketName: assetBucket.bucketName,
    logLevel,
    sshPubKey,
    cpuType,
    instanceSize,
});

// Export configuration for reference
export const stackConfig = {
    logLevel,
    cpuType,
    instanceSize,
};

// Export SSM and SSH commands
export const ssmCommand = pulumi.interpolate`aws ssm start-session --target ${ec2Resources.instance.instanceId}`;
export const sshCommand = pulumi.interpolate`ssh ec2-user@${ec2Resources.instance.publicDnsName}`;
