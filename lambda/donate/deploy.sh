#!/bin/bash
set -e

FUNCTION_NAME="sixspur-donate"
ROLE_NAME="sixspur-donate-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f donate.zip
zip -r donate.zip index.js dynamo.js paypal.js receipt.js notify.js node_modules package.json

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
  --policy-name DonatePermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# SMS_RECIPIENTS is pulled fresh from SNS's list of VERIFIED sandbox
# numbers on every deploy, same pattern established in
# lambda/adoptionApplication/deploy.sh -- add/verify a new number once
# via SNS, and the next deploy of ANY of these Lambdas picks it up
# automatically with no code/script edit needed.
VERIFIED_NUMBERS=$(aws sns list-sms-sandbox-phone-numbers \
  --profile "$PROFILE" --region "$REGION" \
  --query "PhoneNumbers[?Status=='Verified'].PhoneNumber" --output text | tr '\t' ',')
SMS_RECIPIENTS="${VERIFIED_NUMBERS:-+18137866333}"
echo "SMS recipients for this deploy: $SMS_RECIPIENTS"

# IMPORTANT: real JSON, not the AWS CLI's Variables={...} shorthand --
# that shorthand parser treats commas as key/value delimiters, which
# breaks the instant SMS_RECIPIENTS contains more than one phone
# number (a real bug hit and fixed earlier tonight on a sibling
# Lambda). JSON handles commas inside a quoted string fine.
ENV_VARS_JSON=$(cat <<JSONEOF
{"Variables":{"DONATIONS_TABLE":"donations","FUNDRAISERS_TABLE":"fundraisers","PAYPAL_MODE":"sandbox","PAYPAL_SECRET_NAME":"sixspur/paypal-api","ASSETS_BUCKET":"sixspurranch-assets","CDN_BASE":"https://d1s8s7aw8vf5zu.cloudfront.net","SES_FROM_ADDRESS":"noreply@sixspurranch.org","SMS_RECIPIENTS":"${SMS_RECIPIENTS}"}}
JSONEOF
)

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://donate.zip \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS_JSON" \
    --timeout 15 \
    --memory-size 256 \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://donate.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "$ENV_VARS_JSON" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
