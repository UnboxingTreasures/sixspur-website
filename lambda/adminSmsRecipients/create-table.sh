#!/bin/bash
set -e

REGION="us-east-1"
PROFILE="sixspur"
TABLE_NAME="sms_recipients"

if aws dynamodb describe-table --table-name "$TABLE_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Table $TABLE_NAME already exists, skipping creation."
else
  echo "Creating table $TABLE_NAME..."
  aws dynamodb create-table \
    --table-name "$TABLE_NAME" \
    --attribute-definitions AttributeName=phoneNumber,AttributeType=S \
    --key-schema AttributeName=phoneNumber,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --profile "$PROFILE" --region "$REGION"

  aws dynamodb wait table-exists --table-name "$TABLE_NAME" --profile "$PROFILE" --region "$REGION"
  echo "Table created."
fi

echo "Seeding already-verified numbers (Richard, Jay) so they're picked up immediately..."
NOW=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item '{
    "phoneNumber": {"S": "+18137866333"},
    "label": {"S": "Richard McGuire"},
    "addedBy": {"S": "system-seed"},
    "addedAt": {"S": "'"$NOW"'"},
    "status": {"S": "Verified"}
  }' \
  --profile "$PROFILE" --region "$REGION"

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --item '{
    "phoneNumber": {"S": "+18137587733"},
    "label": {"S": "Jay Lefler"},
    "addedBy": {"S": "system-seed"},
    "addedAt": {"S": "'"$NOW"'"},
    "status": {"S": "Verified"}
  }' \
  --profile "$PROFILE" --region "$REGION"

echo "Done. Table $TABLE_NAME is ready with 2 seeded recipients."
