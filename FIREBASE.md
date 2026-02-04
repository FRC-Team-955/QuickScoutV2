# Firebase Setup & Usage Guide

This document explains how to **open**, **configure**, and **use Firebase** for the **QuickScoutV2** project. It is written so new contributors can get set up quickly and safely.

---

## 1. Opening the Project

1. Go to the **Firebase Console**: https://console.firebase.google.com/
2. Sign in with the Google account that has access to the project.
3. Click on the project named **QuickScoutV2**.

You should land on the Firebase project overview page, which looks similar to the screenshot below:

![Firebase Project Overview](https://cdn.discordapp.com/attachments/1342992377480220743/1468437484298830009/Screenshot_2026-02-03_at_6.45.47_PM.png?ex=6984047a&is=6982b2fa&hm=7a83676a0da85f0c558603e85e8b16cdb14d1ff6e77c9ae8e0f7c368cfda2e67&)

---

## 2. Firebase Services Used

QuickScoutV2 uses the following Firebase services:

- **Authentication** – Handles user sign-in and access control
- **Cloud Firestore** – Stores scouting data in real time
- **Security Rules** – Protects data from unauthorized access
- **Hosting (optional)** – Deploys the web app

---

## 3. Authentication

### 3.1 Enabling Authentication

1. In the left sidebar, click **Build → Authentication**.
2. Click **Get started** (if Authentication is not already enabled).
3. Open the **Sign-in method** tab.
4. Enable the authentication providers your app needs (commonly):
   - **Email / Password**
   - **Google** (recommended for fast sign-in)
5. Click **Save** after enabling each provider.

### 3.2 How Authentication Is Used in the App

- Users must be signed in to submit or view scouting data.
- The app reads the authenticated user’s UID to:
  - Identify who submitted data
  - Enforce permissions in Firestore rules

### 3.3 Common Auth Actions (Conceptual)

- **Sign in**: User logs in via Google or email/password
- **Sign out**: Clears local auth state
- **Auth state listener**: Detects whether a user is logged in on page refresh

---

## 4. Cloud Firestore (Database)

### 4.1 Opening Firestore

1. In the Firebase sidebar, click **Build → Firestore Database**.
2. Click **Create database** if it is not already created.
3. Choose:
   - **Production mode** (recommended)
   - A region closest to users

### 4.2 Firestore Data Model (Recommended)

Firestore stores data in **collections** and **documents**.

Example structure:

```
users/
  {userId}
    name: string
    role: "scout" | "admin"

matches/
  {matchId}
    teamNumber: number
    autoScore: number
    teleopScore: number
    endgame: string
    submittedBy: userId
    timestamp: serverTimestamp
```

> Keep documents small and avoid deeply nested objects.

---

## 5. Security Rules

### 5.1 Why Rules Matter

Firestore rules:
- Prevent unauthorized reads/writes
- Ensure users only modify allowed data
- Protect competition data from tampering

### 5.2 Editing Rules

1. Go to **Build → Firestore Database → Rules**.
2. Edit rules carefully.
3. Click **Publish** to apply changes.

### 5.3 Example Rule Pattern

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /matches/{matchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```

> Always test rules before using them in production.

---

## 6. Connecting Firebase to the App

### 6.1 Getting Firebase Config

1. Go to **Project Settings** (gear icon).
2. Scroll to **Your apps**.
3. Select the web app.
4. Copy the Firebase configuration object.

### 6.2 Environment Variables (Recommended)

Store Firebase keys in environment variables:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
```

This keeps keys out of source control.

---

## 7. Common Tasks

### Add Data
- Validate user is authenticated
- Write to Firestore using a structured document

### Read Data
- Use queries instead of fetching entire collections
- Apply filters (match number, team number, event)

### Offline Support
- Firestore automatically caches data
- Writes sync when the device reconnects

---

## 8. Best Practices

- Never rely on frontend checks alone — **use Firestore rules**
- Use **server timestamps** for consistency
- Keep roles (admin/scout) explicit in user documents
- Avoid hardcoding Firebase config in public repos

---

## 9. Troubleshooting

**Permission denied errors**
- Check Firestore rules
- Confirm the user is authenticated

**Data not updating**
- Verify listeners are set correctly
- Confirm document paths are correct

**Auth not persisting**
- Ensure auth state listeners are implemented

---

## 10. Summary

Firebase powers authentication, real-time data, and security for QuickScoutV2. Correct setup of Authentication, Firestore structure, and Security Rules is critical to keeping scouting data reliable and secure.

If you change anything in Firebase, document it here so future developers know what changed and why.

