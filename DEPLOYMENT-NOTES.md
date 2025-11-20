# Deployment Notes

## AWS Credentials Required

To run `pulumi preview` or `pulumi up`, you need AWS credentials configured. The AWS Native provider requires:

1. **AWS Account ID** - Retrieved via STS GetCallerIdentity
2. **AWS Credentials** - One of:
   - Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
   - AWS credentials file (`~/.aws/credentials`)
   - IAM role (for EC2 instances or ECS tasks)
   - AWS SSO

## Setting Up Credentials

### Option 1: Environment Variables
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
```

### Option 2: AWS CLI Configuration
```bash
aws configure
```

### Option 3: Pulumi ESC (Recommended)
Use Pulumi ESC to manage AWS credentials securely:

```bash
# Create an ESC environment with AWS credentials
pulumi env init aws-dev

# Add AWS credentials to the environment
pulumi env set aws-dev --secret AWS_ACCESS_KEY_ID your-access-key
pulumi env set aws-dev --secret AWS_SECRET_ACCESS_KEY your-secret-key

# Configure stack to use the environment
pulumi config env add aws-dev
```

## Preview Command

Once credentials are configured:

```bash
pulumi preview
```

Expected output will show:
- 1 VPC with subnets, internet gateway, route tables
- 2 Security groups (SSH and instance)
- 1 S3 bucket for assets
- 1 IAM role with instance profile
- 1 EC2 instance

## Known Preview Limitations

The preview was unable to run due to missing AWS credentials in the deployment environment. This is expected and normal. To validate the infrastructure:

1. Configure AWS credentials locally
2. Run `pulumi preview` from your local machine
3. Review the planned changes
4. Run `pulumi up` to deploy

## Code Validation Status

✅ **TypeScript Compilation:** Passed  
✅ **ESLint Linting:** Passed  
✅ **Code Structure:** Complete  
⏸️ **Pulumi Preview:** Requires AWS credentials

The code is ready for deployment once AWS credentials are configured.
