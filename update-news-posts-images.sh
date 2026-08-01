#!/bin/bash
set -e

PROFILE="sixspur"
REGION="us-east-1"
TABLE="news_posts"
CDN="https://d1s8s7aw8vf5zu.cloudfront.net"

update_image() {
  local SLUG=$1
  local IMAGE_PATH=$2
  echo "Updating $SLUG..."
  aws dynamodb update-item \
    --table-name "$TABLE" \
    --key "{\"slug\": {\"S\": \"${SLUG}\"}}" \
    --update-expression "SET #img = :img" \
    --expression-attribute-names '{"#img": "image"}' \
    --expression-attribute-values "{\":img\": {\"S\": \"${CDN}${IMAGE_PATH}\"}}" \
    --profile "$PROFILE" --region "$REGION"
}

update_image "welcome-to-six-spur" "/images/ranch/ranch-dogs-deck-logo.jpg"
update_image "new-arrivals-june-2026" "/images/goats/goat-kid-closeup-portrait.jpg"
update_image "summer-donation-drive" "/images/cattle/cattle-newborn-calf-fence.jpg"

echo "Done. Verify with:"
echo "  aws dynamodb scan --table-name $TABLE --profile $PROFILE --region $REGION --query 'Items[*].{slug:slug.S,image:image.S}'"
