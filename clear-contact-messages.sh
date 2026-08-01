#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
TABLE_NAME="contact_messages"

echo "Fetching all message IDs..."
IDS=$(aws dynamodb scan \
  --table-name "$TABLE_NAME" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Items[*].messageId.S' --output text)

if [ -z "$IDS" ]; then
  echo "Table is already empty."
  exit 0
fi

COUNT=$(echo "$IDS" | wc -w | tr -d ' ')
echo "Found $COUNT message(s). Deleting..."

for id in $IDS; do
  aws dynamodb delete-item \
    --table-name "$TABLE_NAME" \
    --key "{\"messageId\": {\"S\": \"$id\"}}" \
    --profile "$PROFILE" --region "$REGION"
  echo "  Deleted: $id"
done

echo "Done. Table cleared."
