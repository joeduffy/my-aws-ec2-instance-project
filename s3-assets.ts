import * as pulumi from "@pulumi/pulumi";
import * as awsnative from "@pulumi/aws-native";

export interface S3AssetBucketArgs {
    publicReadAccess?: boolean;
}

export class S3AssetBucket extends pulumi.ComponentResource {
    public readonly bucket: awsnative.s3.Bucket;
    public readonly bucketName: pulumi.Output<string>;

    constructor(name: string, args?: S3AssetBucketArgs, opts?: pulumi.ComponentResourceOptions) {
        super("custom:s3:AssetBucket", name, {}, opts);

        const publicReadAccess = args?.publicReadAccess ?? false;

        // Create S3 bucket for assets
        this.bucket = new awsnative.s3.Bucket(`${name}-bucket`, {
            publicAccessBlockConfiguration: {
                blockPublicAcls: !publicReadAccess,
                blockPublicPolicy: !publicReadAccess,
                ignorePublicAcls: !publicReadAccess,
                restrictPublicBuckets: !publicReadAccess,
            },
            ownershipControls: {
                rules: [{
                    objectOwnership: "BucketOwnerPreferred",
                }],
            },
            lifecycleConfiguration: {
                rules: [{
                    id: "DeleteOldObjects",
                    status: "Enabled",
                    expirationInDays: 90,
                }],
            },
            tags: [{
                key: "Name",
                value: `${name}-asset-bucket`,
            }],
        }, { parent: this });

        this.bucketName = this.bucket.bucketName as pulumi.Output<string>;

        this.registerOutputs({
            bucketName: this.bucketName,
        });
    }
}
