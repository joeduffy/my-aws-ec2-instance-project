# CDK to Pulumi Migration Guide

This document describes the migration from AWS CDK to Pulumi using the AWS Native (Cloud Control) provider.

## Migration Summary

The CDK project has been successfully migrated to Pulumi TypeScript using the AWS Native provider. All infrastructure resources have been converted to their Pulumi equivalents.

## Resources Migrated

### VPC and Networking (`vpc.ts`)
- **VPC** with DNS support enabled
- **Internet Gateway** attached to VPC
- **Public Subnets** across 2 availability zones with auto-assign public IP
- **Route Table** with route to Internet Gateway
- **SSH Security Group** allowing inbound SSH (port 22) from anywhere

### S3 Assets (`s3-assets.ts`)
- **S3 Bucket** for storing EC2 instance assets
- Configured with:
  - Public access blocked
  - Bucket owner preferred ownership
  - 90-day lifecycle policy for object expiration

### IAM Role (`iam-role.ts`)
- **IAM Role** for EC2 instance with:
  - Trust policy for EC2 service
  - Managed policies: `AmazonSSMManagedInstanceCore`, `CloudWatchAgentServerPolicy`
  - Inline policies for CloudWatch Logs retention and S3 bucket access
- **Instance Profile** for attaching the role to EC2

### EC2 Instance (`ec2-server.ts`)
- **Security Group** for EC2 instance (allows all outbound)
- **EC2 Instance** with:
  - Configurable instance type (ARM64/x86_64, various sizes)
  - Amazon Linux 2023 AMI
  - User data script for initialization
  - CloudWatch agent configuration
  - SSH key configuration

### Stack Outputs (`index.ts`)
- VPC ID
- Asset bucket name
- Instance ID, public DNS name, and public IP
- SSM connection command
- SSH connection command

## AWS Native Provider Limitations Encountered

### 1. **S3 BucketDeployment Not Available**
**CDK Feature:** `BucketDeployment` construct automatically uploads local files to S3 during deployment.

**Pulumi Workaround:** 
- Created S3 bucket structure
- Files must be uploaded manually or via CI/CD pipeline
- User data script downloads files from S3 at instance launch

**Note:** You'll need to manually upload files from `lib/resources/server/assets/` to the S3 bucket after deployment.

### 2. **CloudFormation Init Not Supported**
**CDK Feature:** `CloudFormationInit` provides declarative instance configuration with automatic cfn-signal handling.

**Pulumi Workaround:**
- Converted CloudFormation Init configurations to user data bash scripts
- Embedded configuration files directly in user data
- Manual script execution instead of cfn-init

### 3. **AMI Lookup Functions Not Available**
**CDK Feature:** `MachineImage.latestAmazonLinux2023()` automatically finds the latest AMI.

**Pulumi Workaround:**
- Hardcoded default AMI IDs for us-east-1 region
- Can be overridden via Pulumi config: `pulumi config set amiId <ami-id>`
- AMI IDs need to be updated manually for other regions

**Default AMIs (us-east-1):**
- ARM64: `ami-0c2644c99d3a96f1e`
- x86_64: `ami-0c101f26f147fa7fd`

## Configuration

The project supports configuration via environment variables or Pulumi config:

| Variable | Pulumi Config | Description | Default |
|----------|---------------|-------------|---------|
| `SSH_PUB_KEY` | `sshPubKey` | SSH public key for instance access | ` ` (empty) |
| `CPU_TYPE` | `cpuType` | CPU architecture (`ARM64` or `X86`) | `ARM64` |
| `INSTANCE_SIZE` | `instanceSize` | Instance size (`LARGE`, `XLARGE`, `XLARGE2`, `XLARGE4`) | `LARGE` |
| N/A | `amiId` | Override default AMI ID | Region-specific default |

### Setting Configuration

```bash
# Via Pulumi config
pulumi config set sshPubKey "ssh-rsa AAAA..."
pulumi config set cpuType ARM64
pulumi config set instanceSize LARGE
pulumi config set amiId ami-xxxxx

# Via environment variables
export SSH_PUB_KEY="ssh-rsa AAAA..."
export CPU_TYPE=ARM64
export INSTANCE_SIZE=LARGE
```

## Deployment Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Initialize Pulumi stack:**
   ```bash
   pulumi stack init dev
   pulumi config set aws-native:region us-east-1
   ```

3. **Configure the stack:**
   ```bash
   pulumi config set sshPubKey "$(cat ~/.ssh/id_rsa.pub)"
   ```

4. **Preview changes:**
   ```bash
   pulumi preview
   ```

5. **Deploy infrastructure:**
   ```bash
   pulumi up
   ```

6. **Upload assets to S3 (manual step):**
   ```bash
   BUCKET_NAME=$(pulumi stack output assetBucketName)
   aws s3 cp lib/resources/server/assets/ s3://$BUCKET_NAME/ --recursive
   ```

7. **Connect to instance:**
   ```bash
   # Via SSM
   pulumi stack output ssmCommand | bash
   
   # Via SSH
   pulumi stack output sshCommand | bash
   ```

## File Structure

```
.
├── index.ts              # Main stack definition
├── vpc.ts                # VPC and networking resources
├── s3-assets.ts          # S3 bucket for assets
├── iam-role.ts           # IAM role and instance profile
├── ec2-server.ts         # EC2 instance and security group
├── lib/
│   └── resources/
│       └── server/
│           ├── assets/   # Files to upload to S3
│           └── config/   # Configuration files
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
└── Pulumi.yaml           # Pulumi project file
```

## Differences from CDK

1. **Resource Naming:** Pulumi auto-names resources by default (recommended). CDK often requires explicit names.

2. **State Management:** Pulumi uses its own state backend (Pulumi Cloud by default). CDK uses CloudFormation stacks.

3. **Outputs:** Pulumi outputs are strongly typed and can be used in other stacks. CDK uses CloudFormation outputs.

4. **Asset Deployment:** CDK's BucketDeployment is not available in AWS Native provider. Manual upload required.

5. **Instance Initialization:** CloudFormation Init converted to user data scripts.

## Next Steps: State Import

Once the code migration is complete and validated, you can import existing CDK-managed resources into Pulumi state. This will be covered in a separate guide after you provide the import details.

## Known Issues

1. **Region-Specific AMIs:** Default AMI IDs are for us-east-1. Update for other regions.
2. **Manual Asset Upload:** S3 assets must be uploaded manually after bucket creation.
3. **User Data Size:** Large configuration files in user data may hit size limits (16KB). Consider using S3 for large files.

## Testing

Run validation before deployment:

```bash
# TypeScript compilation
npm run build

# Linting
npm run lint

# Preview infrastructure changes
pulumi preview
```
