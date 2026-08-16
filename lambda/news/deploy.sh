#!/bin/bash
set -e
FUNCTION_NAME="sixspur-news"
ROLE_NAME="sixspur-news-execution-role"
REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
echo "Installing dependencies..."
npm install
echo "Zipping function..."
rm -f news.zip
zip -r news.zip index.js dynamo.js s3.js adminAuth.js node_modules package.json
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
# policy file update (e.g. adding S3 permissions) silently never takes
# effect on an already-existing role.
echo "Applying current execution role policy (safe to re-run)..."
aws iam put-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-name NewsPermissions \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
ENV_VARS="Variables={NEWS_POSTS_TABLE=news_posts,ASSETS_BUCKET=sixspurranch-assets,CDN_BASE=https://d1s8s7aw8vf5zu.cloudfront.net}"
if aws lambda get-function --function-name "$FUNCTION_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Function exists, updating code..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://news.zip \
    --profile "$PROFILE" --region "$REGION"
  aws lambda wait function-updated \
    --function-name "$FUNCTION_NAME" \
    --profile "$PROFILE" --region "$REGION"
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
    --zip-file fileb://news.zip \
    --timeout 10 \
    --memory-size 256 \
    --environment "$ENV_VARS" \
    --profile "$PROFILE" --region "$REGION"
fi
echo "Done. Function: $FUNCTION_NAME"
