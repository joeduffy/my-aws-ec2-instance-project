import * as pulumi from "@pulumi/pulumi";
import * as awsnative from "@pulumi/aws-native";

export interface Ec2InstanceRoleArgs {
    assetBucketArn: pulumi.Input<string>;
}

export class Ec2InstanceRole extends pulumi.ComponentResource {
    public readonly role: awsnative.iam.Role;
    public readonly instanceProfile: awsnative.iam.InstanceProfile;

    constructor(name: string, args: Ec2InstanceRoleArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:iam:Ec2InstanceRole", name, {}, opts);

        // Get current partition for ARN construction
        const partition = "aws";

        // Create IAM role for EC2 instance
        this.role = new awsnative.iam.Role(`${name}-role`, {
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
                `arn:${partition}:iam::aws:policy/AmazonSSMManagedInstanceCore`,
                `arn:${partition}:iam::aws:policy/CloudWatchAgentServerPolicy`,
            ],
            policies: [
                {
                    policyName: "RetentionPolicy",
                    policyDocument: {
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: ["logs:PutRetentionPolicy"],
                            Resource: ["*"],
                        }],
                    },
                },
                {
                    policyName: "S3AssetBucketAccess",
                    policyDocument: pulumi.output(args.assetBucketArn).apply(bucketArn => ({
                        Version: "2012-10-17",
                        Statement: [{
                            Effect: "Allow",
                            Action: [
                                "s3:GetObject",
                                "s3:GetObjectVersion",
                                "s3:ListBucket",
                                "s3:PutObject",
                                "s3:PutObjectAcl",
                            ],
                            Resource: [
                                bucketArn,
                                `${bucketArn}/*`,
                            ],
                        }],
                    })),
                },
            ],
            tags: [{
                key: "Name",
                value: `${name}-ec2-role`,
            }],
        }, { parent: this });

        // Create instance profile
        this.instanceProfile = new awsnative.iam.InstanceProfile(`${name}-instance-profile`, {
            roles: [this.role.roleName as pulumi.Output<string>],
        }, { parent: this });

        this.registerOutputs({
            roleArn: this.role.arn,
            instanceProfileArn: this.instanceProfile.arn,
        });
    }
}
