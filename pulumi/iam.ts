import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";

export interface IamRoleResult {
    role: aws.iam.Role;
    instanceProfile: aws.iam.InstanceProfile;
}

export function createEc2Role(assetBucketArn: pulumi.Output<string>): IamRoleResult {
    // Create IAM role for EC2 instance
    const serverRole = new aws.iam.Role("EC2serverEc2Role", {
        roleName: "EC2Example-EC2serverEc2Role6775A3D4-rI7E0gHczLgA",
        assumeRolePolicyDocument: {
            statement: [{
                action: "sts:AssumeRole",
                effect: "Allow",
                principal: {
                    service: "ec2.amazonaws.com",
                },
            }],
            version: "2012-10-17",
        },
        description: "",
        managedPolicyArns: [
            "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
            "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
        ],
        maxSessionDuration: 3600,
        path: "/",
        policies: [
            {
                policyName: "EC2serverEc2RoleDefaultPolicy34EE5F1D",
                policyDocument: {
                    statement: [
                        {
                            action: [
                                "s3:Abort*",
                                "s3:DeleteObject*",
                                "s3:GetBucket*",
                                "s3:GetObject*",
                                "s3:List*",
                                "s3:PutObject",
                                "s3:PutObjectLegalHold",
                                "s3:PutObjectRetention",
                                "s3:PutObjectTagging",
                                "s3:PutObjectVersionTagging",
                            ],
                            effect: "Allow",
                            resource: [
                                assetBucketArn,
                                pulumi.interpolate`${assetBucketArn}/*`,
                            ],
                        },
                        {
                            action: [
                                "cloudformation:DescribeStackResource",
                                "cloudformation:SignalResource",
                            ],
                            effect: "Allow",
                            resource: "arn:aws:cloudformation:us-west-2:616138583583:stack/EC2Example/33e613f0-c638-11f0-94a0-068232599e8f",
                        },
                    ],
                    version: "2012-10-17",
                },
            },
            {
                policyName: "RetentionPolicy",
                policyDocument: {
                    statement: [{
                        action: "logs:PutRetentionPolicy",
                        effect: "Allow",
                        resource: "*",
                    }],
                    version: "2012-10-17",
                },
            },
        ],
    }, { protect: true });

    // Create instance profile
    const instanceProfile = new aws.iam.InstanceProfile("EC2serverEc2RoleInstanceProfile", {
        instanceProfileName: "EC2Example-EC2InstanceInstanceProfile2CAA3051-94GVYUhoH5Zd",
        path: "/",
        roles: [serverRole.id],
    }, { protect: true });

    return {
        role: serverRole,
        instanceProfile,
    };
}
