import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws-native";
import * as command from "@pulumi/command";
import * as path from "path";

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

    // Deploy assets to S3 for semantic compatibility with CDK
    // CDK uses a Lambda-based deployment, but Pulumi can use a local command
    // This ensures assets are synced whenever they change
    const assetSync = new command.local.Command("assetBucketDeployment", {
        create: pulumi.interpolate`aws s3 sync ${path.join(__dirname, "resources/server/assets")} s3://${assetBucket.id}/ --exclude "**/node_modules/**" --exclude "**/dist/**"`,
        update: pulumi.interpolate`aws s3 sync ${path.join(__dirname, "resources/server/assets")} s3://${assetBucket.id}/ --exclude "**/node_modules/**" --exclude "**/dist/**" --delete`,
        delete: pulumi.interpolate`aws s3 rm s3://${assetBucket.id}/sample --recursive`,
    }, { dependsOn: [assetBucket] });

    return {
        bucket: assetBucket,
        bucketName: assetBucket.id,
    };
}
