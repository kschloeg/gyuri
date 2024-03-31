import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { join } from "path";

export class FrontendDeployStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a bucket to store the built code
    // This bucket is public
    // It contains a website index document to serve the index.html file
    const staticSiteBucket = new cdk.aws_s3.Bucket(this, "StaticSiteBucket", {
      websiteIndexDocument: "index.html",
      blockPublicAccess: {
        blockPublicAcls: false,
        blockPublicPolicy: false,
        ignorePublicAcls: false,
        restrictPublicBuckets: false,
      },
      publicReadAccess: true,
    });

    // Deploy the built code of packages/frontend
    // to the bucket automatically on every code change
    new cdk.aws_s3_deployment.BucketDeployment(this, "DeployStaticSite", {
      sources: [
        cdk.aws_s3_deployment.Source.asset(
          join(__dirname, "../..", "frontend", "dist")
        ),
      ],
      destinationBucket: staticSiteBucket,
    });

    // Create a CloudFront distribution to serve the website
    const cloudFront = new cdk.aws_cloudfront.Distribution(
      this,
      "StaticSiteDistribution",
      {
        defaultBehavior: {
          origin: new cdk.aws_cloudfront_origins.S3Origin(staticSiteBucket),
          viewerProtocolPolicy:
            cdk.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      }
    );

    new cdk.CfnOutput(this, "StaticSite Url", {
      value: staticSiteBucket.bucketWebsiteUrl,
      description: "URL of the static site",
      exportName: `${id}-StaticSiteUrl`,
    });

    new cdk.CfnOutput(this, "FeUrl", {
      value: cloudFront.distributionDomainName,
      description: "FE URL",
      exportName: `${id}-FE-Url`,
    });
  }
}
