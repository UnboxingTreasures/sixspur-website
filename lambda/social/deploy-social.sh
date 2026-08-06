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
aws secretsmanager create-secret \
  --name sixspur/meta-api \
  --secret-string '{"facebook_page_id":"1109378342269269","facebook_page_token":"REPLACE_ME_NOT_YET_GENERATED","instagram_business_account_id":"17841448275162258","instagram_access_token":"IGAAVRZAdUXjDNBZAFpBZA3ljVmJXWnJLSXNJZAjJHUVg0cFlQWi1SdEtZAVDBqaFJPRmJYSEVRaEt1TFZAFejB4MkgtQTZA0MkRqc3RHZATNBb25zN0haeHJVVWtVeFN5dlVRRTdjN2xibl9vMVV0N0k1Y1I3WE5ZAU0hQN3VqTVc0ZAXZAxMAZDZD"}' \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null \
  || aws secretsmanager put-secret-value \
    --secret-id sixspur/meta-api \
    --secret-string '{"facebook_page_id":"1109378342269269","facebook_page_token":"REPLACE_ME_NOT_YET_GENERATED","instagram_business_account_id":"17841448275162258","instagram_access_token":"IGAAVRZAdUXjDNBZAFpBZA3ljVmJXWnJLSXNJZAjJHUVg0cFlQWi1SdEtZAVDBqaFJPRmJYSEVRaEt1TFZAFejB4MkgtQTZA0MkRqc3RHZATNBb25zN0haeHJVVWtVeFN5dlVRRTdjN2xibl9vMVV0N0k1Y1I3WE5ZAU0hQN3VqTVc0ZAXZAxMAZDZD"}' \
    --profile "$PROFILE" --region "$REGION" > /dev/null

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

for FN in postToInstagram postToFacebook social-presignedUrl; do
  case $FN in
    postToInstagram) ROUTE="POST /admin/social/post-to-instagram"; LAMBDA="sixspur-postToInstagram" ;;
    postToFacebook)  ROUTE="POST /admin/social/post-to-facebook";  LAMBDA="sixspur-postToFacebook" ;;
    social-presignedUrl) ROUTE="POST /admin/social/presigned-url"; LAMBDA="sixspur-social-presignedUrl" ;;
  esac

  INTEGRATION_ID=$(aws apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA}" \
    --payload-format-version "2.0" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'IntegrationId' --output text)

  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE" \
    --target "integrations/${INTEGRATION_ID}" \
    --profile "$PROFILE" --region "$REGION" > /dev/null

  aws lambda add-permission \
    --function-name "$LAMBDA" \
    --statement-id apigateway-invoke-social \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/admin/social/*" \
    --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "  Permission already exists for $LAMBDA"

  echo "  Wired: $ROUTE -> $LAMBDA"
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
