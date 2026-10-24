# Six Spur Ranch & Rescue — Live Infrastructure Inventory

Generated 2026-10-24 13:45 CDT from AWS account 658965339779, region us-east-1.
Names and keys only. **No secret values are included.** Companion to the Developer Handoff Guide (PDF).

## Repository

```
origin	https://github.com/UnboxingTreasures/sixspur-website.git (fetch)
origin	https://github.com/UnboxingTreasures/sixspur-website.git (push)

* main
  remotes/origin/main

Last commit: e223355 2026-09-15 Fix adminFarmAnimals deploy.sh: include adminAuth.js in zip (was missing, broke Lambda on redeploy)
```

## Repository layout (top two levels)

```
.gitignore
add-dmarc-record.sh
AGENTS.md
assets-bucket-cors.json
billing-alert/billing-budget.json
billing-alert/billing-notifications.json
billing-alert/setup-billing-alert.sh
CLAUDE.md
clear-adoption-s3.sh
clear-contact-messages.sh
create-cloudfront-distribution.sh
create-tables.sh
eslint.config.mjs
find-paypal-creds.sh
fix-donate-links.sh
lambda/adminAdoptableAnimals/
lambda/adminAdoptions/
lambda/adminDonations/
lambda/adminFarmAnimals/
lambda/adminFundraisers/
lambda/adminInbox/
lambda/adminNewsletter/
lambda/adminOrders/
lambda/adminRecurringDonations/
lambda/adminShop/
lambda/adminSmsRecipients/
lambda/adminStaff/
lambda/adminUserAccess/
lambda/adoptableAnimals/
lambda/adoptionApplication/
lambda/contactForm/
lambda/donate-recurring-webhook/
lambda/donate-recurring/
lambda/donate/
lambda/donors/
lambda/expireOrderReservations/
lambda/farmAnimals/
lambda/fundraisers/
lambda/news/
lambda/newsletter/
lambda/orders/
lambda/processIncomingEmail/
lambda/refreshFacebookTokens/
lambda/shop/
lambda/social/
lambda/staff/
next.config.ts
package-lock.json
package.json
postcss.config.mjs
public/file.svg
public/globe.svg
public/next.svg
public/vercel.svg
public/window.svg
README.md
remove-departed-staff-photos.sh
restructure-admin.sh
scripts/contact-messages-cleanup/
scripts/data-cleanup/
scripts/migrate-farm-animals/
scripts/migrate-shop/
scripts/migrate-staff/
scripts/recurring-donations-setup/
scripts/test-submit-adoption-application.sh
setup-s3-assets.sh
src/app/
src/components/
src/context/
src/data/
src/lib/
src/types/
tailwind.config.ts
test-scripts/test-fence-photo.jpg
test-scripts/test-submit-application.sh
tsconfig.json
update-news-posts-images.sh
```

## Amplify app and branches

```
sixspur-website	https://github.com/UnboxingTreasures/sixspur-website	d3u4k69gjq52xt.amplifyapp.com	WEB_COMPUTE
```
```
main	PRODUCTION	True
```
Amplify app-level environment variable names:
```
NEXT_PUBLIC_API_URL	NEXT_PUBLIC_COGNITO_CLIENT_ID	NEXT_PUBLIC_COGNITO_USER_POOL_ID	NEXT_PUBLIC_PAYPAL_CLIENT_ID
```
```
sixspurranch.net	AVAILABLE
sixspurranch.org	AVAILABLE
```

## Lambda functions (runtime, handler, env var NAMES)

