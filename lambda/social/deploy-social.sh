#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
ACCOUNT_ID="658965339779"
API_ID="vvabeaemg5"

cd ~/Documents/sixspur-website/lambda/social

echo "=== 1. Creating IAM role for social Lambdas ==="
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }
  ]
}
EOF

aws iam create-role \
  --role-name sixspur-social-execution-role \
  --assume-role-policy-document file://trust-policy.json \
  --profile "$PROFILE" 2>/dev/null || echo "Role already exists, continuing..."

cat > execution-role-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:${REGION}:${ACCOUNT_ID}:*"
    },
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:${REGION}:${ACCOUNT_ID}:secret:sixspur/meta-api-*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::sixspurranch-assets/social-uploads/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name sixspur-social-execution-role \
  --policy-name sixspur-social-execution-policy \
  --policy-document file://execution-role-policy.json \
  --profile "$PROFILE"

echo "Waiting for IAM role propagation..."
sleep 10

ROLE_ARN=$(aws iam get-role --role-name sixspur-social-execution-role --profile "$PROFILE" --query 'Role.Arn' --output text)
echo "Role ARN: $ROLE_ARN"

echo ""
echo "=== 2. Creating/updating the Secrets Manager secret ==="
# FIXED (Session 20): this used to unconditionally call put-secret-value
# with a HARDCODED PLACEHOLDER facebook_page_token on every single
# deploy -- meaning any real token that had been set (manually, after
# generating it in the Meta dashboard) got silently wiped back to
# "REPLACE_ME_NOT_YET_GENERATED" the next time this script ran for any
# reason (e.g. just to ship an unrelated code fix). This is exactly
# what happened tonight: a real token was working (confirmed by a
# successful live Facebook post), then got overwritten back to the
# placeholder by this script's own secret-creation step, breaking
# Facebook posting entirely with no obvious symptom until the next
# attempt failed with "Malformed access token". Now: only ever CREATE
# the secret with the placeholder if it doesn't exist yet at all. If it
# already exists, this step does nothing -- whatever real value is
# currently there (placeholder or real token) is left completely alone.
if aws secretsmanager describe-secret --secret-id sixspur/meta-api --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Secret already exists -- leaving its current value untouched (use the command printed at the end of this script to update the real token)."
else
  aws secretsmanager create-secret \
    --name sixspur/meta-api \
    --secret-string '{"facebook_page_id":"1109378342269269","facebook_page_token":"REPLACE_ME_NOT_YET_GENERATED","instagram_business_account_id":"17841448275162258","instagram_access_token":"IGAAVRZAdUXjDNBZAFpBZA3ljVmJXWnJLSXNJZAjJHUVg0cFlQWi1SdEtZAVDBqaFJPRmJYSEVRaEt1TFZAFejB4MkgtQTZA0MkRqc3RHZATNBb25zN0haeHJVVWtVeFN5dlVRRTdjN2xibl9vMVV0N0k1Y1I3WE5ZAU0hQN3VqTVc0ZAXZAxMAZDZD"}' \
    --profile "$PROFILE" --region "$REGION" > /dev/null
  echo "Secret created for the first time (placeholder Facebook token -- fill in the real one before Facebook posting will work)."
fi

echo ""
echo "=== 3. Installing dependencies ==="
npm init -y > /dev/null 2>&1 || true
npm install @aws-sdk/client-secrets-manager @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --silent

echo ""
echo "=== 4. Deploying postToInstagram ==="
zip -q postToInstagram.zip postToInstagram.js node_modules package.json
aws lambda create-function \
  --function-name sixspur-postToInstagram \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler postToInstagram.handler \
  --zip-file fileb://postToInstagram.zip \
  --timeout 60 --memory-size 256 \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null \
  || aws lambda update-function-code \
    --function-name sixspur-postToInstagram \
    --zip-file fileb://postToInstagram.zip \
    --profile "$PROFILE" --region "$REGION" > /dev/null

echo "=== 5. Deploying postToFacebook ==="
zip -q postToFacebook.zip postToFacebook.js node_modules package.json
aws lambda create-function \
  --function-name sixspur-postToFacebook \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler postToFacebook.handler \
  --zip-file fileb://postToFacebook.zip \
  --timeout 30 --memory-size 256 \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null \
  || aws lambda update-function-code \
    --function-name sixspur-postToFacebook \
    --zip-file fileb://postToFacebook.zip \
    --profile "$PROFILE" --region "$REGION" > /dev/null

echo "=== 6. Deploying presignedUrl ==="
zip -q presignedUrl.zip presignedUrl.js node_modules package.json
aws lambda create-function \
  --function-name sixspur-social-presignedUrl \
  --runtime nodejs20.x \
  --role "$ROLE_ARN" \
  --handler presignedUrl.handler \
  --zip-file fileb://presignedUrl.zip \
  --timeout 15 --memory-size 256 \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null \
  || aws lambda update-function-code \
    --function-name sixspur-social-presignedUrl \
    --zip-file fileb://presignedUrl.zip \
    --profile "$PROFILE" --region "$REGION" > /dev/null

