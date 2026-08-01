#!/bin/bash
set -e

# Creates an API Gateway HTTP API with a POST /contact route wired to the
# sixspur-saveContactMessage Lambda, and grants API Gateway permission to
# invoke it.

REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
FUNCTION_NAME="sixspur-saveContactMessage"
API_NAME="sixspur-api"

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

# --- Create the HTTP API if it doesn't already exist ---
EXISTING_API_ID=$(aws apigatewayv2 get-apis \
  --profile "$PROFILE" --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId" --output text)

if [ -z "$EXISTING_API_ID" ] || [ "$EXISTING_API_ID" == "None" ]; then
  echo "Creating HTTP API..."
  API_ID=$(aws apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --cors-configuration AllowOrigins="*",AllowMethods="POST,OPTIONS",AllowHeaders="Content-Type" \
    --profile "$PROFILE" --region "$REGION" \
    --query 'ApiId' --output text)
  echo "Created API: $API_ID"
else
  API_ID="$EXISTING_API_ID"
  echo "Using existing API: $API_ID"
fi

# --- Create the Lambda integration ---
echo "Creating integration..."
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version "2.0" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'IntegrationId' --output text)

# --- Create the route ---
echo "Creating route..."
aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key "POST /contact" \
  --target "integrations/${INTEGRATION_ID}" \
  --profile "$PROFILE" --region "$REGION"

# --- Create a $default stage with auto-deploy ---
echo "Creating/confirming default stage..."
aws apigatewayv2 create-stage \
  --api-id "$API_ID" \
  --stage-name '$default' \
  --auto-deploy \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Stage already exists, skipping."

# --- Grant API Gateway permission to invoke the Lambda ---
echo "Granting invoke permission..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-contact-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/contact" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

API_ENDPOINT=$(aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'ApiEndpoint' --output text)

echo ""
echo "Done."
echo "API ID: $API_ID"
echo "Contact form endpoint: ${API_ENDPOINT}/contact"
