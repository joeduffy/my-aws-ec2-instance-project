import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";

export interface S3AssetBucketResult {
    bucket: aws.s3.Bucket;
    bucketName: pulumi.Output<string>;
}

export function createAssetBucket(): S3AssetBucketResult {
    // Create S3 bucket for assets
    const assetBucket = new aws.s3.Bucket("EC2assetBucket", {
        bucketName: "ec2example-ec2assetbucketc584b4ab-hnvvvneadyho",
        bucketEncryption: {
            serverSideEncryptionConfiguration: [{
                bucketKeyEnabled: false,
                serverSideEncryptionByDefault: {
                    sseAlgorithm: aws.s3.BucketServerSideEncryptionByDefaultSseAlgorithm.Aes256,
                },
            }],
        },
        ownershipControls: {
            rules: [{
                objectOwnership: aws.s3.BucketOwnershipControlsRuleObjectOwnership.BucketOwnerPreferred,
            }],
        },
        publicAccessBlockConfiguration: {
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        },
        tags: [
            { key: "aws-cdk:cr-owned:2e37783d", value: "true" },
            { key: "aws-cdk:auto-delete-objects", value: "true" },
        ],
    }, { protect: true });

    // Note: Asset deployment is handled by CloudFormation custom resources
    // We don't recreate the Lambda-based deployment in Pulumi

    return {
        bucket: assetBucket,
        bucketName: assetBucket.id,
    };
}
