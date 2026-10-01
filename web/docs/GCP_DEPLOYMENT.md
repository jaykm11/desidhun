# Desi Dhun — GCP deployment runbook

This app uses Firebase Hosting for the React UI, Firebase Authentication for
Google and email/password login, Cloud Run for protected generation and billing endpoints,
Firestore for entitlements, and Stripe Checkout/Billing plus PayU Hosted Checkout for INR payments.

The product rules implemented by the API are:

- Free accounts receive **3 prompt generations total**, not per month.
- Creator members receive **500 prompts/year**.
- Pro members receive **300 prompts/month**.
- Studio members receive **1,000 prompts/month**.
- One-time credit packs add **50** or **150** non-expiring prompts.
- Active subscriptions renew automatically through Stripe Billing or PayU mandates.

Do not put service-account JSON, Stripe or PayU secrets, or bank information in this
repository, client environment files, Cloud Build substitutions, or chat.

## 1. Create the GCP and Firebase project

Choose a new production GCP project, link billing, then set its ID:

```bash
export PROJECT_ID="your-production-project-id"
export REGION="us-central1"

gcloud auth login
gcloud config set project "$PROJECT_ID"
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  texttospeech.googleapis.com \
  cloudtasks.googleapis.com
```

In the Firebase console, add Firebase to that same project, then:

1. Register a Web app.
2. Enable **Authentication → Sign-in method → Google** and **Email/Password**.
3. Set the support email and OAuth consent-screen information.
4. Add your production custom domain under **Authentication → Settings →
   Authorized domains** after it is connected.
   If the web app uses `desidhun.net` as its Firebase `authDomain`, also open
   **Google Cloud Console → APIs & Services → Credentials**, select the OAuth
   web client used by Firebase Authentication, and add this exact authorized
   redirect URI:
   `https://desidhun.net/__/auth/handler`
5. Create Firestore in Production mode in a US location.

Deploy the server-only Firestore rules:

```bash
npx firebase-tools login
npx firebase-tools use "$PROJECT_ID"
npx firebase-tools deploy --only firestore:rules
```

## 2. Create the Cloud Run identity and container registry

```bash
gcloud artifacts repositories create deshi-dhun \
  --repository-format=docker \
  --location="$REGION"

gcloud iam service-accounts create deshi-dhun-api \
  --display-name="Desi Dhun Cloud Run API"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:deshi-dhun-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:deshi-dhun-api@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/cloudtasks.enqueuer"

gcloud tasks queues create deshi-dhun-song-render \
  --location="$REGION" \
  --max-concurrent-dispatches=2 \
  --max-dispatches-per-second=2
```

The Cloud Run service verifies Firebase tokens, reads/writes Firestore, and
performs the atomic quota transaction. It also uses Chirp 3 HD for Vocal /
Spoken Word narration. The standard Cloud Text-to-Speech synthesis endpoint
uses its Cloud Run service-account credentials once
`texttospeech.googleapis.com` is enabled; it does not require a separate
Text-to-Speech IAM role. Browser clients are explicitly denied all direct
Firestore access by `firestore.rules`.

## Transactional email

Create a Gmail App Password for `contact.desidhun@gmail.com` (never use the
normal Google-account password), then store it as `desidhun-smtp-app-password`
in Secret Manager. Bind it to Cloud Run as `SMTP_APP_PASSWORD`. The API sends
account welcome/verification confirmation, payment receipts, and membership
cancellation confirmations from this mailbox.

Song rendering is asynchronous: Cloud Tasks authenticates each private worker
request as the Cloud Run service account. Grant its service agent the token
creation permission:

```bash
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
RUNTIME_SA="deshi-dhun-api@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/run.invoker"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloudtasks.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"

gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/iam.serviceAccountUser"
```

## 3. Create the Stripe product

In Stripe Dashboard, create the following INR Prices. Configure recurring
prices as **Subscriptions** and the credit packs as **One time** payments.

