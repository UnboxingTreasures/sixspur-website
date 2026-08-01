#!/bin/bash
set -e

# Sets up SES email receiving for sixspurranch.org:
#   1. Creates the S3 bucket that stores raw incoming emails
#   2. Grants SES permission to write to that bucket
#   3. Creates (or confirms) an active SES receipt rule set
#   4. Creates a receipt rule: store to S3, then invoke processIncomingEmail
#   5. Grants SES permission to invoke the Lambda
#
# Run this AFTER deploying the processIncomingEmail Lambda (deploy.sh),
# since this script needs that function to already exist.

REGION="us-east-1"
PROFILE="sixspur"
ACCOUNT_ID="658965339779"
BUCKET_NAME="sixspurranch-incoming-mail"
RULE_SET_NAME="sixspur-receiving"
RULE_NAME="sixspur-inbound-to-processor"
FUNCTION_NAME="sixspur-processIncomingEmail"
RECIPIENT="richard@sixspurranch.org"

# --- 1. Create the S3 bucket ---
if aws s3api head-bucket --bucket "$BUCKET_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "Bucket $BUCKET_NAME already exists, skipping creation."
else
  echo "Creating S3 bucket $BUCKET_NAME..."
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --profile "$PROFILE"
fi

# --- 2. Bucket policy allowing SES to write, scoped to this account ---
echo "Applying bucket policy..."
cat > /tmp/ses-bucket-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSESPuts",
      "Effect": "Allow",
      "Principal": {"Service": "ses.amazonaws.com"},
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {"aws:Referer": "${ACCOUNT_ID}"}
      }
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$BUCKET_NAME" \
  --policy file:///tmp/ses-bucket-policy.json \
  --profile "$PROFILE"

# --- 3. Create the receipt rule set if it doesn't exist, and activate it ---
if aws ses describe-receipt-rule-set --rule-set-name "$RULE_SET_NAME" --profile "$PROFILE" --region "$REGION" >/dev/null 2>&1; then
  echo "Rule set $RULE_SET_NAME already exists."
else
  echo "Creating rule set $RULE_SET_NAME..."
  aws ses create-receipt-rule-set \
    --rule-set-name "$RULE_SET_NAME" \
    --profile "$PROFILE" --region "$REGION"
fi

echo "Activating rule set $RULE_SET_NAME..."
aws ses set-active-receipt-rule-set \
  --rule-set-name "$RULE_SET_NAME" \
  --profile "$PROFILE" --region "$REGION"

# --- 4. Create the receipt rule: S3 action, then Lambda action ---
FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${FUNCTION_NAME}"

echo "Creating receipt rule $RULE_NAME..."
aws ses create-receipt-rule \
  --rule-set-name "$RULE_SET_NAME" \
  --rule "{
    \"Name\": \"${RULE_NAME}\",
    \"Enabled\": true,
    \"TlsPolicy\": \"Optional\",
    \"Recipients\": [\"${RECIPIENT}\"],
    \"ScanEnabled\": true,
    \"Actions\": [
      {\"S3Action\": {\"BucketName\": \"${BUCKET_NAME}\"}},
      {\"LambdaAction\": {\"FunctionArn\": \"${FUNCTION_ARN}\", \"InvocationType\": \"Event\"}}
    ]
  }" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Rule already exists, skipping."

# --- 5. Grant SES permission to invoke the Lambda ---
echo "Granting SES invoke permission on the Lambda..."
aws lambda add-permission \
  --function-name "$FUNCTION_NAME" \
  --statement-id ses-invoke-processIncomingEmail \
  --action lambda:InvokeFunction \
  --principal ses.amazonaws.com \
  --source-account "$ACCOUNT_ID" \
  --profile "$PROFILE" --region "$REGION" 2>/dev/null || echo "Permission already exists, skipping."

echo ""
echo "Done. SES receiving is configured, but mail won't actually arrive until"
echo "the MX record is added to Route 53 (see next step)."
