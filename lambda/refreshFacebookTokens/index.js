// refreshFacebookTokens.js — Refreshes Six Spur's Facebook long-lived user token
// AND re-derives the Page access token from it, in one run.
// Triggered by EventBridge every 30 days.
// Runs OUTSIDE VPC — needs outbound internet access to graph.facebook.com
//
// Secret: sixspur/meta-api
// Required keys before first run: facebook_page_id, instagram_business_account_id,
//   app_id, app_secret, facebook_user_token (seeded manually once via Graph API Explorer)
// Keys this Lambda writes/updates: facebook_user_token, facebook_page_token

const { SecretsManagerClient, GetSecretValueCommand, UpdateSecretCommand } = require("@aws-sdk/client-secrets-manager");
const https = require("https");

const SECRET_ID = "sixspur/meta-api";
const GRAPH_VERSION = "v19.0";

const secretsClient = new SecretsManagerClient({ region: "us-east-1" });

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    }).on("error", reject);
  });
}

exports.handler = async () => {
  console.log("refreshFacebookTokens: starting");

  // 1. Read current secret values
  const getRes = await secretsClient.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  const secret = JSON.parse(getRes.SecretString);

  const { facebook_user_token, facebook_page_id, app_id, app_secret } = secret;

  if (!facebook_user_token || !facebook_page_id || !app_id || !app_secret) {
    throw new Error(
      "Missing one of facebook_user_token, facebook_page_id, app_id, app_secret in secret " + SECRET_ID
    );
  }

  // 2. Exchange the current long-lived user token for a fresh long-lived user token.
  //    This is what actually resets the 60-day clock.
  const exchangeUrl =
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(app_id)}` +
    `&client_secret=${encodeURIComponent(app_secret)}` +
    `&fb_exchange_token=${encodeURIComponent(facebook_user_token)}`;

  const exchangeRes = await httpsGet(exchangeUrl);

  if (exchangeRes.statusCode !== 200 || !exchangeRes.body.access_token) {
    console.error("Facebook user token exchange failed:", JSON.stringify(exchangeRes.body));
    throw new Error(`Failed to refresh user token: ${exchangeRes.body?.error?.message ?? "unknown error"}`);
  }

  const newUserToken = exchangeRes.body.access_token;
  const expiresInDays = Math.round((exchangeRes.body.expires_in || 5184000) / 86400);
  console.log(`refreshFacebookTokens: new user token received, expires in ~${expiresInDays} days`);

  // 3. Derive the Page access token from the freshly renewed user token.
  const pageUrl =
    `https://graph.facebook.com/${GRAPH_VERSION}/${facebook_page_id}` +
    `?fields=access_token&access_token=${encodeURIComponent(newUserToken)}`;

  const pageRes = await httpsGet(pageUrl);

  if (pageRes.statusCode !== 200 || !pageRes.body.access_token) {
    console.error("Facebook page token derivation failed:", JSON.stringify(pageRes.body));
    throw new Error(`Failed to derive page token: ${pageRes.body?.error?.message ?? "unknown error"}`);
  }

  const newPageToken = pageRes.body.access_token;
  console.log("refreshFacebookTokens: new page token derived");

  // 4. Write both new tokens back to Secrets Manager, preserving all other keys.
  await secretsClient.send(
    new UpdateSecretCommand({
      SecretId: SECRET_ID,
      SecretString: JSON.stringify({
        ...secret,
        facebook_user_token: newUserToken,
        facebook_page_token: newPageToken,
      }),
    })
  );

  console.log("refreshFacebookTokens: secret updated successfully ✅");
  return { success: true, userTokenExpiresInDays: expiresInDays };
};