| Offer | Price | Stripe environment variable |
| --- | --- | --- |
| Creator yearly | ₹1,699/year | `STRIPE_PRICE_CREATOR_YEARLY` |
| Pro monthly | ₹699/month | `STRIPE_PRICE_PRO_MONTHLY` |
| Pro yearly | ₹5,999/year | `STRIPE_PRICE_PRO_YEARLY` |
| Studio monthly | ₹1,699/month | `STRIPE_PRICE_STUDIO_MONTHLY` |
| Studio yearly | ₹14,999/year | `STRIPE_PRICE_STUDIO_YEARLY` |
| 50-prompt pack | ₹349 once | `STRIPE_PRICE_PACK_50` |
| 150-prompt pack | ₹749 once | `STRIPE_PRICE_PACK_150` |

Copy each resulting Price ID (`price_...`). Enable Stripe's Billing Portal and
test every offer in Stripe test mode before activating live Prices.

Once Cloud Run is deployed, add a Stripe webhook endpoint:

```text
https://YOUR_CLOUD_RUN_URL/api/v1/webhooks/stripe
```

Subscribe it to:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## 4. Store payment credentials in Secret Manager

Create secrets by entering their values interactively; do not paste them into
shell history or source files:

```bash
gcloud secrets create stripe-secret-key --replication-policy=automatic
gcloud secrets create stripe-webhook-secret --replication-policy=automatic
for SECRET in stripe-price-creator-yearly stripe-price-pro-monthly stripe-price-pro-yearly stripe-price-studio-monthly stripe-price-studio-yearly stripe-price-pack-50 stripe-price-pack-150; do
  gcloud secrets create "$SECRET" --replication-policy=automatic
done

gcloud secrets versions add stripe-secret-key --data-file=-
gcloud secrets versions add stripe-webhook-secret --data-file=-
for SECRET in stripe-price-creator-yearly stripe-price-pro-monthly stripe-price-pro-yearly stripe-price-studio-monthly stripe-price-studio-yearly stripe-price-pack-50 stripe-price-pack-150; do
  gcloud secrets versions add "$SECRET" --data-file=-
done
```

Grant only the runtime service account access:

```bash
for SECRET in stripe-secret-key stripe-webhook-secret stripe-price-creator-yearly stripe-price-pro-monthly stripe-price-pro-yearly stripe-price-studio-monthly stripe-price-studio-yearly stripe-price-pack-50 stripe-price-pack-150; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:deshi-dhun-api@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

### PayU India

Create server-only secrets for the PayU merchant key and salt:

```bash
gcloud secrets create payu-merchant-key --replication-policy=automatic
gcloud secrets create payu-merchant-salt --replication-policy=automatic
gcloud secrets versions add payu-merchant-key --data-file=-
gcloud secrets versions add payu-merchant-salt --data-file=-
for SECRET in payu-merchant-key payu-merchant-salt; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --member="serviceAccount:deshi-dhun-api@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

Configure this Cloud Run URL in PayU as both the success and failure callback:

```text
https://YOUR_CLOUD_RUN_URL/api/v1/billing/payu/callback
```

If your PayU account supports server-to-server webhooks, configure:

```text
https://YOUR_CLOUD_RUN_URL/api/v1/webhooks/payu
```

Set `PAYU_CALLBACK_BASE_URL` to `https://YOUR_CLOUD_RUN_URL`; the browser
callback endpoint must go directly to Cloud Run, not Firebase Hosting.

The API verifies PayU's return hash and calls `verify_payment` before
fulfilling any purchase. Start with `PAYU_ENVIRONMENT=test`. Set
`PAYU_SUBSCRIPTIONS_ENABLED=true` only after PayU enables recurring mandates
for this merchant and you have tested a subscription registration and renewal.
Credit packs work without recurring-mandate access.

## 5. Deploy Cloud Run

