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

# IMPORTANT: PLAN_ID_10/25/50/100 are placeholders -- fill these in with
# the real PayPal Plan IDs after creating the 4 preset-tier Plans (one-time
# PayPal setup, see the plan-creation script). Deploying with placeholders
# means create-subscription will fail with "No PayPal plan configured for
# tier: X" until these are set for real via update-function-configuration.
ENV_VARS="Variables={RECURRING_DONATIONS_TABLE=recurring_donations,PAYPAL_MODE=sandbox,PAYPAL_SECRET_NAME=sixspur/paypal-api,SITE_URL=https://sixspurranch.org,PLAN_ID_10=REPLACE_ME,PLAN_ID_25=REPLACE_ME,PLAN_ID_50=REPLACE_ME,PLAN_ID_100=REPLACE_ME}"

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
    --environment "$ENV_VARS" \
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
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi

echo ""
echo "Done. Function: $FUNCTION_NAME"
echo "REMINDER: PLAN_ID_10/25/50/100 are placeholders on first deploy -- update them once the real PayPal Plans exist:"
echo "  aws lambda update-function-configuration --function-name $FUNCTION_NAME --environment Variables={...,PLAN_ID_10=<real>,...} --profile $PROFILE --region $REGION"
