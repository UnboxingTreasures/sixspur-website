#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
PDF_BUCKET="sixspurranch-adoption-pdfs"
UPLOADS_BUCKET="sixspurranch-adoption-uploads"

for BUCKET in "$PDF_BUCKET" "$UPLOADS_BUCKET"; do
  if aws s3api head-bucket --bucket "$BUCKET" --profile "$PROFILE" 2>/dev/null; then
    echo "Bucket $BUCKET already exists, skipping creation."
  else
    echo "Creating bucket $BUCKET..."
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --profile "$PROFILE"
  fi

  echo "Blocking public access on $BUCKET (these contain applicant PII)..."
  aws s3api put-public-access-block \
    --bucket "$BUCKET" \
    --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true \
    --profile "$PROFILE"
done

echo "Enabling CORS on $UPLOADS_BUCKET so browsers can PUT fence photos directly..."
cat > /tmp/uploads-cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["PUT"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}
EOF

aws s3api put-bucket-cors \
  --bucket "$UPLOADS_BUCKET" \
  --cors-configuration file:///tmp/uploads-cors.json \
  --profile "$PROFILE"

echo "Done. Both buckets created, private, and CORS configured."
