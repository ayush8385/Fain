# Fain — AI Finance Tracker

Reads bank transaction emails from Gmail, extracts structured data, auto-categorizes spend using a rules engine + LLM fallback, and notifies you via push when a transaction needs review.

## Structure

```
Fain/
├── backend/   Node.js + TypeScript + Express + Prisma (PostgreSQL)
└── app/       React Native 0.86.2 (bare CLI, New Architecture)
```

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + TypeScript + Express + Prisma |
| Database | PostgreSQL |
| Mobile | React Native 0.86.2 (bare CLI, New Architecture) |
| Auth | Google OAuth 2.0 → JWT sessions |
| Email | Gmail API (read-only scope) |
| Real-time | Google Cloud Pub/Sub push → webhook |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Parsing | Rule engine → Learned RE2 patterns → LLM fallback (Anthropic/OpenAI) |

---

## Backend setup

Requires a running PostgreSQL instance (Docker works fine).

```bash
cd backend
cp .env.example .env   # fill in all values — see Environment Variables below
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev            # starts on http://localhost:4000
```

Verify: `curl http://localhost:4000/health` → `{"status":"ok"}`

### Environment variables

Create `backend/.env` with:

```env
DATABASE_URL=          # your postgres connection string

# Google OAuth — create at console.cloud.google.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback

# JWT signing secret — any long random string
JWT_SECRET=

# AES-256-GCM key for encrypting Gmail refresh tokens at rest — 32-byte hex
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TOKEN_ENCRYPTION_KEY=

# LLM parsing fallback — at least one required
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Firebase service account JSON for FCM push notifications (push notifications — see setup below)
FCM_SERVICE_ACCOUNT_JSON=
```

---

## Mobile app setup

```bash
cd app
npm install

# iOS
cd ios && pod install && cd ..
npx react-native run-ios

# Android
npx react-native run-android
```

### iOS deep link
The app uses the `fain://` custom URL scheme for the OAuth callback. It's already registered in `app/ios/App/Info.plist`. No extra configuration needed.

### Known setup notes
- `npm run dev` must be running before launching the app
- On first simulator run after adding native packages, clear DerivedData if you see a TurboModule crash: `rm -rf ~/Library/Developer/Xcode/DerivedData/App-*`
- Google OAuth does not work in the iOS Simulator (Google blocks it). Use the dev token paste field on the Onboarding screen to paste a token obtained from the backend directly, or test on a physical device.

---

## Google Cloud setup (already done for project scan-503220)

These steps are already complete. Documented here for reference if setting up a new project.

1. Enable Gmail API and Pub/Sub API in Google Cloud Console
2. Create OAuth 2.0 credentials (Web application type), add `http://localhost:4000/auth/google/callback` as an authorized redirect URI
3. Create Pub/Sub topic: `gmail-notifications`
4. Grant `gmail-api-push@system.gserviceaccount.com` the `roles/pubsub.publisher` IAM role on the topic
5. Create push subscription `gmail-push-sub` pointing to `https://<your-tunnel-url>/pubsub/gmail`

**Current subscription endpoint:** needs to be updated whenever the tunnel URL changes:
```bash
gcloud pubsub subscriptions modify-push-config gmail-push-sub \
  --push-endpoint="https://<new-url>/pubsub/gmail" \
  --project=scan-503220
```

### Public tunnel (for Pub/Sub webhook)

Cloudflared is blocked on corporate VPN (TLS inspection). Use SSH-based tunnel instead:

```bash
ssh -R 80:localhost:4000 nokey@localhost.run
```

Prints a URL like `https://abc123.lhr.life` — use that as the push subscription endpoint above.

---

## Firebase / FCM setup (pending)

