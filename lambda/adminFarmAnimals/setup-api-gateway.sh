#!/bin/bash
set -e

REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
API_NAME="sixspur-api"
FUNCTION_NAME="sixspur-adminFarmAnimals"

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
  "GET /admin/animals"
  "GET /admin/animals/{id}"
  "POST /admin/animals"
  "PATCH /admin/animals/{id}"
  "DELETE /admin/animals/{id}"
  "POST /admin/animals/{id}/photos/presign"
  "POST /admin/animals/{id}/photos"
  "DELETE /admin/animals/{id}/photos"
  "PATCH /admin/animals/{id}/thumbnail"
)

for ROUTE in "${ROUTES[@]}"; do
  echo "Creating route: $ROUTE"
  aws apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$ROUTE" \
    --target "integrations/${INTEGRATION_ID}" \
    --profile "$PROFILE" --region "$REGION" >/dev/null || echo "  Route may already exist, skipping."
done

echo "Granting invoke permission..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id apigateway-admin-animals-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:${REGION}:${ACCOUNT_ID}:${API_ID}/*/*/admin/animals*" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

echo ""
echo "Done."
