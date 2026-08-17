#!/bin/bash
set -e

FUNCTION_NAME="sixspur-adminOrders"
REGION="us-east-1"
PROFILE="sixspur"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f adminOrders.zip
zip -r adminOrders.zip index.js dynamo.js adminAuth.js email.js paypal.js node_modules package.json

# This Lambda already exists and predates this project's deploy.sh
# convention -- rather than guess at its execution role's name (which
# might not follow the "<function>-execution-role" pattern used
# elsewhere), fetch it directly from the function's current config.
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Role' --output text)
ROLE_NAME=$(basename "$ROLE_ARN")

echo "Using existing execution role: $ROLE_NAME"

echo "Applying current execution role policy (safe to re-run)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name AdminOrdersPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

echo "Updating function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://adminOrders.zip \
  --profile "$PROFILE" --region "$REGION"

aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --profile "$PROFILE" --region "$REGION"

echo "Done. Function: $FUNCTION_NAME"
