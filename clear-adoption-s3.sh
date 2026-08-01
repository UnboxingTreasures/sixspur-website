#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
PDF_BUCKET="sixspurranch-adoption-pdfs"
UPLOADS_BUCKET="sixspurranch-adoption-uploads"

for BUCKET in "$PDF_BUCKET" "$UPLOADS_BUCKET"; do
  echo "Fetching object keys in $BUCKET..."
  KEYS=$(aws s3api list-objects-v2 \
    --bucket "$BUCKET" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Contents[*].Key' --output text)

  if [ -z "$KEYS" ] || [ "$KEYS" == "None" ]; then
    echo "$BUCKET is already empty."
    continue
  fi

  echo "Deleting objects from $BUCKET..."
  for key in $KEYS; do
    aws s3api delete-object \
      --bucket "$BUCKET" \
      --key "$key" \
      --profile "$PROFILE" --region "$REGION" >/dev/null
    echo "  Deleted: $key"
  done
done

echo "Done. Both buckets are now empty."