### sixspur-admin-recurring-donations
```
nodejs20.x	index.handler	256	15
Env keys: RECURRING_DONATIONS_TABLE	DONORS_TABLE
```
### sixspur-adminAdoptableAnimals
```
nodejs20.x	index.handler	256	15
Env keys: ASSETS_BUCKET	CDN_BASE	ADOPTABLE_ANIMALS_TABLE
```
### sixspur-adminAdoptions
```
nodejs20.x	index.handler	256	15
Env keys: ADOPTION_PDF_BUCKET	ADOPTION_APPLICATIONS_TABLE	ADOPTION_UPLOADS_BUCKET	SES_NOREPLY_ADDRESS
```
### sixspur-adminDonations
```
nodejs20.x	index.handler	256	10
Env keys: PAYPAL_MODE	DONATIONS_TABLE
```
### sixspur-adminFarmAnimals
```
nodejs20.x	index.handler	256	20
Env keys: ASSETS_BUCKET	CDN_BASE	FARM_ANIMALS_TABLE
```
### sixspur-adminFundraisers
```
nodejs20.x	index.handler	256	15
Env keys: DONATIONS_TABLE	FUNDRAISERS_TABLE
```
### sixspur-adminInbox
```
nodejs20.x	index.handler	256	15
Env keys: CONTACT_MESSAGES_TABLE	ADOPTION_PDF_BUCKET	SES_ADMIN_ADDRESS
```
### sixspur-adminNewsletter
```
nodejs20.x	index.handler	256	10
Env keys: SITE_URL
```
### sixspur-adminOrders
```
nodejs20.x	index.handler	256	15
Env keys: PAYPAL_MODE
```
### sixspur-adminShop
```
nodejs20.x	index.handler	256	15
Env keys: ASSETS_BUCKET	CDN_BASE	SHOP_ITEMS_TABLE
```
### sixspur-adminSmsRecipients
```
nodejs20.x	index.handler	256	10
Env keys: SMS_RECIPIENTS_TABLE	DONORS_TABLE
```
### sixspur-adminStaff
```
nodejs20.x	index.handler	256	15
Env keys: ASSETS_BUCKET	CDN_BASE	STAFF_TABLE
```
### sixspur-adminUserAccess
```
nodejs20.x	index.handler	256	10
Env keys: DONORS_TABLE
```
### sixspur-adoptableAnimals
```
nodejs20.x	index.handler	256	10
Env keys: ADOPTABLE_ANIMALS_TABLE
```
### sixspur-adoptionApplication
```
nodejs20.x	index.handler	512	30
Env keys: ADOPTION_PDF_BUCKET	ADOPTION_APPLICATIONS_TABLE	SES_ADMIN_ADDRESS	ADOPTION_UPLOADS_BUCKET	SES_NOREPLY_ADDRESS
```
### sixspur-donate
```
nodejs20.x	index.handler	256	15
Env keys: SES_FROM_ADDRESS	PAYPAL_MODE	DONATIONS_TABLE	FUNDRAISERS_TABLE	ASSETS_BUCKET	CDN_BASE	PAYPAL_SECRET_NAME	SMS_RECIPIENTS
```
### sixspur-donate-recurring
```
nodejs20.x	index.handler	256	15
Env keys: PLAN_ID_20	PAYPAL_MODE	PLAN_ID_10	RECURRING_DONATIONS_TABLE	PAYPAL_SECRET_NAME	PLAN_ID_5	SITE_URL
```
### sixspur-donate-recurring-webhook
```
nodejs20.x	index.handler	256	15
Env keys: SES_FROM_ADDRESS	PAYPAL_MODE	DONATIONS_TABLE	RECURRING_DONATIONS_TABLE	ASSETS_BUCKET	CDN_BASE	PAYPAL_WEBHOOK_ID	PAYPAL_SECRET_NAME
```
### sixspur-donors
```
nodejs20.x	index.handler	256	10
Env keys: DONATIONS_TABLE	DONORS_TABLE
```
### sixspur-expireOrderReservations
```
nodejs20.x	index.handler	256	60
Env keys: ORDERS_TABLE	SHOP_ITEMS_TABLE
```
### sixspur-farmAnimals
```
nodejs20.x	index.handler	256	10
Env keys: FARM_ANIMALS_TABLE
```
### sixspur-fundraisers
```
nodejs20.x	index.handler	256	10
Env keys: DONATIONS_TABLE	FUNDRAISERS_TABLE
```
### sixspur-news
```
nodejs20.x	index.handler	256	10
Env keys: NEWS_POSTS_TABLE	ASSETS_BUCKET	CDN_BASE
```
### sixspur-newsletter
```
nodejs20.x	index.handler	256	10
Env keys: SUBSCRIBERS_TABLE
```
### sixspur-orders
```
nodejs20.x	index.handler	256	15
Env keys: ORDERS_TABLE	PAYPAL_MODE	SHIPPING_FLAT_RATE	SHOP_ITEMS_TABLE	COGNITO_CLIENT_ID	COGNITO_USER_POOL_ID	PAYPAL_SECRET_NAME	SMS_RECIPIENTS
```
### sixspur-postToFacebook
```
nodejs20.x	postToFacebook.handler	256	30
Env keys: ```
### sixspur-postToInstagram
```
nodejs20.x	postToInstagram.handler	256	60
Env keys: ```
### sixspur-processIncomingEmail
```
nodejs20.x	index.handler	256	30
Env keys: CONTACT_MESSAGES_TABLE	INCOMING_MAIL_BUCKET	IGNORED_SENDER_ADDRESSES	SMS_RECIPIENTS	SYSTEM_SENDER_ADDRESSES
```
### sixspur-refresh-facebook-tokens
```
nodejs20.x	index.handler	128	15
Env keys: ```
### sixspur-saveContactMessage
```
nodejs20.x	index.handler	256	15
Env keys: CONTACT_MESSAGES_TABLE	RICHARD_PHONE_NUMBER	SES_ADMIN_ADDRESS	SES_NOREPLY_ADDRESS	SMS_RECIPIENTS
```
### sixspur-shop
```
nodejs20.x	index.handler	256	10
Env keys: SHOP_ITEMS_TABLE
```
### sixspur-social-presignedUrl
```
nodejs20.x	presignedUrl.handler	256	15
Env keys: ```
### sixspur-staff
```
nodejs20.x	index.handler	256	10
Env keys: STAFF_TABLE
```

