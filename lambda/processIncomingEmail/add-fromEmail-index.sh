#!/bin/bash
set -e

# Adds a fromEmail-index GSI to the existing contact_messages table.
# Needed so processIncomingEmail.js can look up "which thread is this
# reply for?" without scanning the whole table.

echo "Adding fromEmail-index GSI to contact_messages..."
aws dynamodb update-table \
  --table-name contact_messages \
  --attribute-definitions \
    AttributeName=fromEmail,AttributeType=S \
    AttributeName=receivedAt,AttributeType=S \
  --global-secondary-index-updates \
    "[{\"Create\":{\"IndexName\":\"fromEmail-index\",\"KeySchema\":[{\"AttributeName\":\"fromEmail\",\"KeyType\":\"HASH\"},{\"AttributeName\":\"receivedAt\",\"KeyType\":\"RANGE\"}],\"Projection\":{\"ProjectionType\":\"ALL\"}}}]" \
  --profile sixspur --region us-east-1

echo "GSI creation started — this backfills in the background and may take a few minutes."
echo "Check status with:"
echo "  aws dynamodb describe-table --table-name contact_messages --profile sixspur --region us-east-1 --query 'Table.GlobalSecondaryIndexes[*].{Name:IndexName,Status:IndexStatus}'"
