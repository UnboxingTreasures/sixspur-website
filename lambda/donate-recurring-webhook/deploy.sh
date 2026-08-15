#!/bin/bash
set -e

FUNCTION_NAME="sixspur-donate-recurring-webhook"
ROLE_NAME="sixspur-donate-recurring-webhook-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f donate-recurring-webhook.zip
zip -r donate-recurring-webhook.zip index.js dynamo.js donations-dynamo.js paypal.js receipt.js node_modules package.json

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
  --policy-name DonateRecurringWebhookPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

# IMPORTANT: PAYPAL_WEBHOOK_ID is a placeholder -- fill in the real
# webhook ID after registering the webhook in the PayPal dashboard
# (Apps & Credentials > your app > Webhooks > Add Webhook, URL will be
# the API Gateway route from setup-api-gateway.sh below). Without the
# real ID, verifyWebhookSignature() always returns false and every
# webhook call gets rejected with 400.
ENV_VARS="Variables={RECURRING_DONATIONS_TABLE=recurring_donations,DONATIONS_TABLE=donations,PAYPAL_MODE=sandbox,PAYPAL_SECRET_NAME=sixspur/paypal-api,PAYPAL_WEBHOOK_ID=REPLACE_ME,ASSETS_BUCKET=sixspurranch-assets,CDN_BASE=https://d1s8s7aw8vf5zu.cloudfront.net,SES_FROM_ADDRESS=noreply@sixspurranch.org}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://donate-recurring-webhook.zip \
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
    --zip-file fileb://donate-recurring-webhook.zip \
    --timeout 15 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi

echo ""
echo "Done. Function: $FUNCTION_NAME"
echo "REMINDER: PAYPAL_WEBHOOK_ID is a placeholder until the webhook is registered in the PayPal dashboard -- update it with:"
echo "  aws lambda update-function-configuration --function-name $FUNCTION_NAME --environment Variables={...,PAYPAL_WEBHOOK_ID=<real>,...} --profile $PROFILE --region $REGION"