## API Gateway (vvabeaemg5) routes

```
sixspur-api	HTTP	https://vvabeaemg5.execute-api.us-east-1.amazonaws.com
```
```
DELETE /admin/adoptable-animals/{id}	JWT
DELETE /admin/adoptable-animals/{id}/photos	JWT
DELETE /admin/animals/{id}	JWT
DELETE /admin/animals/{id}/photos	JWT
DELETE /admin/inbox/{id}	JWT
DELETE /admin/news/{slug}	JWT
DELETE /admin/news/comments/{id}	JWT
DELETE /admin/newsletter/photo	JWT
DELETE /admin/shop/{id}	JWT
DELETE /admin/shop/{id}/photos	JWT
DELETE /admin/staff/{id}	JWT
DELETE /admin/user-access/{id}	JWT
GET /admin/adoptable-animals	JWT
GET /admin/adoptable-animals/{id}	JWT
GET /admin/adoptions	JWT
GET /admin/adoptions/{id}	JWT
GET /admin/animals	JWT
GET /admin/animals/{id}	JWT
GET /admin/donations	JWT
GET /admin/donations/{id}	JWT
GET /admin/fundraisers	JWT
GET /admin/fundraisers/{id}	JWT
GET /admin/inbox	JWT
GET /admin/inbox/{id}	JWT
GET /admin/news	JWT
GET /admin/news/{slug}	JWT
GET /admin/newsletter/subscribers	JWT
GET /admin/orders	JWT
GET /admin/orders/{id}	JWT
GET /admin/recurring-donations	JWT
GET /admin/recurring-donations/{id}	JWT
GET /admin/shop	JWT
GET /admin/shop-settings	JWT
GET /admin/shop/{id}	JWT
GET /admin/sms-recipients	JWT
GET /admin/staff	JWT
GET /admin/staff/{id}	JWT
GET /admin/user-access	JWT
GET /adoptable-animals	NONE
GET /adoptable-animals/{id}	NONE
GET /adoptable-animals/recently-adopted	NONE
GET /api/newsletter/unsubscribe	NONE
GET /donate/recurring/mine	JWT
GET /donor/donations	JWT
GET /donor/donations/{id}	JWT
GET /donor/profile	JWT
GET /farm-animals	NONE
GET /farm-animals/{id}	NONE
GET /fundraisers/active	NONE
GET /news	NONE
GET /news/{slug}	NONE
GET /news/{slug}/comments	NONE
GET /orders/mine	JWT
GET /shop	NONE
GET /shop-settings	NONE
GET /shop/{id}	NONE
GET /staff	NONE
PATCH /admin/adoptable-animals/{id}	JWT
PATCH /admin/adoptable-animals/{id}/thumbnail	JWT
PATCH /admin/adoptions/{id}	JWT
PATCH /admin/animals/{id}	JWT
PATCH /admin/animals/{id}/thumbnail	JWT
PATCH /admin/donations/{id}	JWT
PATCH /admin/fundraisers/{id}	JWT
PATCH /admin/inbox/{id}/read	JWT
PATCH /admin/inbox/{id}/replied	JWT
PATCH /admin/inbox/{id}/restore	JWT
PATCH /admin/news/{slug}	JWT
PATCH /admin/orders/{id}	JWT
PATCH /admin/shop-settings	JWT
PATCH /admin/shop/{id}	JWT
PATCH /admin/shop/{id}/thumbnail	JWT
PATCH /admin/staff/{id}	JWT
PATCH /donor/profile	JWT
POST /admin/adoptable-animals	JWT
POST /admin/adoptable-animals/{id}/photos	JWT
POST /admin/adoptable-animals/{id}/photos/presign	JWT
POST /admin/animals	JWT
POST /admin/animals/{id}/photos	JWT
POST /admin/animals/{id}/photos/presign	JWT
POST /admin/donations/{id}/refund	JWT
POST /admin/fundraisers	JWT
POST /admin/fundraisers/{id}/archive	JWT
POST /admin/fundraisers/{id}/begin	JWT
POST /admin/fundraisers/{id}/stop	JWT
POST /admin/inbox/{id}/reply	JWT
POST /admin/inbox/batch	JWT
POST /admin/news	JWT
POST /admin/news/photo/presign	JWT
POST /admin/newsletter/photo/presign	JWT
POST /admin/newsletter/send	JWT
POST /admin/orders/{id}/refund	JWT
POST /admin/shop	JWT
POST /admin/shop/{id}/photos	JWT
POST /admin/shop/{id}/photos/presign	JWT
POST /admin/sms-recipients	JWT
POST /admin/sms-recipients/remove	JWT
POST /admin/sms-recipients/verify	JWT
POST /admin/social/post-to-facebook	JWT
POST /admin/social/post-to-instagram	JWT
POST /admin/social/presigned-url	JWT
POST /admin/staff	JWT
POST /admin/staff/{id}/photo/presign	JWT
POST /admin/user-access	JWT
POST /adopt/apply	NONE
POST /adopt/photos/presign	NONE
POST /api/newsletter	NONE
POST /contact	NONE
POST /donate/capture-order	JWT
POST /donate/create-order	JWT
POST /donate/recurring/cancel	JWT
POST /donate/recurring/create-subscription	JWT
POST /news/{slug}/comments	JWT
POST /orders/capture-order	NONE
POST /orders/create-order	NONE
POST /webhooks/paypal-recurring	NONE
```
```
gyxmij	sixspur-donor-jwt-authorizer	JWT
```
```
```

