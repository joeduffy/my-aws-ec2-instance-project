import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface AssetBucketArgs {
    role: aws.iam.Role;
}

export class AssetBucket extends pulumi.ComponentResource {
    public readonly bucket: aws.s3.Bucket;
    public readonly bucketName: pulumi.Output<string>;

    constructor(name: string, args: AssetBucketArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:ec2:AssetBucket", name, {}, opts);

        // Create an Asset Bucket for the Instance
        this.bucket = new aws.s3.Bucket("asset-bucket", {
            forceDestroy: true,
            tags: {
                Name: "EC2AssetBucket",
            },
        }, { parent: this });

        // Block public access
        new aws.s3.BucketPublicAccessBlock("asset-bucket-pab", {
            bucket: this.bucket.id,
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        }, { parent: this });

        // Deploy the local assets to the Asset Bucket
        const assetPath = "./lib/resources/server/assets";
        
        // Upload sample directory contents
        new aws.s3.BucketObjectv2("sample-file", {
            bucket: this.bucket.id,
            key: "sample/sample.txt",
            source: new pulumi.asset.FileAsset(`${assetPath}/sample/sample.txt`),
        }, { parent: this });

        // Grant the EC2 role access to the bucket
        new aws.iam.RolePolicy("asset-bucket-policy", {
            role: args.role.id,
            policy: pulumi.all([this.bucket.arn]).apply(([bucketArn]) => JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: [
                            "s3:GetObject",
                            "s3:ListBucket",
                            "s3:PutObject",
                        ],
                        Resource: [
                            bucketArn,
                            `${bucketArn}/*`,
                        ],
                    },
                ],
            })),
        }, { parent: this });

        this.bucketName = this.bucket.id;

        this.registerOutputs({
            bucketName: this.bucketName,
        });
    }
}
