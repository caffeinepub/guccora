# GUCCORA Firebase Setup Guide

Follow these steps to connect your GUCCORA app to a real Firebase database.

---

## Step 1: Create a Firebase Project

1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it anything (e.g., `guccora-mlm`)
4. Disable Google Analytics (optional, click Continue)
5. Click **"Create project"** and wait for it to be ready

---

## Step 2: Enable Firestore Database

1. In your Firebase project, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
4. Select region: **asia-south1 (Mumbai)** — best for India
5. Click **"Enable"**

---

## Step 3: Get Your Firebase Config

1. Click the **gear icon ⚙️** next to "Project Overview" → **"Project settings"**
2. Scroll down to **"Your apps"** section
3. Click **"</>"** (Web) to register a web app
4. Give it any nickname (e.g., `guccora-web`), click **"Register app"**
5. You will see a `firebaseConfig` object — copy it

---

## Step 4: Replace the Config in Your App

Open this file: `src/frontend/src/firebase.ts`

Replace the placeholder config with your real config:

```ts
const firebaseConfig = {
  apiKey: "YOUR_REAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

> ⚠️ Make sure `projectId` is NOT `"guccora-mlm"` (the placeholder) — use your real project ID.

---

## Step 5: Set Firestore Security Rules (for testing)

1. In Firebase Console → **Firestore Database** → **Rules** tab
2. Replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

3. Click **"Publish"**

> ⚠️ These rules allow all reads/writes for testing. Tighten them before going to production.

---

## Step 6: Deploy Cloud Functions (for MLM income)

The MLM income distribution is handled by a Firebase Cloud Function.

To deploy it:

```bash
# Install the Firebase CLI (if not already installed)
npm install -g firebase-tools

# Log in to Firebase
firebase login

# Deploy only the Cloud Functions
firebase deploy --only functions
```

---

## Step 7: Rebuild and Deploy

After saving `firebase.ts`, rebuild your app:

```bash
npm run build
```

All data will now sync to Firestore in real time across all devices.

---

## Troubleshooting

- **"Firebase not configured" banner** — You still have placeholder credentials. Follow Step 4 above.
- **Data not syncing** — Check your Firestore security rules (Step 5).
- **Cloud Function errors** — Make sure you ran `firebase deploy --only functions` (Step 6).
- **App works but data is only on one device** — Firestore is not connected. Follow Steps 1–5.