## DynamoDB tables (partition/sort keys)

```
adoptable_animals
animalId	HASH
status-index
```
```
adoption_applications
applicationId	HASH
status-index
```
```
blog_comments
commentId	HASH
slug-index
```
```
contact_messages
messageId	HASH
emailMessageId-index	threadId-index	fromEmail-index
```
```
donations
donationId	HASH
donorId-index
```
```
donors
donorId	HASH
email-index
```
```
farm_animals
animalId	HASH
species-index
```
```
fundraisers
None
fundraiserId	HASH
```
```
news_posts
slug	HASH
category-index	published-index
```
```
orders
orderId	HASH
donorId-index
```
```
recurring_donations
subscriptionId	HASH
donorId-index
```
```
shop_items
None
itemId	HASH
```
```
shop_settings
None
settingId	HASH
```
```
sms_recipients
None
phoneNumber	HASH
```
```
staff_members
None
staffId	HASH
```
```
subscribers
None
email	HASH
```

## RDS instances (if any)

```
```

## Cognito user pools

```
us-east-1_qsB7VcPxi	sixspur-donors
```

## S3 buckets

```
sixspurranch-adoption-pdfs	sixspurranch-adoption-uploads	sixspurranch-assets	sixspurranch-incoming-mail
```

## CloudFront distributions

```
E24AT1CGF54EU6	d1s8s7aw8vf5zu.cloudfront.net	
```

## EventBridge schedules

```
sixspur-expireOrderReservations-schedule	rate(5 minutes)	ENABLED
sixspur-refresh-facebook-tokens-schedule	rate(30 days)	ENABLED
```
```
```

## Secrets Manager (names only)

```
sixspur/meta-api	sixspur/paypal-api
```

## SSM Parameter Store (names only)

```
```

## Email (SES identities)

```
sixspurranch.org	SUCCESS
jaylefler1974@gmail.com	SUCCESS
```

## SMS / SNS

```
```
```
False
```

## Route 53

```
sixspurranch.org.	/hostedzone/Z06493211H957UF7Y6B5V
sixspurranch.net.	/hostedzone/Z00138553VIFU3KIRM1XM
```
```
sixspurranch.net	True	2027-06-22T12:44:46-05:00
sixspurranch.org	True	2030-02-28T17:25:09-06:00
```

## ACM certificates

```
```

## IAM users (access to remove/add during handoff)

```
jlefler	2026-06-21T17:40:52+00:00
```
