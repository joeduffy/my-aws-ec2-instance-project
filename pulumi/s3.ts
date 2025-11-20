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
        publicAccessBlockConfiguration: {
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
        },
        ownershipControls: {
            rules: [{
                objectOwnership: "BucketOwnerPreferred",
            }],
        },
        tags: [{ key: "Name", value: "EC2assetBucket" }],
    });

    // Note: Asset deployment will be handled separately
    // The CDK BucketDeployment construct uses a Lambda function to deploy assets
    // In Pulumi, we can use the command provider to sync files after the bucket is created
    // or handle this as a manual step during the import process
    
    // Create a local command to sync assets to S3 after bucket creation
    const assetSync = new command.local.Command("assetBucketDeployment", {
        create: pulumi.interpolate`aws s3 sync ${path.join(__dirname, "resources/server/assets")} s3://${assetBucket.id}/ --exclude "**/node_modules/**" --exclude "**/dist/**"`,
        // Only run if the bucket exists
    }, { dependsOn: [assetBucket] });

    return {
        bucket: assetBucket,
        bucketName: assetBucket.id,
    };
}
