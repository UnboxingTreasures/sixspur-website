#!/bin/bash
set -e

# Requires the same JWT authorizer already used for /donor/* and
# /donate/* routes. Pass its ID:
#   ./setup-api-gateway.sh <AUTHORIZER_ID>

AUTHORIZER_ID="$1"
if [ -z "$AUTHORIZER_ID" ]; then
  echo "ERROR: pass the JWT authorizer ID as the first argument."
  echo "Usage: ./setup-api-gateway.sh <AUTHORIZER_ID>"
  exit 1
fi

REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
API_NAME="sixspur-api"
FUNCTION_NAME="sixspur-donate-recurring"

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

# All three routes require a logged-in donor -- same JWT authorizer as
# one-time donations. Unlike the webhook Lambda's route, none of these
# are public.
ROUTES=(
  "POST /donate/recurring/create-subscription"
  "POST /donate/recurring/cancel"
  "GET /donate/recurring/mine"
)

for ROUTE in "${ROUTES[@]}"; do
  echo "Creating route: $ROUTE (JWT-protected)"
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE" \
    --target "integrations/${INTEGRATION_ID}" \
    --authorization-type JWT \
    --authorizer-id "$AUTHORIZER_ID" \
    --profile "$PROFILE" --region "$REGION" >/dev/null || echo "  Route may already exist, skipping."
done

echo "Granting invoke permission..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-donate-recurring-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/donate/recurring/*" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

echo ""
echo "Done. All /donate/recurring/* routes require a valid Cognito JWT."
