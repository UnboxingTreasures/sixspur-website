#!/bin/bash
set -e

FUNCTION_NAME="sixspur-donate-recurring"
ROLE_NAME="sixspur-donate-recurring-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f donate-recurring.zip
zip -r donate-recurring.zip index.js dynamo.js paypal.js node_modules package.json

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
  --policy-name DonateRecurringPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# FIXED (this version): the previous script did a full env var
# OVERWRITE on every deploy, including literal placeholders for
# PAYPAL_MODE/PLAN_ID_5/10/20. That meant any redeploy after the real
# live Plan IDs were set would silently wipe them back to REPLACE_ME --
# this is the exact bug that already cost real Plan IDs twice on the
# sandbox side. Now: fetch whatever's actually live on the function
# first, only forcibly set the values this script is meant to own
# (table name, secret name, site URL), and use setdefault for the
# values that get patched in manually after a one-time PayPal setup
# step (PAYPAL_MODE, PLAN_ID_5/10/20) so a real value already in place
# is never clobbered by a routine code-only redeploy.
CURRENT_VARS=$(aws lambda get-function-configuration \
  --function-name "$FUNCTION_NAME" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'Environment.Variables' --output json 2>/dev/null || echo '{}')

NEW_VARS=$(echo "$CURRENT_VARS" | python3 -c "
import json, sys
env = json.load(sys.stdin) or {}
env['RECURRING_DONATIONS_TABLE'] = 'recurring_donations'
env['PAYPAL_SECRET_NAME'] = 'sixspur/paypal-api'
env['SITE_URL'] = 'https://sixspurranch.org'
env.setdefault('PAYPAL_MODE', 'sandbox')
env.setdefault('PLAN_ID_5', 'REPLACE_ME')
env.setdefault('PLAN_ID_10', 'REPLACE_ME')
env.setdefault('PLAN_ID_20', 'REPLACE_ME')
print(json.dumps({'Variables': env}))
")

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://donate-recurring.zip \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$NEW_VARS" \
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
    --zip-file fileb://donate-recurring.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "$NEW_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi

echo ""
echo "Done. Function: $FUNCTION_NAME"
echo "If PLAN_ID_5/10/20 or PAYPAL_MODE still show REPLACE_ME/sandbox above, patch them once with:"
echo "  aws lambda update-function-configuration --function-name $FUNCTION_NAME --environment 'Variables={...}' --profile $PROFILE --region $REGION"
echo "That real value will now be PRESERVED on every future deploy of this script."
