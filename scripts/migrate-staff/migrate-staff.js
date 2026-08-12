// migrate-staff.js
// ONE-TIME script: seeds the brand-new staff_members table from the
// current team.json content. The "duties" field from team.json is
// intentionally dropped -- the client decided to simplify to just
// name/title/image/bio, no bulleted duties list.
//
// Run once, locally: node migrate-staff.js
// Safe to re-run -- PutItem overwrites cleanly rather than duplicating.

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'us-east-1' });
const ddb = DynamoDBDocumentClient.from(client);

const TABLE_NAME = 'staff_members';
const CDN = 'https://d1s8s7aw8vf5zu.cloudfront.net';

const STAFF = [
  {
    staffId: 'richard',
    name: 'Richard McGuire',
    title: 'Founder & Ranch Manager',
    bio: 'Placeholder bio — awaiting from client.',
    imageUrl: `${CDN}/images/team/richard-mcguire.jpg`,
  },
  {
    staffId: 'lillie',
    name: 'Lillie Brian',
    title: 'Ranch Apprentice',
    bio: 'Placeholder bio — awaiting from client.',
    imageUrl: `${CDN}/images/team/lillie-brian.jpg`,
  },
  {
    staffId: 'lisa',
    name: 'Lisa Brian',
    title: 'Ranch Caretaker',
    bio: 'Placeholder bio — awaiting from client.',
    imageUrl: `${CDN}/images/team/lisa-brian.jpg`,
  },
  {
    staffId: 'jay',
    name: 'Jay Lefler',
    title: 'Digital Marketing Manager',
    bio: 'Placeholder bio — awaiting from client.',
    imageUrl: `${CDN}/images/team/jay-lefler.jpg`,
  },
];

async function migrate() {
  const now = new Date().toISOString();
  for (const member of STAFF) {
    await ddb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: { ...member, createdAt: now, updatedAt: now },
    }));
    console.log(`✓ ${member.name}`);
  }
  console.log(`\nDone. ${STAFF.length} staff members written to ${TABLE_NAME}.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
