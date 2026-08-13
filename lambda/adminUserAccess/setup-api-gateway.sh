#!/bin/bash
set -e

# Requires the JWT authorizer already used by /donor/* and /donate/*.
# Pass its ID as the first argument:
#   ./setup-api-gateway.sh <AUTHORIZER_ID>
# (This project's authorizer ID is gyxmij, from Session 12.)

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
FUNCTION_NAME="sixspur-adminUserAccess"

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

ROUTES=(
  "GET /admin/user-access"
  "POST /admin/user-access"
  "DELETE /admin/user-access/{id}"
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
  --statement-id apigateway-admin-useraccess-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/admin/user-access*" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

echo ""
echo "Done. All /admin/user-access routes now require a valid Cognito JWT."
