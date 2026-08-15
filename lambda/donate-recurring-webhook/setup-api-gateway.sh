#!/bin/bash
set -e

# UNLIKE every other setup-api-gateway.sh in this project, this route
# takes NO authorizer argument and NO --authorization-type JWT. PayPal's
# servers call this endpoint directly -- there is no Cognito login to
# check. Authenticity is instead verified INSIDE the Lambda itself, via
# PayPal's own webhook-signature-verification API (see paypal.js). If
# this route gets accidentally wired up with JWT auth, PayPal's webhook
# calls will all fail with 401 and silently stop updating subscription
# status -- there is no separate alert for that, so don't add an
# authorizer here even though every other route in this project has one.
#
#   ./setup-api-gateway.sh

REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
API_NAME="sixspur-api"
FUNCTION_NAME="sixspur-donate-recurring-webhook"

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

API_ID=$(aws apigatewayv2 get-apis \
  --profile "$PROFILE" --region "$REGION" \
  --query "Items[?Name=='${API_NAME}'].ApiId" --output text)

if [ -z "$API_ID" ] || [ "$API_ID" == "None" ]; then
  echo "ERROR: Could not find API named $API_NAME."
  exit 1
fi

echo "Using API: $API_ID"

echo "Creating integration..."
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id "$API_ID" \
  --integration-type AWS_PROXY \
  --integration-uri "$LAMBDA_ARN" \
  --payload-format-version "2.0" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'IntegrationId' --output text)

echo "Creating route: POST /webhooks/paypal-recurring (PUBLIC -- no JWT authorizer)"
aws apigatewayv2 create-route \
  --api-id "$API_ID" \
  --route-key "POST /webhooks/paypal-recurring" \
  --target "integrations/${INTEGRATION_ID}" \
  --authorization-type NONE \
  --profile "$PROFILE" --region "$REGION" >/dev/null || echo "  Route may already exist, skipping."

echo "Granting invoke permission..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-donate-recurring-webhook-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/webhooks/paypal-recurring" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

# Print the full URL so it can be pasted directly into the PayPal
# dashboard's webhook registration form.
API_ENDPOINT=$(aws apigatewayv2 get-api \
  --api-id "$API_ID" \
  --profile "$PROFILE" --region "$REGION" \
  --query 'ApiEndpoint' --output text)

echo ""
echo "Done. Webhook URL to register in the PayPal dashboard:"
echo "  ${API_ENDPOINT}/webhooks/paypal-recurring"
