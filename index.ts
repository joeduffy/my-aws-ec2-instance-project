import * as pulumi from "@pulumi/pulumi";
import { VpcResources } from "./vpc";
import { ServerRole } from "./iam";
import { AssetBucket } from "./assets";
import { ServerResources } from "./server";

// Get configuration
const config = new pulumi.Config();
const logLevel = config.get("logLevel") || "INFO";
const sshPubKey = config.requireSecret("sshPubKey");
const cpuType = config.get("cpuType") || "ARM64";
const instanceSize = config.get("instanceSize") || "LARGE";

// Validate configuration
const validCpuTypes = ["ARM64", "X86"];
if (!validCpuTypes.includes(cpuType)) {
    throw new Error(`Invalid CPU type. Valid CPU Types are ${validCpuTypes.join(", ")}`);
}

const validInstanceSizes = ["LARGE", "XLARGE", "XLARGE2", "XLARGE4"];
if (!validInstanceSizes.includes(instanceSize.toUpperCase())) {
    throw new Error(`Invalid instance size. Valid sizes are: ${validInstanceSizes.join(", ")}`);
}

// Create VPC and Security Group
const vpcResources = new VpcResources("vpc-resources", {});

// Create IAM role for EC2 instance
const serverRole = new ServerRole("server-role", {});

// Create Asset Bucket and deploy assets
const assetBucket = new AssetBucket("asset-bucket", {
    role: serverRole.role,
});

// Create EC2 Instance
const serverResources = new ServerResources("server-resources", {
    vpc: vpcResources.vpc,
    publicSubnets: vpcResources.publicSubnets,
    sshSecurityGroup: vpcResources.sshSecurityGroup,
    instanceProfile: serverRole.instanceProfile,
    assetBucketName: assetBucket.bucketName,
    logLevel: logLevel,
    sshPubKey: sshPubKey,
    cpuType: cpuType,
    instanceSize: instanceSize,
});

// Export outputs
export const instanceId = serverResources.instance.id;
export const publicIp = serverResources.instance.publicIp;
export const publicDns = serverResources.instance.publicDns;

// SSM Command to start a session
export const ssmCommand = pulumi.interpolate`aws ssm start-session --target ${serverResources.instance.id}`;

// SSH Command to connect to the EC2 Instance
export const sshCommand = pulumi.interpolate`ssh ec2-user@${serverResources.instance.publicDns}`;
