#!/bin/bash
set -e

# Submits a complete test adoption application directly against the API —
# no need to fill out the browser form by hand. Requires a test photo at
# the path below (a placeholder is provided alongside this script).

API_URL="https://vvabeaemg5.execute-api.us-east-1.amazonaws.com"
PHOTO_PATH="./test-fence-photo.jpg"

if [ ! -f "$PHOTO_PATH" ]; then
  echo "ERROR: $PHOTO_PATH not found. Place a test JPG/PNG next to this script, or edit PHOTO_PATH."
  exit 1
fi

TIMESTAMP=$(date +%s)
ANIMAL_NAME="TestAnimal-${TIMESTAMP}"

echo "Step 1: Requesting presigned upload URL..."
PRESIGN_RESPONSE=$(curl -s -X POST "${API_URL}/adopt/photos/presign" \
  -H "Content-Type: application/json" \
  -d "{\"fileNames\":[\"test-fence-photo.jpg\"]}")

APPLICATION_ID=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['applicationId'])")
UPLOAD_URL=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['uploads'][0]['uploadUrl'])")
PHOTO_KEY=$(echo "$PRESIGN_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['uploads'][0]['key'])")

echo "  applicationId: $APPLICATION_ID"
echo "  photoKey: $PHOTO_KEY"

echo "Step 2: Uploading test photo to S3..."
curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@${PHOTO_PATH}" \
  -o /dev/null -w "  Upload status: %{http_code}\n"

echo "Step 3: Submitting application..."
APPLY_RESPONSE=$(curl -s -X POST "${API_URL}/adopt/apply" \
  -H "Content-Type: application/json" \
  -d @- << PAYLOAD
{
  "applicationId": "${APPLICATION_ID}",
  "firstName": "Test",
  "lastName": "Applicant",
  "partner": "",
  "street": "123 Test Ranch Rd",
  "apt": "",
  "city": "Maud",
  "state": "Texas",
  "county": "Bowie",
  "zip": "75567",
  "primaryPhone": "8135550100",
  "primaryPhoneType": "Mobile",
  "secondaryPhone": "",
  "secondaryPhoneType": "",
  "primaryEmail": "jaylefler1974@gmail.com",
  "secondaryEmail": "",
  "interestedIn": "${ANIMAL_NAME}",
  "adoptOrFoster": ["Adopt"],
  "employment": "Self-employed, Test Ranch LLC, 5 years",
  "household": "2 adults, no children",
  "childrenAges": "",
  "otherPets": ["We have one or more dog(s)"],
  "otherPetsDetail": "1 dog",
  "topics": ["Feeding this pet", "Finding a veterinarian"],
  "petUse": "Companion animal",
  "livestockExp": "5 years, cattle and goats",
  "keptAt": "123 Test Ranch Rd, Maud, TX 75567",
  "yardFenced": "Yes — fully fenced",
  "fencePhotoCount": 1,
  "fencePhotoKeys": ["${PHOTO_KEY}"],
  "siteVisit": "Yes",
  "barnRoutine": "Fed twice daily, turned out at dawn, checked at dusk",
  "reliableTransport": "Yes",
  "careWhenAway": "Neighbor covers care when we travel",
  "vet": "Dr. Smith, Maud Veterinary Clinic, 903-555-0100, 5 years",
  "references": "Jane Doe, 903-555-0101, jane@example.com; John Roe, 903-555-0102, john@example.com; Pat Lee, 903-555-0103, pat@example.com",
  "additional": "This is an automated test submission.",
  "agreedToTerms": true,
  "agreedToReturn": true,
  "signature": "Test Applicant"
}
PAYLOAD
)

echo "$APPLY_RESPONSE" | python3 -m json.tool

echo ""
echo "Done. Application submitted for '${ANIMAL_NAME}' — search the admin inbox for that subject to find it."
