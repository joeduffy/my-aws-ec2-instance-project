# CDK to Pulumi Migration Guide

This document describes the migration of the EC2 Instance CDK project to Pulumi using the AWS Native (Cloud Control) provider.

## Overview

The migration converts all CDK TypeScript constructs to equivalent Pulumi TypeScript resources using the `@pulumi/aws-native` provider, which provides 1:1 mapping with CloudFormation resources.

## Migration Summary

### What Was Migrated

✅ **VPC Infrastructure**
- VPC with DNS support
- 2 public subnets across 2 availability zones
- Internet Gateway and VPC Gateway Attachment
- Route table with default route to Internet Gateway
- Route table associations for both subnets
- SSH Security Group (port 22 ingress)

✅ **S3 Assets**
- S3 bucket for asset storage
- Asset deployment mechanism (using Pulumi command provider)
- Bucket policies and ownership controls

✅ **IAM Resources**
- EC2 instance role with assume role policy
- Managed policies: AmazonSSMManagedInstanceCore, CloudWatchAgentServerPolicy
- Inline policies: CloudWatch Logs retention, S3 bucket access
- Instance profile

✅ **EC2 Instance**
- Configurable instance type (M7G for ARM64, M5 for X86_64)
- Configurable instance size (large, xlarge, 2xlarge, 4xlarge)
- Amazon Linux 2023 AMI (latest via SSM parameter)
- User data script with software installation
- Security group for instance
- CloudWatch agent configuration
- SSH key configuration

✅ **Stack Outputs**
- SSM session command
- SSH connection command
- Configuration values

### Key Differences from CDK

1. **CloudFormation Init → User Data**
   - CDK's CloudFormation Init features converted to bash scripts in user data
   - All file creation, command execution preserved
   - CloudWatch agent configuration embedded in user data

2. **BucketDeployment → Command Provider**
   - CDK's BucketDeployment (Lambda-based) replaced with Pulumi command provider
   - Uses AWS CLI to sync assets to S3
   - Runs after bucket creation

3. **Resource Naming**
   - Pulumi uses auto-naming by default (prevents name collisions)
   - Physical names not set unless required for external references
   - Logical names match CDK structure for easier import

4. **AMI Selection**
   - Uses SSM parameter resolution for latest Amazon Linux 2023
   - Automatically selects ARM64 or X86_64 based on configuration

## File Structure

```
pulumi/
├── index.ts                 # Main entry point, configuration
├── vpc.ts                   # VPC and networking resources
├── s3.ts                    # S3 bucket for assets
├── iam.ts                   # IAM role and instance profile
├── ec2.ts                   # EC2 instance and security group
├── resources/               # Config files and assets (from CDK)
│   └── server/
│       ├── assets/
│       └── config/
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript configuration
├── Pulumi.yaml              # Pulumi project file
├── Pulumi.dev.yaml          # Stack configuration
├── import.json.template     # Template for import file
├── generate-import.sh       # Helper script to generate import.json
└── README.md                # Project documentation
```

## Configuration Mapping

| CDK Environment Variable | Pulumi Config | Default |
|-------------------------|---------------|---------|
| `LOG_LEVEL` | `logLevel` | `INFO` |
| `SSH_PUB_KEY` | `sshPubKey` | ` ` (empty) |
| `CPU_TYPE` | `cpuType` | `ARM64` |
| `INSTANCE_SIZE` | `instanceSize` | `LARGE` |

Set Pulumi config:
```bash
pulumi config set logLevel INFO
pulumi config set sshPubKey "your-ssh-public-key"
pulumi config set cpuType ARM64
pulumi config set instanceSize LARGE
```

Or continue using environment variables (both work).

## Import Process

### Step 1: Generate Import File

Run the helper script to query CloudFormation and generate import.json:

```bash
cd pulumi
./generate-import.sh EC2Example us-west-2
```

This creates `import.json` with all resource mappings.

### Step 2: Review Import File

Check `import.json` to ensure:
- All resources are mapped correctly
- Physical IDs are accurate
- Resource names match the Pulumi code

### Step 3: Run Import

```bash
pulumi import --file import.json
```

This will:
- Import all resources into Pulumi state
- Not modify any actual infrastructure
- Allow Pulumi to manage the resources going forward

### Step 4: Verify State

```bash
pulumi preview
```

Should show no changes (or only minor differences in tags/computed values).

## Resource Type Mappings

