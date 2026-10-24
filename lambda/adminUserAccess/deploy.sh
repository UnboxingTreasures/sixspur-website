#!/bin/bash
set -e

FUNCTION_NAME="sixspur-adminUserAccess"
ROLE_NAME="sixspur-adminUserAccess-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f adminUserAccess.zip
zip -r adminUserAccess.zip index.js dynamo.js adminAuth.js node_modules package.json

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
  --policy-name AdminUserAccessPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://adminUserAccess.zip \
    --profile "$PROFILE" --region "$REGION" >/dev/null

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  # Fetch-merge-patch: keep every existing env var, set only DONORS_TABLE.
  # (Never overwrite the whole set -- that has wiped live values before.)
  MERGED=$(aws lambda get-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'Environment.Variables' --output json \
    | python3 -c 'import sys,json; d=json.load(sys.stdin) or {}; d["DONORS_TABLE"]="donors"; print(json.dumps({"Variables":d}))')

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$MERGED" \
    --timeout 10 \
    --memory-size 256 \
    --profile "$PROFILE" --region "$REGION" >/dev/null
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://adminUserAccess.zip \
    --timeout 10 \
    --memory-size 256 \
    --environment '{"Variables":{"DONORS_TABLE":"donors"}}' \
    --profile "$PROFILE" --region "$REGION" >/dev/null
fi

echo "Done. Function: $FUNCTION_NAME"
