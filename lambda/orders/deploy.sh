#!/bin/bash
set -e
FUNCTION_NAME="sixspur-orders"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
# This Lambda already exists but never had a deploy.sh before tonight --
# rather than guess at its execution role's name (which might not follow
# the "<function>-execution-role" pattern used elsewhere), fetch it
# directly from the function's current config, same safe approach used
# for lambda/adminOrders/deploy.sh.
echo "Looking up existing execution role..."
ROLE_ARN=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Role' --output text)
ROLE_NAME=$(basename "$ROLE_ARN")
echo "Using existing execution role: $ROLE_NAME"
echo "Installing dependencies..."
npm install
echo "Zipping function..."
rm -f orders.zip
zip -r orders.zip index.js dynamo.js paypal.js email.js notify.js getRecipients.js node_modules package.json
echo "Applying current execution role policy (safe to re-run)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name OrdersPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"
echo "Updating function code..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file fileb://orders.zip \
  --profile "$PROFILE" --region "$REGION"
aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --profile "$PROFILE" --region "$REGION"
echo "Done. Function: $FUNCTION_NAME"
