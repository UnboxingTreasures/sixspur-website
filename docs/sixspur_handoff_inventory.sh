#!/usr/bin/env bash
# Six Spur handoff inventory: writes docs/HANDOFF_INVENTORY.md into the repo.
# Lists resource NAMES and env var / secret KEYS only — never secret values.
set -uo pipefail

REPO="$HOME/Documents/sixspur-website"
OUT="$REPO/docs/HANDOFF_INVENTORY.md"
P="--profile sixspur --region us-east-1 --output text"
API_ID="vvabeaemg5"
AMP_ID="d3u4k69gjq52xt"

mkdir -p "$REPO/docs"
aws sts get-caller-identity --profile sixspur >/dev/null || { echo "AWS profile 'sixspur' not working"; exit 1; }

sec() { printf '\n## %s\n\n' "$1" >> "$OUT"; }
run() { printf '```\n' >> "$OUT"; eval "$1" >> "$OUT" 2>&1 || echo "(none / not accessible)" >> "$OUT"; printf '```\n' >> "$OUT"; }

{
  echo "# Six Spur Ranch & Rescue — Live Infrastructure Inventory"
  echo
  echo "Generated $(date '+%Y-%m-%d %H:%M %Z') from AWS account $(aws sts get-caller-identity --profile sixspur --query Account --output text), region us-east-1."
  echo "Names and keys only. **No secret values are included.** Companion to the Developer Handoff Guide (PDF)."
} > "$OUT"

sec "Repository"
run "git -C '$REPO' remote -v; echo; git -C '$REPO' branch -a; echo; git -C '$REPO' log -1 --format='Last commit: %h %ad %s' --date=short"

sec "Repository layout (top two levels)"
run "git -C '$REPO' ls-files | awk -F/ 'NF>1{print \$1\"/\"(NF>2?\$2\"/\":\$2)} NF==1{print \$1}' | sort -u"

sec "Amplify app and branches"
run "aws amplify get-app --app-id $AMP_ID $P --query 'app.[name,repository,defaultDomain,platform]'"
run "aws amplify list-branches --app-id $AMP_ID $P --query 'branches[].[branchName,stage,enableAutoBuild]'"
echo "Amplify app-level environment variable names:" >> "$OUT"
run "aws amplify get-app --app-id $AMP_ID $P --query 'keys(app.environmentVariables || \`{}\`)'"
run "aws amplify list-domain-associations --app-id $AMP_ID $P --query 'domainAssociations[].[domainName,domainStatus]'"

sec "Lambda functions (runtime, handler, env var NAMES)"
for FN in $(aws lambda list-functions $P --query 'Functions[].FunctionName' | tr '\t' '\n' | sort); do
  printf '### %s\n' "$FN" >> "$OUT"
  run "aws lambda get-function-configuration --function-name '$FN' $P --query '[Runtime,Handler,MemorySize,Timeout]'; echo -n 'Env keys: '; aws lambda get-function-configuration --function-name '$FN' $P --query 'keys(Environment.Variables || \`{}\`)'"
done

sec "API Gateway ($API_ID) routes"
run "aws apigatewayv2 get-api --api-id $API_ID $P --query '[Name,ProtocolType,ApiEndpoint]'"
run "aws apigatewayv2 get-routes --api-id $API_ID $P --query 'Items[].[RouteKey,AuthorizationType]' | sort"
run "aws apigatewayv2 get-authorizers --api-id $API_ID $P --query 'Items[].[AuthorizerId,Name,AuthorizerType]'"
run "aws apigatewayv2 get-domain-names $P --query 'Items[].DomainName'"

sec "DynamoDB tables (partition/sort keys)"
for T in $(aws dynamodb list-tables $P --query 'TableNames[]' | tr '\t' '\n'); do
  run "echo '$T'; aws dynamodb describe-table --table-name '$T' $P --query 'Table.[KeySchema[].[AttributeName,KeyType],GlobalSecondaryIndexes[].IndexName]'"
done

sec "RDS instances (if any)"
run "aws rds describe-db-instances $P --query 'DBInstances[].[DBInstanceIdentifier,Engine,DBInstanceClass]'"

sec "Cognito user pools"
run "aws cognito-idp list-user-pools --max-results 20 $P --query 'UserPools[].[Id,Name]'"

sec "S3 buckets"
run "aws s3api list-buckets --profile sixspur --output text --query 'Buckets[].Name'"

sec "CloudFront distributions"
run "aws cloudfront list-distributions --profile sixspur --output text --query 'DistributionList.Items[].[Id,DomainName,join(\`,\`,Aliases.Items || \`[]\`)]'"

sec "EventBridge schedules"
run "aws events list-rules $P --query 'Rules[].[Name,ScheduleExpression,State]'"
run "aws scheduler list-schedules $P --query 'Schedules[].[Name,State]'"

sec "Secrets Manager (names only)"
run "aws secretsmanager list-secrets $P --query 'SecretList[].Name'"

sec "SSM Parameter Store (names only)"
run "aws ssm describe-parameters $P --query 'Parameters[].[Name,Type]'"

sec "Email (SES identities)"
run "aws sesv2 list-email-identities $P --query 'EmailIdentities[].[IdentityName,VerificationStatus]'"

sec "SMS / SNS"
run "aws sns list-topics $P --query 'Topics[].TopicArn'"
run "aws sns get-sms-sandbox-account-status $P"

sec "Route 53"
run "aws route53 list-hosted-zones --profile sixspur --output text --query 'HostedZones[].[Name,Id]'"
run "aws route53domains list-domains --profile sixspur --region us-east-1 --output text --query 'Domains[].[DomainName,AutoRenew,Expiry]'"

sec "ACM certificates"
run "aws acm list-certificates $P --query 'CertificateSummaryList[].[DomainName,Status]'"

sec "IAM users (access to remove/add during handoff)"
run "aws iam list-users --profile sixspur --output text --query 'Users[].[UserName,CreateDate]'"

echo "Wrote $OUT"
