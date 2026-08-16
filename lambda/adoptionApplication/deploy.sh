#!/bin/bash
set -e

FUNCTION_NAME="sixspur-adoptionApplication"
ROLE_NAME="sixspur-adoptionApplication-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f adoptionApplication.zip
zip -r adoptionApplication.zip index.js pdf.js s3.js dynamo.js notify.js node_modules package.json

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
  --policy-name AdoptionApplicationPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# SMS_RECIPIENTS is pulled fresh from SNS's list of VERIFIED sandbox
# numbers on every deploy -- add/verify a new number once via SNS, and
# the next deploy picks it up automatically with no code or script edit
# needed. Falls back to Richard's number alone if the lookup somehow
# returns nothing, so a deploy never accidentally ships with zero
# recipients.
VERIFIED_NUMBERS=$(aws sns list-sms-sandbox-phone-numbers \
  --profile "$PROFILE" --region "$REGION" \
  --query "PhoneNumbers[?Status=='Verified'].PhoneNumber" --output text | tr '\t' ',')
SMS_RECIPIENTS="${VERIFIED_NUMBERS:-+18137866333}"
echo "SMS recipients for this deploy: $SMS_RECIPIENTS"

ENV_VARS="Variables={ADOPTION_APPLICATIONS_TABLE=adoption_applications,ADOPTION_PDF_BUCKET=sixspurranch-adoption-pdfs,ADOPTION_UPLOADS_BUCKET=sixspurranch-adoption-uploads,SES_NOREPLY_ADDRESS=noreply@sixspurranch.org,SES_ADMIN_ADDRESS=richard@sixspurranch.org,RICHARD_PHONE_NUMBER=+18137866333,SMS_RECIPIENTS=${SMS_RECIPIENTS}}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://adoptionApplication.zip \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" \
    --timeout 30 \
    --memory-size 512 \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://adoptionApplication.zip \
    --timeout 30 \
    --memory-size 512 \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
