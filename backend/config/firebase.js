const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

let db = null;
let bucket = null;
let isRealFirebase = false;

const serviceAccountPath = path.join(__dirname, './firebaseServiceAccount.json');
const forceLocalDb = process.env.FORCE_LOCAL_DB === 'true';

try {
  // Check if firebase-admin package is installed and service account exists
  if (fs.existsSync(serviceAccountPath) && !forceLocalDb) {
    const serviceAccount = require(serviceAccountPath);
    const projectId = serviceAccount.project_id;

    // Firebase Storage bucket can be named differently depending on when the project was created:
    // - Newer projects (after ~2022): {project_id}.firebasestorage.app
    // - Legacy projects: {project_id}.appspot.com
    // Use env var FIREBASE_STORAGE_BUCKET if explicitly set, else try modern format first
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET
      || `${projectId}.firebasestorage.app`;

    const app = initializeApp({
      credential: cert(serviceAccount),
      storageBucket
    });
    
    db = getFirestore(app);
    bucket = getStorage(app).bucket();
    isRealFirebase = true;
    console.log(`Firebase Admin SDK initialized successfully! Storage bucket: ${storageBucket}`);
  } else {
    console.warn('Firebase service account key not found at backend/config/firebaseServiceAccount.json. Falling back to local JSON database emulator.');
  }
} catch (error) {
  console.warn('Could not initialize Firebase Admin SDK:', error.message, '. Using local JSON database emulator.');
}

module.exports = {
  db,
  bucket,
  isRealFirebase
};
