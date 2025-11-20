import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";

export interface IamRoleResult {
    role: aws.iam.Role;
    instanceProfile: aws.iam.InstanceProfile;
}

export function createEc2Role(assetBucketArn: pulumi.Output<string>): IamRoleResult {
    // Create IAM role for EC2 instance
    const serverRole = new aws.iam.Role("EC2serverEc2Role", {
        assumeRolePolicyDocument: {
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Principal: {
                    Service: "ec2.amazonaws.com",
                },
                Action: "sts:AssumeRole",
            }],
        },
        managedPolicyArns: [
            "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
            "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
        ],
        policies: [{
            policyName: "RetentionPolicy",
            policyDocument: {
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Action: ["logs:PutRetentionPolicy"],
                    Resource: "*",
                }],
            },
        }, {
            policyName: "S3AssetBucketAccess",
            policyDocument: pulumi.output(assetBucketArn).apply(arn => ({
                Version: "2012-10-17",
                Statement: [{
                    Effect: "Allow",
                    Action: [
                        "s3:GetObject*",
                        "s3:GetBucket*",
                        "s3:List*",
                        "s3:DeleteObject*",
                        "s3:PutObject*",
                        "s3:Abort*",
                    ],
                    Resource: [
                        arn,
                        `${arn}/*`,
                    ],
                }],
            })),
        }],
        tags: [{ key: "Name", value: "EC2serverEc2Role" }],
    });

    // Create instance profile
    const instanceProfile = new aws.iam.InstanceProfile("EC2serverEc2RoleInstanceProfile", {
        roles: [serverRole.roleName.apply(name => name || "")],
    });

    return {
        role: serverRole,
        instanceProfile,
    };
}
