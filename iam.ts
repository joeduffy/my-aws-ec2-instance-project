import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface ServerRoleArgs {}

export class ServerRole extends pulumi.ComponentResource {
    public readonly role: aws.iam.Role;
    public readonly instanceProfile: aws.iam.InstanceProfile;

    constructor(name: string, args: ServerRoleArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:ServerRole", name, {}, opts);

        // Create a role for the EC2 instance to assume
        this.role = new aws.iam.Role("server-role", {
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Principal: {
                            Service: "ec2.amazonaws.com",
                        },
                        Action: "sts:AssumeRole",
                    },
                ],
            }),
            tags: {
                Name: "ServerEC2Role",
            },
        }, { parent: this });

        // Attach SSM managed policy
        new aws.iam.RolePolicyAttachment("ssm-policy", {
            role: this.role.name,
            policyArn: "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
        }, { parent: this });

        // Attach CloudWatch managed policy
        new aws.iam.RolePolicyAttachment("cloudwatch-policy", {
            role: this.role.name,
            policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
        }, { parent: this });

        // Add inline policy for CloudWatch Logs retention
        new aws.iam.RolePolicy("retention-policy", {
            role: this.role.id,
            policy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["logs:PutRetentionPolicy"],
                        Resource: "*",
                    },
                ],
            }),
        }, { parent: this });

        // Create instance profile
        this.instanceProfile = new aws.iam.InstanceProfile("server-instance-profile", {
            role: this.role.name,
        }, { parent: this });

        this.registerOutputs({
            roleArn: this.role.arn,
            instanceProfileName: this.instanceProfile.name,
        });
    }
}
