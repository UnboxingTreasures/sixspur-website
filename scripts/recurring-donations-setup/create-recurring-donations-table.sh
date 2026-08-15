#!/bin/bash
set -e

REGION="us-east-1"
PROFILE="sixspur"
TABLE_NAME="recurring_donations"

if aws dynamodb describe-table --table-name "$TABLE_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Table $TABLE_NAME already exists, skipping creation."
  exit 0
fi

echo "Creating table $TABLE_NAME with GSI donorId-index..."
aws dynamodb create-table \
  --table-name "$TABLE_NAME" \
  --attribute-definitions \
      AttributeName=subscriptionId,AttributeType=S \
      AttributeName=donorId,AttributeType=S \
  --key-schema AttributeName=subscriptionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --global-secondary-indexes '[
    {
      "IndexName": "donorId-index",
      "KeySchema": [{"AttributeName":"donorId","KeyType":"HASH"}],
      "Projection": {"ProjectionType":"ALL"}
    }
  ]' \
  --profile "$PROFILE" --region "$REGION"

echo "Waiting for table to become active..."
aws dynamodb wait table-exists --table-name "$TABLE_NAME" --profile "$PROFILE" --region "$REGION"

echo "Done. Table $TABLE_NAME is active with GSI donorId-index."
