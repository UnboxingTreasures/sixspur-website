#!/bin/bash
set -e

# Deploys the contactForm Lambda function.
# Run this from inside the contactForm/ directory after `npm install`.

FUNCTION_NAME="sixspur-saveContactMessage"
ROLE_NAME="sixspur-contactForm-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f contactForm.zip
zip -r contactForm.zip index.js saveContactMessage.js sendContactEmail.js node_modules package.json

# --- Create the execution role if it doesn't already exist ---
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
    --policy-name ContactFormPermissions \
    --policy-document file://execution-role-policy.json \
    --profile "$PROFILE"

  echo "Waiting for role propagation..."
  sleep 10
else
  echo "Role $ROLE_NAME already exists, skipping creation."
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# --- Create or update the Lambda function ---
if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://contactForm.zip \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://contactForm.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "Variables={CONTACT_MESSAGES_TABLE=contact_messages,SES_NOREPLY_ADDRESS=noreply@sixspurranch.org,SES_ADMIN_ADDRESS=richard@sixspurranch.org,RICHARD_PHONE_NUMBER=+18137866333}" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
