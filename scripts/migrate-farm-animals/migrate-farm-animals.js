// migrate-farm-animals.js
// ONE-TIME script: seeds the (already-created, currently empty) farm_animals
// DynamoDB table from the current farmAnimals.json + farmAnimalGalleries.json
// content, consolidating the three separately-drifted description copies
// (FarmFamily.tsx, farm-animals/page.tsx, farm-animals/[species]/page.tsx)
// into one canonical `description` field per type.
//
// Run once, locally, from anywhere with AWS credentials for the sixspur
// profile: node migrate-farm-animals.js
//
// Safe to re-run -- uses PutItem per type, which overwrites cleanly rather
// than duplicating or erroring on existing items.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'farm_animals';
const CDN = 'https://d1s8s7aw8vf5zu.cloudfront.net';

// Canonical description per type -- using the longer index/species-page
// wording (the two that already matched each other), with Ranch Dogs using
// the already-corrected version from today's split.
const ANIMALS = [
  {
    animalId: 'cattle',
    name: 'Cattle',
    description: 'Longhorns, mama cows, and calves — our cattle are the backbone of Six Spur. They roam the pasture and remind us every day why this land matters.',
    thumbnailUrl: `${CDN}/images/cattle/cattle-newborn-calf-fence.jpg`,
    photos: [
      `${CDN}/images/cattle/calf-closeup-hay.jpg`,
      `${CDN}/images/cattle/calf-portrait-closeup.jpg`,
      `${CDN}/images/cattle/calf-white-brown-grass.jpg`,
      `${CDN}/images/cattle/cattle-black-calf-pen.jpg`,
      `${CDN}/images/cattle/cattle-newborn-calf-fence.jpg`,
      `${CDN}/images/cattle/cow-black-angus-field.jpg`,
      `${CDN}/images/cattle/cow-brahman-portrait.jpg`,
      `${CDN}/images/cattle/cow-calves-hayrack.jpg`,
      `${CDN}/images/cattle/cow-hayrack-calf.jpg`,
      `${CDN}/images/cattle/cow-longhorn-calf-pen.jpg`,
      `${CDN}/images/cattle/cow-longhorn-haybale.jpg`,
      `${CDN}/images/cattle/cow-mama-calf-grazing.jpg`,
      `${CDN}/images/cattle/cow-mama-calf-nuzzle.jpg`,
      `${CDN}/images/cattle/cow-mama-newborn-field.jpg`,
      `${CDN}/images/cattle/cow-nose-trough.jpg`,
      `${CDN}/images/cattle/cow-nursing-calf.jpg`,
      `${CDN}/images/cattle/cow-pair-resting-field.jpg`,
      `${CDN}/images/cattle/cow-trio-pen-watertrough.jpg`,
      `${CDN}/images/cattle/cow-trio-under-tree.jpg`,
      `${CDN}/images/cattle/cow-white-calf-nursing.jpg`,
    ],
  },
  {
    animalId: 'goats',
    name: 'Goats',
    description: 'Curious, playful, and always getting into something. Our goats bring energy and laughter to the ranch every single day.',
    thumbnailUrl: `${CDN}/images/goats/goat-kid-closeup-portrait.jpg`,
    photos: [
      `${CDN}/images/goats/goat-buck-feeding-trough.jpg`,
      `${CDN}/images/goats/goat-group-playground-ramp.jpg`,
      `${CDN}/images/goats/goat-kid-barrel-feeder.jpg`,
      `${CDN}/images/goats/goat-kid-closeup-portrait.jpg`,
      `${CDN}/images/goats/goat-mama-kids-barn.jpg`,
    ],
  },
  {
    animalId: 'ducks',
    name: 'Ducks',
    description: 'Waddling around the property and keeping everyone entertained — our ducks are a daily delight from sunrise to sundown.',
    thumbnailUrl: `${CDN}/images/ducks/duck-portrait-standing.jpg`,
    photos: [
      `${CDN}/images/ducks/duck-pair-fence.jpg`,
      `${CDN}/images/ducks/duck-portrait-standing.jpg`,
      `${CDN}/images/ducks/duck-trio-waterbowl.jpg`,
    ],
  },
  {
    animalId: 'geese',
    name: 'Geese',
    description: 'The self-appointed welcoming committee of Six Spur. Loud, proud, and impossible to ignore.',
    thumbnailUrl: `${CDN}/images/geese/goose-walking-portrait.jpg`,
    photos: [
      `${CDN}/images/geese/geese-ducks-enclosure.jpg`,
      `${CDN}/images/geese/geese-pair-enclosure.jpg`,
      `${CDN}/images/geese/geese-pair-necks-portrait.jpg`,
      `${CDN}/images/geese/goose-walking-portrait.jpg`,
    ],
  },
  {
    animalId: 'chickens',
    name: 'Chickens',
    description: 'The Breakfast Factory is open year round. Colorful, busy, and endlessly entertaining — our chickens have big personalities for their size.',
    thumbnailUrl: `${CDN}/images/chickens/rooster-black-portrait.jpg`,
    photos: [
      `${CDN}/images/chickens/chicken-breakfast-factory.jpg`,
      `${CDN}/images/chickens/chicken-flock-coop-feeding.jpg`,
      `${CDN}/images/chickens/chicken-group-feeding.jpg`,
      `${CDN}/images/chickens/chicken-speckled-closeup.jpg`,
      `${CDN}/images/chickens/chicken-trio-pecking.jpg`,
      `${CDN}/images/chickens/rooster-black-portrait.jpg`,
    ],
  },
  {
    animalId: 'donkeys',
    name: 'Donkeys',
    description: 'Equal parts stubborn and sweet. Our donkeys will follow you around the pasture all day if you let them.',
    thumbnailUrl: `${CDN}/images/donkeys/donkey-mama-foal-ranch.jpg`,
    photos: [
      `${CDN}/images/donkeys/donkey-closeup-fence-snow.jpg`,
      `${CDN}/images/donkeys/donkey-closeup-portrait-sky.jpg`,
      `${CDN}/images/donkeys/donkey-grey-resting.jpg`,
      `${CDN}/images/donkeys/donkey-mama-foal-ranch.jpg`,
      `${CDN}/images/donkeys/donkey-pair-green-field.jpg`,
      `${CDN}/images/donkeys/donkey-pair-nuzzling-field.jpg`,
      `${CDN}/images/donkeys/donkey-pinto-walking.jpg`,
      `${CDN}/images/donkeys/donkey-portrait.jpg`,
      `${CDN}/images/donkeys/donkey-trio-foal-fenceline.jpg`,
      `${CDN}/images/donkeys/donkey-white-nose-trough.jpg`,
      `${CDN}/images/donkeys/donkey-white-portrait.jpg`,
    ],
  },
  {
    animalId: 'minidonkeys',
    name: 'Mini Donkeys',
    description: 'Small in size, huge in personality. Our mini donkeys are fan favorites with every visitor to the ranch.',
    thumbnailUrl: `${CDN}/images/mini_donkeys/minidonkey-grazing-dry-field.jpg`,
    photos: [
      `${CDN}/images/mini_donkeys/horse-donkey-pair.jpg`,
      `${CDN}/images/mini_donkeys/minidonkey-grazing-dry-field.jpg`,
    ],
  },
  {
    animalId: 'horses',
    name: 'Horses',
    description: "Our paint horses are a beautiful sight on the ranch — graceful, strong, and always curious about what you've got in your pocket.",
    thumbnailUrl: `${CDN}/images/horses/horse-paint-grazing-field.jpg`,
    photos: [
      `${CDN}/images/horses/horse-paint-grazing-field.jpg`,
      `${CDN}/images/horses/horse-paint-minidonkey-fence.jpg`,
    ],
  },
  {
    animalId: 'ranch-dogs',
    name: 'Ranch Dogs',
    description: 'Not every dog at Six Spur is up for adoption. Some are permanent members of the ranch family, keeping watch and keeping things lively.',
    thumbnailUrl: `${CDN}/images/ranch-dogs/ranch-dogs-snow.jpg`,
    photos: [
      `${CDN}/images/ranch-dogs/dog-beagle-jacket.jpg`,
      `${CDN}/images/ranch-dogs/dog-black-standing-alert.jpg`,
      `${CDN}/images/ranch-dogs/dog-brindle-asleep-toys.jpg`,
      `${CDN}/images/ranch-dogs/dog-brindle-hand-interaction.jpg`,
      `${CDN}/images/ranch-dogs/dog-brindle-puppy-lying.jpg`,
      `${CDN}/images/ranch-dogs/dog-doberman-bone-couch.jpg`,
      `${CDN}/images/ranch-dogs/dog-doberman-couch-1.jpg`,
      `${CDN}/images/ranch-dogs/dog-doberman-couch-2.jpg`,
      `${CDN}/images/ranch-dogs/dog-doberman-puppy-toys.jpg`,
      `${CDN}/images/ranch-dogs/dog-hound-chair-cropped.jpg`,
      `${CDN}/images/ranch-dogs/dog-pair-bed-beagle.jpg`,
      `${CDN}/images/ranch-dogs/dog-pair-foodbowl.jpg`,
      `${CDN}/images/ranch-dogs/dog-pair-playing-floor.jpg`,
      `${CDN}/images/ranch-dogs/dog-pair-playing-snow.jpg`,
      `${CDN}/images/ranch-dogs/dog-puppy-porch-shy.jpg`,
      `${CDN}/images/ranch-dogs/dog-shepherd-couch-closeup.jpg`,
      `${CDN}/images/ranch-dogs/dog-shepherd-mix-ranch.jpg`,
      `${CDN}/images/ranch-dogs/dog-spotted-bed-calm.jpg`,
      `${CDN}/images/ranch-dogs/dog-spotted-car.jpg`,
      `${CDN}/images/ranch-dogs/dog-tan-car-soulful.jpg`,
      `${CDN}/images/ranch-dogs/dog-tan-white-bluecollar.jpg`,
      `${CDN}/images/ranch-dogs/dog-trio-playing.jpg`,
      `${CDN}/images/ranch-dogs/ranch-dogs-snow.jpg`,
      `${CDN}/images/ranch-dogs/ranch-dogs-trailer.jpg`,
    ],
  },
];

async function migrate() {
  const now = new Date().toISOString();
  for (const animal of ANIMALS) {
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...animal, createdAt: now, updatedAt: now },
    }));
    console.log(`✓ ${animal.name} (${animal.photos.length} photos)`);
  }
  console.log(`\nDone. ${ANIMALS.length} animal types written to ${TABLE_NAME}.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