Push notifications are built in the backend but Firebase is not yet configured.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → create or import project `scan-503220`
2. Add iOS app with bundle ID `org.reactjs.native.example.App`
3. Download `GoogleService-Info.plist` → place at `app/ios/App/GoogleService-Info.plist`
4. Project Settings → Service Accounts → Generate new private key → download JSON
5. Paste the entire JSON (minified, one line) as `FCM_SERVICE_ACCOUNT_JSON` in `backend/.env`
6. In the app:
   ```bash
   cd app
   npm install @react-native-firebase/app @react-native-firebase/messaging
   cd ios && pod install
   ```
7. Add permission request + token registration call in the app (request notification permission, get FCM token, POST to `/push/register-device`)

---

## How it works

### Authentication flow
1. App opens `GET /auth/google/url` → redirects user to Google OAuth consent
2. Google redirects to `GET /auth/google/callback?code=...`
3. Backend exchanges code for tokens, encrypts refresh token, upserts user
4. Backend calls `gmail.users.watch()` to register Pub/Sub inbox watch (7-day expiry, auto-renewed by scheduler)
5. Backend redirects to `fain://auth?token=...&email=...`
6. App's Linking handler picks up the deep link, saves session to AsyncStorage

### Transaction ingestion flow
```
Bank email arrives in Gmail
  → Gmail fires Pub/Sub notification to POST /pubsub/gmail
  → Webhook decodes payload, finds user by email
  → pollUserInbox: lists new emails matching transaction query, stages to IngestedEmail table
  → ingestOne (per email):
      1. Rule engine (hardcoded regex for known bank formats)
      2. Learned patterns (RE2 regex learned from past LLM extractions)
      3. LLM fallback (Anthropic/OpenAI with self-consistency check)
      4. categorizeMerchant: matches normalized merchant against user's MerchantCategoryRule
      5. prisma.transaction.create with status auto_categorized or needs_review
      6. If needs_review → FCM push notification to all user's registered devices
```

### Categorization learning
- Default rules seed 11 categories + ~60 merchant→category patterns on first login
- When user confirms or corrects a category via `PATCH /transactions/:id/category`, the backend upserts a `MerchantCategoryRule` (increments `confirmedCount` on match, overrides on correction)
- Future transactions from the same merchant are matched automatically

### Scheduler
Runs daily as a fallback (Pub/Sub handles real-time). Also renews Gmail watches before they expire (renews when < 12 hours remain on a 7-day watch).

---

## API routes

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| GET | `/auth/google/url` | — | Returns OAuth consent URL |
| GET | `/auth/google/callback` | — | OAuth callback, redirects to `fain://` |
| POST | `/ingestion/poll` | JWT | Manually stage new emails (dev/testing) |
| POST | `/ingestion/parse` | JWT | Manually parse staged emails (dev/testing) |
| GET | `/transactions` | JWT | List transactions (`?status=&limit=&offset=`) |
| PATCH | `/transactions/:id/category` | JWT | Set category, learn merchant rule |
| GET | `/categories` | JWT | List global + user categories |
| POST | `/categories` | JWT | Create custom category |
| POST | `/push/register-device` | JWT | Register FCM device token |
| POST | `/pubsub/gmail` | — | Pub/Sub push webhook (Google-signed) |

---

## What's working

- Gmail OAuth login → JWT session → deep link back into app
- Email polling + staging (deduped by Gmail message ID)
- Rule engine + LLM parsing of real bank emails (tested with live transactions)
- Auto-categorization with merchant matching
- Transaction list, category assignment, merchant rule learning
- Pub/Sub webhook handler — built and locally verified
- Daily fallback scheduler + Gmail watch auto-renewal
- App screens: Dashboard, Needs Review, Transaction List, Settings

## What's pending

- **Pub/Sub live**: needs SSH tunnel (`localhost.run`) from a network without TLS inspection, then update push subscription URL
- **FCM push notifications**: needs Firebase project setup (see Firebase setup section above)
- **Physical device testing**: current test device is MDM-blocked from pairing with non-managed computers — simulator only for now
