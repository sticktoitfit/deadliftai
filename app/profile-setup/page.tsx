"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { User, CheckCircle, XCircle, Loader2, ArrowRight, ChevronLeft, Camera } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AvatarGrid, AVATARS } from "@/components/ui/AvatarGrid";
import { db } from "@/lib/firebase";
import { doc, setDoc, collection, query, where, getDocs, serverTimestamp } from "firebase/firestore";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * One-time profile setup page shown to new users after sign-up or Google auth.
 * Collects username (with Firestore uniqueness check) and avatar choice.
 * Saves to Firestore users/{uid} document before pushing to /onboarding.
 */
export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, refreshProfile, signOut } = useAuth();

  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0].id);
  const [uploadedPhotoURL, setUploadedPhotoURL] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRoute, setSuccessRoute] = useState<{ url: string, message: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (successRoute) {
      const timer = setTimeout(() => router.push(successRoute.url), 1800);
      return () => clearTimeout(timer);
    }
  }, [successRoute, router]);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!user) router.replace("/auth");
  }, [user, router]);

  // Pre-select Google photo if available
  useEffect(() => {
    if (user?.photoURL && !uploadedPhotoURL) setSelectedAvatar("google-photo");
  }, [user?.photoURL, uploadedPhotoURL]);

  /** Debounced username availability check against Firestore */
  const handleUsernameChange = (value: string) => {
    setUsername(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();

    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
      setUsernameStatus("invalid");
      return;
    }

    setUsernameStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const q = query(
          collection(db, "users"),
          where("username", "==", trimmed.toLowerCase())
        );
        const snap = await getDocs(q);
        // Available if no docs, or the only match is the current user
        const takenByOther = snap.docs.some((d) => d.id !== user?.uid);
        setUsernameStatus(takenByOther ? "taken" : "available");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
  };

  const handleSave = async () => {
    if (!user || usernameStatus !== "available") return;

    setIsSaving(true);
    setError(null);
    try {
      // Determine the final photoURL based on selection
      let finalPhotoURL = null;
      if (selectedAvatar === "uploaded-photo") {
        finalPhotoURL = uploadedPhotoURL;
      } else if (selectedAvatar === "google-photo") {
        finalPhotoURL = user.photoURL;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          uid: user.uid,
          email: user.email,
          username: username.trim().toLowerCase(),
          avatarId: selectedAvatar,
          photoURL: finalPhotoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Set session cookie for middleware route protection
      document.cookie = "fb-session=1; path=/; max-age=86400";

      await refreshProfile();
      setSuccessRoute({ url: "/onboarding", message: "Identity established. Engaging calibration wizard..." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save profile.";
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadComplete = (url: string) => {
    setUploadedPhotoURL(url);
    setSelectedAvatar("uploaded-photo");
  };

  const handleRemovePhoto = () => {
    setUploadedPhotoURL(null);
    if (selectedAvatar === "uploaded-photo") {
      setSelectedAvatar(user?.photoURL ? "google-photo" : AVATARS[0].id);
    }
  };


  const usernameStatusIcon = () => {
    switch (usernameStatus) {
      case "checking": return <Loader2 size={16} className="animate-spin text-text-secondary" />;
      case "available": return <CheckCircle size={16} className="text-green-400" />;
      case "taken": return <XCircle size={16} className="text-red-400" />;
      case "invalid": return <XCircle size={16} className="text-yellow-400" />;
      default: return null;
    }
  };

  const usernameHelperText = () => {
    switch (usernameStatus) {
      case "available": return <span className="text-green-400">Username available!</span>;
      case "taken": return <span className="text-red-400">Username already taken.</span>;
      case "invalid": return <span className="text-yellow-400">3–20 chars, letters, numbers, or underscores.</span>;
      default: return <span className="text-text-secondary">3–20 chars. Letters, numbers, underscores.</span>;
    }
  };

  if (successRoute) {
    return (
      <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-[85vh] items-center justify-center animate-in fade-in zoom-in duration-500 text-center gap-6">
        <div className="p-5 rounded-full bg-primary/10 mb-2 relative">
          <div className="absolute inset-0 bg-primary-glow blur-xl rounded-full opacity-60 animate-pulse" />
          <Loader2 size={48} className="text-primary animate-spin relative z-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">Profile Configured</h2>
          <p className="text-text-secondary text-sm font-mono tracking-widest uppercase">{successRoute.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500 relative pb-24">
      <button 
        onClick={async () => {
          await signOut();
          router.push("/");
        }}
        className="absolute -top-4 left-0 p-2 text-text-secondary hover:text-white transition-colors flex items-center gap-1 group z-20"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-xs font-bold uppercase tracking-widest text-text-secondary group-hover:text-white">Sign Out / Back</span>
      </button>

      {/* Header */}
      <div className="mb-8 pt-6">
        <h1 className="text-3xl font-black tracking-tighter">
          Set Up Your <span className="text-primary">Profile</span>
        </h1>
        <p className="text-text-secondary mt-2 text-sm leading-relaxed">
          Choose a username and avatar. This is how other athletes will know you.
        </p>
      </div>

      <div className="flex-1 flex flex-col gap-8">
        {/* Username */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
            <User size={12} /> Username
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary font-bold font-mono">@</span>
            <input
              id="username-input"
              type="text"
              placeholder="your_handle"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              maxLength={20}
              className="
                w-full bg-surface border border-white/10 rounded-xl pl-9 pr-12 py-4
                text-white font-mono placeholder-white/20 focus:outline-none focus:border-primary
                transition-colors duration-200
              "
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2">
              {usernameStatusIcon()}
            </span>
          </div>
          <p className="text-xs pl-1">{usernameHelperText()}</p>
        </div>

        {/* Avatar Selection */}
        <div className="space-y-4">
          <label className="text-xs font-bold uppercase tracking-widest text-text-secondary">
            Identify Yourself
          </label>
          <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">
            Upload a photo, use your Google profile, or pick an emoji:
          </p>
          <AvatarGrid
            userId={user?.uid ?? "guest"}
            selected={selectedAvatar}
            onSelect={setSelectedAvatar}
            onUploadComplete={handleUploadComplete}
            googlePhotoURL={user?.photoURL ?? null}
            uploadedPhotoURL={uploadedPhotoURL}
          />
        </div>


        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl p-3">
            {error}
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-8">
        <button
          id="profile-setup-save-btn"
          onClick={handleSave}
          disabled={isSaving || usernameStatus !== "available"}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" /> Saving...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              Continue to Onboarding <ArrowRight size={18} />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
