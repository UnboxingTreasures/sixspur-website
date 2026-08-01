#!/bin/bash
set -e

FUNCTION_NAME="sixspur-processIncomingEmail"
ROLE_NAME="sixspur-processIncomingEmail-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f processIncomingEmail.zip
zip -r processIncomingEmail.zip index.js node_modules package.json

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

  echo "Attaching policy..."
  aws iam put-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-name ProcessIncomingEmailPermissions \
    --policy-document file://execution-role-policy.json \
    --profile "$PROFILE"

  echo "Waiting for role propagation..."
  sleep 10
else
  echo "Role $ROLE_NAME already exists, skipping creation."
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://processIncomingEmail.zip \
    --profile "$PROFILE" --region "$REGION"

  echo "Waiting for code update to finish before updating configuration..."
  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  echo "Updating environment variables..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "Variables={CONTACT_MESSAGES_TABLE=contact_messages,INCOMING_MAIL_BUCKET=sixspurranch-incoming-mail,SYSTEM_SENDER_ADDRESSES=noreply@sixspurranch.org}" \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://processIncomingEmail.zip \
    --timeout 30 \
    --memory-size 256 \
    --environment "Variables={CONTACT_MESSAGES_TABLE=contact_messages,INCOMING_MAIL_BUCKET=sixspurranch-incoming-mail,SYSTEM_SENDER_ADDRESSES=noreply@sixspurranch.org}" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
