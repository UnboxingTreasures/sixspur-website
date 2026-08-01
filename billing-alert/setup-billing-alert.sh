#!/bin/bash
set -e

PROFILE="sixspur"
ACCOUNT_ID="658965339779"

echo "Creating monthly $30 budget with email alerts to sixspurrescue@gmail.com..."
aws budgets create-budget \
  --account-id "$ACCOUNT_ID" \
  --budget file://billing-budget.json \
  --notifications-with-subscribers file://billing-notifications.json \
  --profile "$PROFILE"

echo ""
echo "Done. Verify with:"
echo "  aws budgets describe-budgets --account-id $ACCOUNT_ID --profile $PROFILE"
