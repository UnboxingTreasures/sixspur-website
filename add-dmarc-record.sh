#!/bin/bash
set -e

HOSTED_ZONE_ID="Z06493211H957UF7Y6B5V"
DOMAIN="sixspurranch.org"

cat > /tmp/dmarc-record-change.json << EOF
{
  "Comment": "Add DMARC record for email authentication/trust",
  "Changes": [
    {
      "Action": "UPSERT",
      "ResourceRecordSet": {
        "Name": "_dmarc.${DOMAIN}",
        "Type": "TXT",
        "TTL": 300,
        "ResourceRecords": [
          {"Value": "\"v=DMARC1; p=none; rua=mailto:richard@${DOMAIN}\""}
        ]
      }
    }
  ]
}
EOF

echo "Applying DMARC record..."
aws route53 change-resource-record-sets \
  --hosted-zone-id "$HOSTED_ZONE_ID" \
  --change-batch file:///tmp/dmarc-record-change.json \
  --profile sixspur

echo ""
echo "Done. DNS propagation can take a few minutes to a few hours."
echo "Verify with:"
echo "  dig TXT _dmarc.${DOMAIN} +short"