First replace the `YOUR_FIREBASE_PROJECT` placeholders in `cloudbuild.yaml`
with your Firebase Hosting domain. Build and deploy:

```bash
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_REGION="$REGION",_APP_BASE_URL="https://${PROJECT_ID}.web.app",_ALLOWED_ORIGINS="https://${PROJECT_ID}.web.app"
```

Then attach the secrets to the deployed service:

```bash
gcloud run services update deshi-dhun-api \
  --region="$REGION" \
  --update-secrets=STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,STRIPE_PRICE_CREATOR_YEARLY=stripe-price-creator-yearly:latest,STRIPE_PRICE_PRO_MONTHLY=stripe-price-pro-monthly:latest,STRIPE_PRICE_PRO_YEARLY=stripe-price-pro-yearly:latest,STRIPE_PRICE_STUDIO_MONTHLY=stripe-price-studio-monthly:latest,STRIPE_PRICE_STUDIO_YEARLY=stripe-price-studio-yearly:latest,STRIPE_PRICE_PACK_50=stripe-price-pack-50:latest,STRIPE_PRICE_PACK_150=stripe-price-pack-150:latest,PAYU_MERCHANT_KEY=payu-merchant-key:latest,PAYU_MERCHANT_SALT=payu-merchant-salt:latest \
  --update-env-vars=PAYU_ENVIRONMENT=test,PAYU_SUBSCRIPTIONS_ENABLED=false
```

Get its public URL:

```bash
gcloud run services describe deshi-dhun-api \
  --region="$REGION" \
  --format='value(status.url)'
```

## 6. Build and deploy the frontend

Create an ignored `.env.production` from `.env.example`, using the Firebase web
configuration from Firebase Console and the Cloud Run URL:

```dotenv
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL
```

Then deploy:

```bash
npm ci
npm run build
npx firebase-tools deploy --only hosting --project "$PROJECT_ID"
```

After choosing a custom domain, update `APP_BASE_URL` and `ALLOWED_ORIGINS` on
Cloud Run, add it to Firebase Auth's authorized domains, and rebuild/redeploy
the frontend with the correct API URL.

## 7. Required acceptance tests

Run these in Stripe and PayU test modes:

1. New Google or email/password account can sign in and sees `3 of 3 lifetime prompts remaining`.
2. Generate three prompts; confirm the counts are 2, 1, then 0.
3. A fourth request returns `FREE_PROMPT_LIMIT_REACHED`; confirm it does not
   write a fourth generation event.
4. Complete each subscription Checkout; Stripe webhook changes the Firestore
   user document to the correct plan with its initial credit allowance.
5. Complete each one-time credit pack Checkout; confirm its credits are added
   exactly once, including after a webhook replay.
6. Generate through a subscription allowance, then confirm a credit-pack
   balance is used only after that allowance is exhausted.
7. Cancel through Billing Portal; use Stripe's test clock/event simulation to
   confirm access ends when the paid period ends.
8. Replay each webhook from Stripe Dashboard; the final entitlement must remain
   correct.
9. Confirm unauthenticated API calls return `401` and direct Firestore calls
   are denied.
10. Complete a PayU credit-pack checkout; confirm the verified callback grants
    credits once, then replay its callback to confirm no duplicate credits.
11. Once mandates are enabled, test every PayU membership registration,
    renewal, failed renewal, cancellation, and invalid callback hash before
    enabling the production PayU environment.

## Backup and operations

The workspace has an initialized local Git repository. Add a private GitHub,
GitLab, or Cloud Source Repositories remote before the first production deploy:

```bash
git remote add origin YOUR_PRIVATE_REMOTE_URL
git add .
git commit -m "Initial Desi Dhun application"
git push -u origin main
```

Set a GCP budget alert, enable Cloud Run and Firestore logs, and schedule
versioned Firestore exports to a restricted GCS backup bucket. A production
release should use separate dev and production GCP projects.