| CloudFormation Type | Pulumi Type |
|-------------------|-------------|
| `AWS::EC2::VPC` | `aws-native:ec2:Vpc` |
| `AWS::EC2::InternetGateway` | `aws-native:ec2:InternetGateway` |
| `AWS::EC2::VPCGatewayAttachment` | `aws-native:ec2:VpcGatewayAttachment` |
| `AWS::EC2::Subnet` | `aws-native:ec2:Subnet` |
| `AWS::EC2::RouteTable` | `aws-native:ec2:RouteTable` |
| `AWS::EC2::Route` | `aws-native:ec2:Route` |
| `AWS::EC2::SubnetRouteTableAssociation` | `aws-native:ec2:SubnetRouteTableAssociation` |
| `AWS::EC2::SecurityGroup` | `aws-native:ec2:SecurityGroup` |
| `AWS::EC2::Instance` | `aws-native:ec2:Instance` |
| `AWS::S3::Bucket` | `aws-native:s3:Bucket` |
| `AWS::IAM::Role` | `aws-native:iam:Role` |
| `AWS::IAM::InstanceProfile` | `aws-native:iam:InstanceProfile` |

## Known Limitations

### AWS Native Provider Limitations

The AWS Native (Cloud Control) provider has some limitations:

1. **CloudFormation Init**: Not directly supported
   - **Workaround**: Converted to user data scripts

2. **Some Resource Properties**: May not be available
   - **Impact**: Minimal for this project
   - **Workaround**: Use AWS Classic provider (see below)

3. **Performance**: Slightly slower than AWS Classic
   - **Impact**: Longer preview/up times
   - **Workaround**: Migrate to AWS Classic after import

## Post-Import Steps

### 1. Verify Deployment

```bash
pulumi preview
pulumi up  # If preview looks good
```

### 2. Test Connectivity

Use the exported commands:
```bash
# Get outputs
pulumi stack output ssmCommand
pulumi stack output sshCommand

# Connect via SSM
aws ssm start-session --target <instance-id>

# Connect via SSH
ssh ec2-user@<public-dns>
```

### 3. Verify CloudWatch Logs

Check that logs are being sent to CloudWatch:
```bash
aws logs describe-log-groups --log-group-name-prefix /ec2/log/ec2-example/
```

## Migrating to AWS Classic Provider (Optional)

After successful import, you may want to migrate to the AWS Classic provider for better performance and features.

**Benefits:**
- Faster preview/up operations
- More mature and feature-complete
- Better error messages
- More community support

**Process:**
1. Create a new branch
2. Replace `@pulumi/aws-native` with `@pulumi/aws`
3. Update resource types (e.g., `aws-native:ec2:Vpc` → `aws:ec2:Vpc`)
4. Adjust property names (some differ between providers)
5. Test thoroughly with `pulumi preview`
6. Use `pulumi state` commands to migrate resources

**Note**: This is a more advanced operation and should be done carefully. The current aws-native implementation is fully functional.

## Troubleshooting

### Import Fails

**Problem**: `pulumi import` fails with "resource not found"

**Solution**:
- Verify physical resource IDs in import.json
- Check AWS credentials and region
- Ensure CloudFormation stack exists

### Preview Shows Unexpected Changes

**Problem**: After import, `pulumi preview` shows changes

**Solution**:
- Some differences are normal (tags, computed values)
- Run `pulumi refresh` to sync state
- Review changes carefully before applying

### User Data Not Executing

**Problem**: EC2 instance starts but user data doesn't run

**Solution**:
- Check `/var/log/cloud-init-output.log` on the instance
- Verify S3 bucket permissions
- Check IAM role has necessary permissions

### Asset Sync Fails

**Problem**: Command provider fails to sync assets to S3

**Solution**:
- Ensure AWS CLI is configured
- Check S3 bucket exists and is accessible
- Verify command provider has necessary permissions

## Rollback Plan

If you need to rollback to CDK:

1. The CloudFormation stack remains intact during import
2. Simply continue using CDK as before
3. Delete the Pulumi stack: `pulumi stack rm dev`
4. No infrastructure changes are made during import

## Next Steps

1. ✅ Complete the import process
2. ✅ Verify with `pulumi preview`
3. ✅ Test deployment with `pulumi up`
4. ✅ Verify instance connectivity
5. ✅ Set up CI/CD for Pulumi
6. ⏭️ Consider migrating to AWS Classic provider
7. ⏭️ Import additional stacks if needed

## Support

For issues or questions:
- Pulumi Documentation: https://www.pulumi.com/docs/
- AWS Native Provider: https://www.pulumi.com/registry/packages/aws-native/
- Pulumi Community Slack: https://slack.pulumi.com/
