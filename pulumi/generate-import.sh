#!/bin/bash
# Script to generate import.json from CloudFormation stack resources
# Usage: ./generate-import.sh <stack-name> <region>

STACK_NAME=${1:-EC2Example}
REGION=${2:-us-west-2}

echo "Fetching CloudFormation stack resources for $STACK_NAME in $REGION..."

# Get stack resources
RESOURCES=$(aws cloudformation list-stack-resources \
    --stack-name "$STACK_NAME" \
    --region "$REGION" \
    --output json)

if [ $? -ne 0 ]; then
    echo "Error: Failed to list stack resources. Please check your AWS credentials and permissions."
    exit 1
fi

# Create import.json
cat > import.json << 'EOF'
{
    "resources": [
EOF

# Parse resources and create import entries
echo "$RESOURCES" | jq -r '.StackResourceSummaries[] | 
    @json' | while read -r resource; do
    
    LOGICAL_ID=$(echo "$resource" | jq -r '.LogicalResourceId')
    PHYSICAL_ID=$(echo "$resource" | jq -r '.PhysicalResourceId')
    RESOURCE_TYPE=$(echo "$resource" | jq -r '.ResourceType')
    
    # Map CloudFormation resource types to Pulumi aws-native types
    case "$RESOURCE_TYPE" in
        "AWS::EC2::VPC")
            PULUMI_TYPE="aws-native:ec2:Vpc"
            ;;
        "AWS::EC2::InternetGateway")
            PULUMI_TYPE="aws-native:ec2:InternetGateway"
            ;;
        "AWS::EC2::VPCGatewayAttachment")
            PULUMI_TYPE="aws-native:ec2:VpcGatewayAttachment"
            ;;
        "AWS::EC2::Subnet")
            PULUMI_TYPE="aws-native:ec2:Subnet"
            ;;
        "AWS::EC2::RouteTable")
            PULUMI_TYPE="aws-native:ec2:RouteTable"
            ;;
        "AWS::EC2::Route")
            PULUMI_TYPE="aws-native:ec2:Route"
            ;;
        "AWS::EC2::SubnetRouteTableAssociation")
            PULUMI_TYPE="aws-native:ec2:SubnetRouteTableAssociation"
            ;;
        "AWS::EC2::SecurityGroup")
            PULUMI_TYPE="aws-native:ec2:SecurityGroup"
            ;;
        "AWS::EC2::Instance")
            PULUMI_TYPE="aws-native:ec2:Instance"
            ;;
        "AWS::S3::Bucket")
            PULUMI_TYPE="aws-native:s3:Bucket"
            ;;
        "AWS::IAM::Role")
            PULUMI_TYPE="aws-native:iam:Role"
            ;;
        "AWS::IAM::InstanceProfile")
            PULUMI_TYPE="aws-native:iam:InstanceProfile"
            ;;
        "AWS::Lambda::Function"|"Custom::CDKBucketDeployment")
            # Skip CDK custom resources and Lambda functions used for deployment
            continue
            ;;
        *)
            echo "Warning: Unknown resource type $RESOURCE_TYPE for $LOGICAL_ID" >&2
            continue
            ;;
    esac
    
    # Map logical IDs to Pulumi resource names
    case "$LOGICAL_ID" in
        *VPC*IGW*)
            PULUMI_NAME="VPCIGW"
            ;;
        *VPC*GW*)
            PULUMI_NAME="VPCGW"
            ;;
        *VPC*ServerPublicSubnet1RouteTableAssociation*)
            PULUMI_NAME="VPCServerPublicSubnet1RouteTableAssociation"
            ;;
        *VPC*ServerPublicSubnet2RouteTableAssociation*)
            PULUMI_NAME="VPCServerPublicSubnet2RouteTableAssociation"
            ;;
        *VPC*ServerPublicSubnet1*)
            PULUMI_NAME="VPCServerPublicSubnet1"
            ;;
        *VPC*ServerPublicSubnet2*)
            PULUMI_NAME="VPCServerPublicSubnet2"
            ;;
        *VPC*ServerPublicSubnetRouteTable*)
            PULUMI_NAME="VPCServerPublicSubnetRouteTable"
            ;;
        *VPC*ServerPublicSubnetDefaultRoute*)
            PULUMI_NAME="VPCServerPublicSubnetDefaultRoute"
            ;;
        *VPC*SSHSecurityGroup*)
            PULUMI_NAME="VPCSSHSecurityGroup"
            ;;
        *VPC*)
            PULUMI_NAME="VPC"
            ;;
        *assetBucket*)
            PULUMI_NAME="EC2assetBucket"
            ;;
        *serverEc2RoleInstanceProfile*)
            PULUMI_NAME="EC2serverEc2RoleInstanceProfile"
            ;;
        *serverEc2Role*)
            PULUMI_NAME="EC2serverEc2Role"
            ;;
        *ec2InstanceSecurityGroup*)
            PULUMI_NAME="EC2ec2InstanceSecurityGroup"
            ;;
        *Instance*)
            PULUMI_NAME="EC2Instance"
            ;;
        *)
            PULUMI_NAME="$LOGICAL_ID"
            ;;
    esac
    
    cat >> import.json << ENTRY
        {
            "type": "$PULUMI_TYPE",
            "name": "$PULUMI_NAME",
            "id": "$PHYSICAL_ID"
        },
ENTRY
done

# Remove trailing comma and close JSON
sed -i '$ s/,$//' import.json
cat >> import.json << 'EOF'
    ]
}
EOF

echo "Generated import.json successfully!"
echo "Review the file and adjust resource names if needed, then run:"
echo "  pulumi import --file import.json"
