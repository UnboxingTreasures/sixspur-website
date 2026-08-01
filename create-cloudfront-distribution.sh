#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
BUCKET="sixspurranch-assets"
BUCKET_DOMAIN="${BUCKET}.s3.${REGION}.amazonaws.com"

cat > /tmp/cloudfront-config.json << EOF
{
  "CallerReference": "sixspurranch-assets-$(date +%s)",
  "Comment": "Six Spur Ranch and Rescue - site image assets",
  "Enabled": true,
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "sixspurranch-assets-origin",
        "DomainName": "${BUCKET_DOMAIN}",
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        }
      }
    ]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "sixspurranch-assets-origin",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"]
    },
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "PriceClass": "PriceClass_100"
}
EOF

echo "Creating CloudFront distribution..."
aws cloudfront create-distribution \
  --distribution-config file:///tmp/cloudfront-config.json \
  --profile "$PROFILE" \
  --query '{Id:Distribution.Id,DomainName:Distribution.DomainName,Status:Distribution.Status}'

echo ""
echo "Done. The distribution is created but takes 5-15 minutes to fully deploy."
echo "Check status with:"
echo "  aws cloudfront get-distribution --id YOUR_DISTRIBUTION_ID --profile $PROFILE --query 'Distribution.Status'"
echo "Wait for it to show \"Deployed\" before using the domain name."
