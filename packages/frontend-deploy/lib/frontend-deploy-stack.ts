import * as cdk from "aws-cdk-lib";
import {
  Certificate,
  CertificateValidation,
} from "aws-cdk-lib/aws-certificatemanager";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
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

    const DOMAIN_NAME = "gyuri.org";

    const hostedZone = new HostedZone(this, "DomainHostedZone", {
      zoneName: DOMAIN_NAME,
    });

    const httpsCertificate = new Certificate(this, "HttpsCertificate", {
      domainName: hostedZone.zoneName,
      subjectAlternativeNames: [`*.${hostedZone.zoneName}`],
      validation: CertificateValidation.fromDns(hostedZone),
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
        domainNames: [hostedZone.zoneName, `*.${hostedZone.zoneName}`],
        certificate: httpsCertificate,
      }
    );

    const cfRedirect = new ARecord(this, "CloudFrontRedirect", {
      zone: hostedZone,
      recordName: DOMAIN_NAME,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFront)),
    });

    const cfWwwRedirect = new ARecord(this, "CloudFrontWWWRedirect", {
      zone: hostedZone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(cloudFront)),
      recordName: `www.${DOMAIN_NAME}`,
    });

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

    new cdk.CfnOutput(this, "HostedZoneName", {
      value: hostedZone.zoneName,
      description: "Hosted Zone Name",
      exportName: `${id}-HostedZoneId`,
    });

    new cdk.CfnOutput(this, "CertificateArn", {
      value: httpsCertificate.certificateArn,
      description: "Certificate ARN",
      exportName: `${id}-CertificateArn`,
    });

    new cdk.CfnOutput(this, "CloudFrontRedirectOutput", {
      value: cfRedirect.domainName,
      description: "CloudFront Redirect",
      exportName: `${id}-CloudFrontRedirectOutput`,
    });

    new cdk.CfnOutput(this, "CloudFrontWWWRedirectOutput", {
      value: cfWwwRedirect.domainName,
      description: "CloudFront WWW Redirect",
      exportName: `${id}-CloudFrontWWWRedirectOutput`,
    });
  }
}
