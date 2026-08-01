#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
BUCKET="sixspurranch-assets"

if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
  echo "Bucket $BUCKET already exists."
else
  echo "Creating bucket $BUCKET..."
  aws s3api create-bucket \
    --bucket "$BUCKET" \
    --region "$REGION" \
    --profile "$PROFILE"
fi

# This bucket needs to be publicly readable (images are meant to be
# served to site visitors), unlike the private adoption PDF/photo
# buckets from earlier. Block public access is OFF here on purpose.
echo "Configuring public access block (allowing public reads)..."
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false \
  --profile "$PROFILE"

echo "Applying bucket policy for public read access..."
cat > /tmp/assets-bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${BUCKET}/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET" \
  --policy file:///tmp/assets-bucket-policy.json \
  --profile "$PROFILE"

echo "Syncing images to S3..."
aws s3 sync ~/Documents/sixspur-website/public/images/ "s3://${BUCKET}/images/" \
  --profile "$PROFILE"

echo ""
echo "Done. Verify with:"
echo "  aws s3api list-objects-v2 --bucket $BUCKET --profile $PROFILE --query 'KeyCount'"
