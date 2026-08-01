#!/bin/bash
set -e

FUNCTION_NAME="sixspur-adminInbox"
ROLE_NAME="sixspur-adminInbox-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f adminInbox.zip
zip -r adminInbox.zip index.js dynamo.js ses.js node_modules package.json

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

echo "Applying current execution role policy (safe to re-run — overwrites, doesn't duplicate)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name AdminInboxPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
ENV_VARS="Variables={CONTACT_MESSAGES_TABLE=contact_messages,SES_ADMIN_ADDRESS=richard@sixspurranch.org,ADOPTION_PDF_BUCKET=sixspurranch-adoption-pdfs}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://adminInbox.zip \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  echo "Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://adminInbox.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
