#!/bin/bash
set -e

# Adds the MX record on sixspurranch.org pointing to SES inbound.
# WARNING: this replaces any existing MX record on the domain. If
# sixspurrescue@gmail.com or any other mailbox depends on an existing MX
# record for this exact domain (not likely, since that's a gmail.com
# address, but worth a gut check before running), confirm first.

HOSTED_ZONE_ID="Z06493211H957UF7Y6B5V"
DOMAIN="sixspurranch.org"
REGION="us-east-1"
PROFILE="sixspur"

cat > /tmp/mx-record-change.json << EOF
{
  "Comment": "Add MX record for SES email receiving",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "${DOMAIN}",
        "Type": "MX",
        "TTL": 300,
        "ResourceRecords": [
          {"Value": "10 inbound-smtp.${REGION}.amazonaws.com"}
        ]
      }
    }
  ]
}
EOF

echo "Applying MX record..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/mx-record-change.json \
  --profile "$PROFILE"

echo ""
echo "Done. DNS propagation can take a few minutes to a few hours."
echo "Verify with:"
echo "  dig MX ${DOMAIN}"
