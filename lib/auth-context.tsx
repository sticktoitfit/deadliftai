"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  auth,
  db,
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
} from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

/** Shape of the user profile stored in Firestore */
export interface UserProfile {
  uid: string;
  email: string | null;
  username: string;
  avatarId: string;
  photoURL: string | null;
  createdAt: unknown;
  onboardingComplete: boolean;
  isGuest: boolean;
  onboardingData?: {
    squat: string;
    bench: string;
    deadlift: string;
    meetWeeks: string;
    meetDate?: string;
    frequency: string;
    goalType?: "meet" | "block";
  };
  preferences?: {
    showQuotes: boolean;
  };
}

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: (forceRedirect?: boolean) => Promise<{ isNewUser: boolean }>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePreferences: (prefs: Partial<UserProfile["preferences"]>) => Promise<void>;
  initError: string | null;
  forceReady: () => void;
  logDebug: (msg: string) => void;
  debugLog: string[];
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider wraps the entire app and syncs Firebase Auth state with
 * Firestore user profiles. Provides helpers for all sign-in methods.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const logDebug = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatted = `${timestamp}: ${msg}`;
    console.log(`[AUTH-DEBUG]: ${formatted}`);
    setDebugLog(prev => {
      const next = [...prev.slice(-9), formatted];
      try { sessionStorage.setItem('auth_debug_logs', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Sync logs on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('auth_debug_logs');
      if (saved) { setDebugLog(JSON.parse(saved)); }
    } catch {}
  }, []);



  /** Fetch the Firestore profile for a given uid */
  const fetchProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      return snap.exists() ? (snap.data() as UserProfile) : null;
    } catch {
      return null;
    }
  }, []);

  /** Force re-fetch of the current user's profile (call after profile-setup save) */
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profile = await fetchProfile(user.uid);
    setUserProfile(profile);
  }, [user, fetchProfile]);

  // Listen to Firebase auth state changes
  useEffect(() => {
    if (!auth || typeof onAuthStateChanged !== 'function') {
      console.error("Auth: Firebase critical services unavailable.");
      setInitError("Firebase Auth service failed to initialize. Please check if your browser blocks storage (like IndexedDB).");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AUTH-STATE]: Change detected. User:", firebaseUser ? firebaseUser.uid : "NULL");
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          console.log("[AUTH-STATE]: Fetching profile for:", firebaseUser.uid);
          const profile = await fetchProfile(firebaseUser.uid);
          setUserProfile(profile);
          // Set a session cookie for middleware (if any)
          try {
            document.cookie = `fb-session=1; path=/; max-age=86400; SameSite=Lax`;
          } catch (e) {
            console.warn("Cookie fail:", e);
          }
        } catch (err) {
          console.error("Error fetching profile on auth change:", err);
        }
      } else {
        setUserProfile(null);
        try {
          document.cookie = "fb-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        } catch (e) {
          console.warn("Cookie clear fail:", e);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  // Persistence management: ensure auth state persists across reloads
  useEffect(() => {
    // Safety timeout: force loading to false after 3.5 seconds
    const safetyTimer = setTimeout(() => {
      console.warn("Auth initialization timed out. Forcing UI ready.");
      setLoading(false);
    }, 12000);

    const initAuth = async () => {
      const { hash, search, origin, pathname } = window.location;
      const logMsg = `Init: ${origin}${pathname} (Hash:${hash ? 'Y' : 'N'}, Code:${search.includes('code=') ? 'Y' : 'N'})`;
      logDebug(logMsg);
      try {
        if (!auth) {
           throw new Error("SDK Load Failure");
        }
        
        logDebug("Syncing persistence...");
        await setPersistence(auth, browserLocalPersistence);
        
        logDebug("Scanning for redirect result...");
        const result = await Promise.race([
          getRedirectResult(auth),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 8000))
        ]).catch(err => {
          const code = err?.code || "unknown";
          logDebug(`Redirect Error: [${code}]`);
          return null;
        }) as any;
        
        if (result) {
          const uid = result.user.uid;
          logDebug(`Handshake successful for UID ${uid.slice(0,5)}...`);
          const existingProfile = await fetchProfile(uid);
          if (!existingProfile) {
            logDebug("Generating skeleton profile...");
            await setDoc(doc(db, "users", uid), {
              uid,
              email: result.user.email,
              username: "",
              avatarId: "google-photo",
              photoURL: result.user.photoURL,
              createdAt: serverTimestamp(),
              onboardingComplete: false,
              isGuest: false,
            });
          }
          logDebug("Commiting session cookie...");
          const isSecure = window.location.protocol === "https:";
          document.cookie = `fb-session=1; path=/; max-age=86400; SameSite=${isSecure ? 'None' : 'Lax'}; ${isSecure ? 'Secure' : ''}`;
        } else {
          logDebug("Standby: Ready for interaction.");
        }
        setLoading(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logDebug(`Auth Init Error: ${msg}`);
        setInitError(msg);
        setLoading(false);
      } finally {
        clearTimeout(safetyTimer);
      }
    };
    initAuth();
    return () => clearTimeout(safetyTimer);
  }, [fetchProfile]);

  /**
   * Helper: Sign in with Google Popup
   * Checks for existing profile or creates a stub for new users
   */
  const signInWithGoogle = async (forceRedirect = false): Promise<{ isNewUser: boolean }> => {
    try {
      if (!auth) {
        setInitError("System Offline: Firebase Auth is not available.");
        throw new Error("Firebase Auth is not available.");
      }

      const isMobile = /iPhone|iPad|iPod|Android|Mobi|Tablet/i.test(navigator.userAgent);
      
      let result: UserCredential | null = null;

      if (isMobile || forceRedirect) {
        logDebug("Triggering Google Redirect...");
        await signInWithRedirect(auth, googleProvider);
        // On redirect, this promise won't ever "resolve" or return 
        // because the page is about to unload.
        return { isNewUser: false }; 
      } else {
        logDebug("Triggering Google Popup...");
        try {
          result = await signInWithPopup(auth, googleProvider);
          logDebug(`Popup Handshake Result: ${result ? "Success" : "Empty"}`);
        } catch (err: any) {
          const code = err?.code || "unknown-error";
          logDebug(`Popup Failed: [${code}]`);
          throw err; 
        }
      }

      if (!result) {
        // This case should ideally not be reached if popup was successful,
        // but good for type safety and explicit handling.
        return { isNewUser: false };
      }

      const uid = result.user.uid;
      
      const existingProfile = await fetchProfile(uid);
      
      // If brand new Google user — create a skeleton profile in Firestore
      if (!existingProfile) {
        await setDoc(doc(db, "users", uid), {
          uid,
          email: result.user.email,
          username: "",
          avatarId: "google-photo",
          photoURL: result.user.photoURL,
          createdAt: serverTimestamp(),
          onboardingComplete: false,
          isGuest: false,
        });
        return { isNewUser: true };
      }
      return { isNewUser: false };
    } catch (err) {
      console.error("AuthContext: signInWithGoogle error:", err);
      throw err;
    }
  };

  /** Sign in with email + password */
  const signInWithEmail = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
    document.cookie = "fb-session=1; path=/; max-age=86400";
  };

  /** Create a new account with email + password and skeleton Firestore doc */
  const signUpWithEmail = async (email: string, password: string): Promise<void> => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const uid = result.user.uid;
    await setDoc(doc(db, "users", uid), {
      uid,
      email,
      username: "",
      avatarId: "lifter-1",
      photoURL: null,
      createdAt: serverTimestamp(),
      onboardingComplete: false,
      isGuest: false,
    });
    document.cookie = "fb-session=1; path=/; max-age=86400";
  };

  /** Sign out the current user and clear the session cookie */
  const signOut = async (): Promise<void> => {
    await firebaseSignOut(auth);
    // Expire the middleware session cookie
    document.cookie = "fb-session=; path=/; max-age=0";
    setUserProfile(null);
  };

  /** Update user preferences in Firestore */
  const updatePreferences = useCallback(async (newPrefs: Partial<UserProfile["preferences"]>) => {
    if (!user) return;
    const profileRef = doc(db, "users", user.uid);
    const updatedPrefs = {
      ...(userProfile?.preferences || { showQuotes: true }),
      ...newPrefs
    };
    await updateDoc(profileRef, { preferences: updatedPrefs });
    await refreshProfile();
  }, [user, userProfile, refreshProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        refreshProfile,
        updatePreferences,
        initError,
        forceReady: () => setLoading(false),
        logDebug,
        debugLog,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to consume auth context — throws if used outside AuthProvider */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
