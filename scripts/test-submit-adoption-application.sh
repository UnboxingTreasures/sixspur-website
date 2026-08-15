#!/bin/bash
# test-submit-adoption-application.sh
#
# Submits a REAL adoption application against a REAL, currently-available
# animal, via the same public API the live site's form uses -- no browser,
# no fence photos, no fake bypass of validation. Fills in only the fields
# the backend actually requires (see adoptionApplication/index.js's
# handleApply: firstName, lastName, primaryEmail, interestedIn,
# agreedToTerms, agreedToReturn -- everything else there is client-side-
# only validation in the React form).
#
# Usage:
#   ./test-submit-adoption-application.sh
#     -> picks the first available animal automatically
#   ./test-submit-adoption-application.sh <animalId>
#     -> submits for that specific animal instead
#
# After running, the printed applicationId will show up on
# /admin/adoptions with status "Open" -- approve it there to test the
# full Recently Adopted flow (animal should disappear from /adopt and
# appear on /adopt/recently-adopted within a few seconds of approving).

set -e

API_URL="https://vvabeaemg5.execute-api.us-east-1.amazonaws.com"
REQUESTED_ANIMAL_ID="$1"

if [ -z "$REQUESTED_ANIMAL_ID" ]; then
  echo "No animalId given -- picking the first currently-available animal..."
  ANIMAL_JSON=$(curl -s "${API_URL}/adoptable-animals" | python3 -c "
import json, sys
data = json.load(sys.stdin)
animals = data.get('animals', [])
if not animals:
    print('ERROR: no available animals found to test against', file=sys.stderr)
    sys.exit(1)
a = animals[0]
print(json.dumps({'animalId': a['animalId'], 'name': a['name']}))
")
else
  echo "Using requested animalId: $REQUESTED_ANIMAL_ID"
  ANIMAL_JSON=$(curl -s "${API_URL}/adoptable-animals/${REQUESTED_ANIMAL_ID}" | python3 -c "
import json, sys
a = json.load(sys.stdin)
if 'animalId' not in a:
    print(f'ERROR: animal not found: {a}', file=sys.stderr)
    sys.exit(1)
print(json.dumps({'animalId': a['animalId'], 'name': a['name']}))
")
fi

ANIMAL_ID=$(echo "$ANIMAL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['animalId'])")
ANIMAL_NAME=$(echo "$ANIMAL_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['name'])")

echo "Submitting test application for: $ANIMAL_NAME (animalId: $ANIMAL_ID)"

TIMESTAMP=$(date +%s)

RESPONSE=$(curl -s -X POST "${API_URL}/adopt/apply" \
  -H "Content-Type: application/json" \
  -d "{
    \"animalId\": \"${ANIMAL_ID}\",
    \"interestedIn\": \"${ANIMAL_NAME}\",
    \"firstName\": \"Test\",
    \"lastName\": \"Applicant ${TIMESTAMP}\",
    \"primaryEmail\": \"test-applicant+${TIMESTAMP}@sixspurranch.org\",
    \"primaryPhone\": \"555-0100\",
    \"primaryPhoneType\": \"Mobile\",
    \"street\": \"123 Test St\",
    \"city\": \"Texarkana\",
    \"state\": \"TX\",
    \"zip\": \"75501\",
    \"adoptOrFoster\": [\"Adopt\"],
    \"employment\": \"Test employer, test address, 555-0100, 5 years\",
    \"household\": \"2 adults, no children\",
    \"petUse\": \"Companion animal\",
    \"livestockExp\": \"N/A -- test submission\",
    \"keptAt\": \"123 Test St, Texarkana, TX 75501\",
    \"yardFenced\": \"Yes — fully fenced\",
    \"siteVisit\": \"Yes\",
    \"barnRoutine\": \"Test submission -- automated script\",
    \"reliableTransport\": \"Yes\",
    \"careWhenAway\": \"Test submission -- automated script\",
    \"vet\": \"Test Vet Clinic, 555-0100\",
    \"references\": \"Test Ref 1, 555-0101; Test Ref 2, 555-0102; Test Ref 3, 555-0103\",
    \"agreedToTerms\": true,
    \"agreedToReturn\": true,
    \"signature\": \"Test Applicant\"
  }")

echo ""
echo "Response:"
echo "$RESPONSE" | python3 -m json.tool

APPLICATION_ID=$(echo "$RESPONSE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('applicationId',''))" 2>/dev/null || echo "")

if [ -n "$APPLICATION_ID" ]; then
  echo ""
  echo "✅ Application submitted successfully."
  echo "   applicationId: $APPLICATION_ID"
  echo "   Review/approve it at: https://sixspurranch.org/admin/adoptions/${APPLICATION_ID}"
fi
