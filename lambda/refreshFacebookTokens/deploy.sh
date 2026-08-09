#!/bin/bash
set -e

FUNCTION_NAME="sixspur-refresh-facebook-tokens"
ROLE_NAME="sixspur-refresh-facebook-tokens-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
RULE_NAME="sixspur-refresh-facebook-tokens-schedule"

echo "Installing dependencies..."
npm install

echo "Zipping function..."
rm -f refresh-facebook-tokens.zip
zip -r refresh-facebook-tokens.zip index.js node_modules package.json

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

echo "Attaching/refreshing policy..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name RefreshFacebookTokensPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://refresh-facebook-tokens.zip \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"
else
  echo "Creating function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://refresh-facebook-tokens.zip \
    --timeout 15 \
    --memory-size 128 \
    --profile "$PROFILE" --region "$REGION"

  aws lambda wait function-active \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"
fi

# --- EventBridge schedule: this Lambda is time-triggered (every 30 days),
# unlike Six Spur's other Lambdas which are API-triggered, so there's no
# existing pattern to copy here -- this block is new.

echo "Creating/updating EventBridge schedule rule..."
aws events put-rule \
  --name "$RULE_NAME" \
  --schedule-expression "rate(30 days)" \
  --state ENABLED \
  --profile "$PROFILE" --region "$REGION"

FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

# Grant EventBridge permission to invoke the function (safe to re-run --
# AWS returns an error if the statement already exists, which we ignore)
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id "${RULE_NAME}-invoke" \
  --action "lambda:InvokeFunction" \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "  (permission already exists, skipping)"

aws events put-targets \
  --rule "$RULE_NAME" \
  --targets "Id"="1","Arn"="$FUNCTION_ARN" \
  --profile "$PROFILE" --region "$REGION"

echo "Done. Function: $FUNCTION_NAME"
echo "Scheduled: $RULE_NAME (every 30 days)"
