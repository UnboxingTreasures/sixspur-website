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
zip -r processIncomingEmail.zip index.js notify.js getRecipients.js node_modules package.json

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
  echo "Role $ROLE_NAME already exists, skipping creation."
fi

# Runs on EVERY deploy, not just first-time role creation -- otherwise a
# policy file update (e.g. adding a new permission) silently never takes
# effect on an already-existing role, which is exactly what happened here.
echo "Applying current execution role policy (safe to re-run)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name ProcessIncomingEmailPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# SMS_RECIPIENTS is pulled fresh from SNS's list of VERIFIED sandbox
# numbers on every deploy, same pattern established elsewhere tonight.
VERIFIED_NUMBERS=$(aws sns list-sms-sandbox-phone-numbers \
  --profile "$PROFILE" --region "$REGION" \
  --query "PhoneNumbers[?Status=='Verified'].PhoneNumber" --output text | tr '\t' ',')
SMS_RECIPIENTS="${VERIFIED_NUMBERS:-+18137866333}"
echo "SMS recipients for this deploy: $SMS_RECIPIENTS"

# Real JSON, not the AWS CLI's Variables={...} shorthand -- that
# shorthand parser treats commas as key/value delimiters, which breaks
# the instant SMS_RECIPIENTS contains more than one phone number. Also
# note the existing IGNORED_SENDER_ADDRESSES value already contains a
# comma-escaped list under the OLD shorthand syntax (\, escaping) --
# JSON doesn't need that escaping trick at all, commas inside a quoted
# string just work.
ENV_VARS_JSON=$(cat <<JSONEOF
{"Variables":{"CONTACT_MESSAGES_TABLE":"contact_messages","INCOMING_MAIL_BUCKET":"sixspurranch-incoming-mail","SYSTEM_SENDER_ADDRESSES":"noreply@sixspurranch.org","IGNORED_SENDER_ADDRESSES":"postmaster@amazonses.com,noreply-dmarc-support@google.com","SMS_RECIPIENTS":"${SMS_RECIPIENTS}"}}
JSONEOF
)

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
    --environment "$ENV_VARS_JSON" \
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
    --environment "$ENV_VARS_JSON" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Done. Function: $FUNCTION_NAME"
