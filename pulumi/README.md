# EC2 Instance Pulumi Project (Migrated from CDK)

This project is a Pulumi TypeScript migration of the original CDK project. It uses the AWS Native (Cloud Control) provider for 1:1 CloudFormation resource mapping.

## Project Structure

- `index.ts` - Main entry point and configuration
- `vpc.ts` - VPC, subnets, internet gateway, route tables, and security groups
- `s3.ts` - S3 bucket for assets
- `iam.ts` - IAM role and instance profile for EC2
- `ec2.ts` - EC2 instance with user data and security groups
- `resources/` - Configuration files and assets (copied from original CDK project)

## Prerequisites

- AWS CLI configured with appropriate credentials
- Node.js 18 or later
- Pulumi CLI installed
- Access to the CloudFormation stack you want to import

## Configuration

The project supports the same configuration as the CDK version:

```bash
pulumi config set logLevel INFO
pulumi config set sshPubKey "your-ssh-public-key"
pulumi config set cpuType ARM64  # or X86
pulumi config set instanceSize LARGE  # or XLARGE, XLARGE2, XLARGE4
```

Or use environment variables (same as CDK):
- `LOG_LEVEL`
- `SSH_PUB_KEY`
- `CPU_TYPE`
- `INSTANCE_SIZE`

## Initial Setup

1. Install dependencies:
```bash
npm install
```

2. Initialize a Pulumi stack:
```bash
pulumi stack init dev
```

3. Configure AWS region:
```bash
pulumi config set aws-native:region us-west-2
```

## Importing Existing CloudFormation Stack

To import the existing CloudFormation stack resources into Pulumi:

### Option 1: Using the helper script (recommended)

```bash
./generate-import.sh EC2Example us-west-2
```

This will:
1. Query the CloudFormation stack
2. Generate an `import.json` file with all resources
3. Map CloudFormation resource types to Pulumi types

Then run:
```bash
pulumi import --file import.json
```

### Option 2: Manual import

1. List CloudFormation stack resources:
```bash
aws cloudformation list-stack-resources \
    --stack-name EC2Example \
    --region us-west-2 \
    --output json
```

2. Create `import.json` based on the template in `import.json.template`

3. Fill in the physical resource IDs from the CloudFormation output

4. Run the import:
```bash
pulumi import --file import.json
```

### Important Notes on Import

- The import process will bring existing resources under Pulumi management without recreating them
- After import, run `pulumi preview` to verify the state matches the code
- Some properties may show as "computed" or differ slightly - this is normal
- The CloudFormation stack can remain in place during the import process

## Deployment

After importing (or for new deployments):

```bash
# Preview changes
pulumi preview

# Apply changes
pulumi up
```

## Outputs

The stack exports:
- `ssmCommand` - Command to connect via AWS Systems Manager
- `sshCommand` - Command to connect via SSH
- `stackConfig` - Current configuration values

## Differences from CDK Version

1. **CloudFormation Init**: Converted to user data scripts since aws-native doesn't have direct CloudFormation Init support
2. **Asset Deployment**: Uses Pulumi's command provider to sync files to S3 instead of CDK's BucketDeployment construct
3. **Resource Naming**: Pulumi uses auto-naming by default; physical names are not set unless required
4. **AMI Resolution**: Uses SSM parameter resolution for latest Amazon Linux 2023 AMI

## Migration Notes

- All CDK constructs have been migrated to equivalent Pulumi resources
- The VPC structure (2 AZs, public subnets) is preserved
- IAM roles and policies are identical to the CDK version
- User data script includes all the same software installations and configurations
- CloudWatch agent configuration is preserved

## Troubleshooting

### Import Issues

If import fails:
1. Verify AWS credentials and permissions
2. Check that resource IDs in `import.json` are correct
3. Ensure the CloudFormation stack exists and is in a stable state
4. Review Pulumi resource names match the logical structure

### Preview Shows Changes After Import

Some differences are expected:
- Tags may be formatted differently
- Computed values (like ARNs) may show as changes
- Default values may differ between CloudFormation and Pulumi

Run `pulumi refresh` to sync the state if needed.

## Next Steps

After successful import:
1. Run `pulumi preview` to verify no unexpected changes
2. Consider migrating to AWS Classic provider for better performance (see main README)
3. Set up CI/CD integration
4. Configure Pulumi ESC for secrets management
