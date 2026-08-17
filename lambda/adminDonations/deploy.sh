#!/bin/bash
set -e
FUNCTION_NAME="sixspur-adminDonations"
ROLE_NAME="sixspur-adminDonations-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
echo "Installing dependencies..."
npm install
echo "Zipping function..."
rm -f adminDonations.zip
zip -r adminDonations.zip index.js dynamo.js paypal.js email.js adminAuth.js node_modules package.json
if ! aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" >/dev/null 2>&1; then
  echo "Creating IAM role $ROLE_NAME..."
  aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --profile "$PROFILE"
  echo "Waiting for role propagation..."
  sleep 10
else
  echo "Role $ROLE_NAME already exists."
fi
echo "Applying current execution role policy (safe to re-run)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name AdminDonationsPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://adminDonations.zip \
    --profile "$PROFILE" --region "$REGION"
  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  echo "Merging env vars (preserving any set outside this script)..."
  CURRENT_ENV=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Environment.Variables' --output json)
  MERGED_ENV=$(echo "$CURRENT_ENV" | python3 -c "
import json, sys
env = json.load(sys.stdin) or {}
env['DONATIONS_TABLE'] = 'donations'
print(json.dumps({'Variables': env}))
")

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$MERGED_ENV" \
    --timeout 10 \
    --memory-size 256 \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://adminDonations.zip \
    --timeout 10 \
    --memory-size 256 \
    --environment "Variables={DONATIONS_TABLE=donations}" \
    --profile "$PROFILE" --region "$REGION"
fi
echo "Done. Function: $FUNCTION_NAME"