echo ""
echo "=== 7. Wiring up API Gateway routes ==="
# FIXED (Session 20, second pass): the first fix used JMESPath
# "| [0]" text-output extraction for both integration and route
# lookups, which produced a garbage, non-existent route ID
# ("waiznj0" -- didn't match any real route on the API) when run live,
# even though a manual equivalent query worked fine standalone. Rather
# than keep chasing the exact CLI/JMESPath text-output quirk, this
# switches to the same robust pattern already used successfully
# elsewhere in this project today: fetch the full JSON with
# --output json, parse it with python3, and pass real values through
# explicitly. No more ambiguous single-line text extraction.

ALL_INTEGRATIONS_JSON=$(aws apigatewayv2 get-integrations --api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --output json)
ALL_ROUTES_JSON=$(aws apigatewayv2 get-routes --api-id "$API_ID" --profile "$PROFILE" --region "$REGION" --output json)

for FN in postToInstagram postToFacebook social-presignedUrl; do
  case $FN in
    postToInstagram) ROUTE="POST /admin/social/post-to-instagram"; LAMBDA="sixspur-postToInstagram" ;;
    postToFacebook)  ROUTE="POST /admin/social/post-to-facebook";  LAMBDA="sixspur-postToFacebook" ;;
    social-presignedUrl) ROUTE="POST /admin/social/presigned-url"; LAMBDA="sixspur-social-presignedUrl" ;;
  esac

  LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA}"

  EXISTING_INTEGRATION_ID=$(echo "$ALL_INTEGRATIONS_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('Items', []):
    if item.get('IntegrationUri') == '$LAMBDA_ARN':
        print(item['IntegrationId'])
        break
")

  if [ -z "$EXISTING_INTEGRATION_ID" ]; then
    INTEGRATION_ID=$(aws apigatewayv2 create-integration \
      --api-id "$API_ID" \
      --integration-type AWS_PROXY \
      --integration-uri "$LAMBDA_ARN" \
      --payload-format-version "2.0" \
      --profile "$PROFILE" --region "$REGION" \
      --query 'IntegrationId' --output text)
    echo "  Created new integration for $LAMBDA: $INTEGRATION_ID"
  else
    INTEGRATION_ID="$EXISTING_INTEGRATION_ID"
    echo "  Reusing existing integration for $LAMBDA: $INTEGRATION_ID"
  fi

  EXISTING_ROUTE_ID=$(echo "$ALL_ROUTES_JSON" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for item in data.get('Items', []):
    if item.get('RouteKey') == '''$ROUTE''':
        print(item['RouteId'])
        break
")

  if [ -z "$EXISTING_ROUTE_ID" ]; then
    aws apigatewayv2 create-route \
      --api-id "$API_ID" \
      --route-key "$ROUTE" \
      --target "integrations/${INTEGRATION_ID}" \
      --profile "$PROFILE" --region "$REGION" > /dev/null
    echo "  Created route: $ROUTE -> $LAMBDA"
  else
    aws apigatewayv2 update-route \
      --api-id "$API_ID" \
      --route-id "$EXISTING_ROUTE_ID" \
      --target "integrations/${INTEGRATION_ID}" \
      --profile "$PROFILE" --region "$REGION" > /dev/null
    echo "  Updated existing route ($EXISTING_ROUTE_ID): $ROUTE -> $LAMBDA"
  fi

  aws lambda add-permission \
    --function-name "$LAMBDA" \
    --statement-id apigateway-invoke-social \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/admin/social/*" \
    --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "  Permission already exists for $LAMBDA"
done

echo ""
echo "=== DONE ==="
echo ""
echo "Instagram token is already real and in the secret — Instagram posting should work now."
echo ""
echo "IMPORTANT — Facebook posting still needs one more step:"
echo "The facebook_page_token in the secret is still a placeholder because it hasn't been"
echo "generated yet. Go to the Meta app dashboard -> 'Manage everything on your Page' use case"
echo "-> generate an access token there (same pattern as the Instagram one). Then run:"
echo "   aws secretsmanager put-secret-value --secret-id sixspur/meta-api \\"
echo "     --secret-string '{\"facebook_page_id\":\"1109378342269269\",\"facebook_page_token\":\"YOUR_REAL_TOKEN\",\"instagram_business_account_id\":\"17841448275162258\",\"instagram_access_token\":\"IGAAVRZAdUXjDNBZAFpBZA3ljVmJXWnJLSXNJZAjJHUVg0cFlQWi1SdEtZAVDBqaFJPRmJYSEVRaEt1TFZAFejB4MkgtQTZA0MkRqc3RHZATNBb25zN0haeHJVVWtVeFN5dlVRRTdjN2xibl9vMVV0N0k1Y1I3WE5ZAU0hQN3VqTVc0ZAXZAxMAZDZD\"}' \\"
echo "     --profile $PROFILE --region $REGION"
