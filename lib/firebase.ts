import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
  type UserCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "deadliftai.web.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

if (typeof window !== "undefined") {
  if (!firebaseConfig.apiKey) console.warn("Firebase: NEXT_PUBLIC_FIREBASE_API_KEY is missing!");
  if (!firebaseConfig.projectId) console.warn("Firebase: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing!");
}

// Singleton pattern — avoids re-initializing on hot reloads in Next.js dev mode
let app: any;
let auth: any;
let db: any;
let storage: any;
try {
  console.log("Firebase: initializing with config", firebaseConfig.projectId);
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Set persistence immediately
  setPersistence(auth, browserLocalPersistence);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log("Firebase: initialized successfully");
} catch (e) {
  console.error("Firebase Initialization CRASHED:", e);
  // Provide dummy objects to prevent immediate crashes
  app = {} as any;
  auth = null as any; 
  db = {} as any;
  storage = {} as any;
  // Track that Firebase failed to load
  if (typeof window !== "undefined") {
    (window as any).FIREBASE_LOAD_RETRY = true;
  }
}

/** Pre-configured Google provider with profile scopes */
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("profile");
googleProvider.addScope("email");
googleProvider.setCustomParameters({ prompt: 'select_account' });

export {
  app,
  auth,
  db,
  storage,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type User,
  type UserCredential,
};

