// sns.js
// Wraps SNS's SMS Sandbox APIs. This is the same OTP verification flow
// Jay was previously running by hand in the AWS console -- this Lambda
// just puts a UI in front of it. Once SNS sandbox exit is approved
// account-wide, these verification calls become unnecessary (any number
// can receive texts), but this module keeps working either way since
// AWS doesn't remove the sandbox APIs when an account graduates out of
// sandbox mode, they just always succeed trivially.

const {
  SNSClient,
  CreateSMSSandboxPhoneNumberCommand,
  VerifySMSSandboxPhoneNumberCommand,
  ListSMSSandboxPhoneNumbersCommand,
  DeleteSMSSandboxPhoneNumberCommand,
} = require('@aws-sdk/client-sns');

const sns = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });

/** Triggers SNS to text a one-time verification code to this number. */
async function addSandboxNumber(phoneNumber) {
  await sns.send(new CreateSMSSandboxPhoneNumberCommand({ PhoneNumber: phoneNumber, LanguageCode: 'en-US' }));
}

/** Submits the code the person received via text. */
async function verifySandboxNumber(phoneNumber, code) {
  await sns.send(new VerifySMSSandboxPhoneNumberCommand({ PhoneNumber: phoneNumber, OneTimePassword: code }));
}

/** Returns every sandbox number and its live status (Pending / Verified). */
async function listSandboxNumbers() {
  const numbers = [];
  let NextToken;
  do {
    const result = await sns.send(new ListSMSSandboxPhoneNumbersCommand({ NextToken }));
    numbers.push(...(result.PhoneNumbers || []));
    NextToken = result.NextToken;
  } while (NextToken);
  return numbers;
}

async function deleteSandboxNumber(phoneNumber) {
  await sns.send(new DeleteSMSSandboxPhoneNumberCommand({ PhoneNumber: phoneNumber }));
}

module.exports = { addSandboxNumber, verifySandboxNumber, listSandboxNumbers, deleteSandboxNumber };
