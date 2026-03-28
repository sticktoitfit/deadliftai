"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ChevronLeft, Loader2 } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { useAuth } from "@/lib/auth-context";

type Tab = "login" | "signup";

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    userProfile, 
    user, 
    loading, 
    forceReady,
    logDebug,
    debugLog 
  } = useAuth();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRoute, setSuccessRoute] = useState<{ url: string, message: string } | null>(null);

  // Sync tab with URL search params
  useEffect(() => {
    const requestedTab = searchParams.get("tab") as Tab;
    if (requestedTab === "login" || requestedTab === "signup") {
      setTab(requestedTab);
    }
  }, [searchParams]);

  // Handle automatic redirect if user becomes authenticated (fixes mobile redirect hang)
  useEffect(() => {
    if (!loading && user && !hasRedirected && !successRoute) {
       logDebug("User settled. Preparing transition...");
       setHasRedirected(true);
       if (userProfile?.onboardingComplete) {
         setSuccessRoute({ url: "/", message: "Diverting to athlete cockpit..." });
       } else if (userProfile?.username && !userProfile.onboardingComplete) {
         setSuccessRoute({ url: "/onboarding", message: "Preparing mission profile..." });
       } else if (userProfile) {
         setSuccessRoute({ url: "/profile-setup", message: "Access secured. Initializing data link..." });
       }
    }
  }, [user, userProfile, loading, router, hasRedirected, successRoute]);

  useEffect(() => {
    if (successRoute) {
      const timer = setTimeout(() => router.push(successRoute.url), 1800);
      return () => clearTimeout(timer);
    }
  }, [successRoute, router]);

  // Apply strict scroll lock to login/signup page
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleGoogle = async (e?: React.MouseEvent, mode: 'popup' | 'redirect' = 'popup') => {
    if (e) e.preventDefault();
    logDebug(`Google (${mode}) triggered`);
    setIsLoading(true);
    setError(null);
    try {
      logDebug(`Requesting Google Sign-In via ${mode}...`);
      const { isNewUser } = await signInWithGoogle(mode === 'redirect');
      logDebug(`Sign-in complete. New User: ${isNewUser}`);
      
      if (isNewUser) {
        setSuccessRoute({ url: "/profile-setup", message: "Account secured. Diverting to profile configuration..." });
      } else {
        setSuccessRoute({ url: "/", message: "Identity verified. Initializing systems..." });
      }
    } catch (e: unknown) {
      console.error("Google sign-in error:", e);
      const msg = e instanceof Error ? e.message : "Google sign-in failed.";
      logDebug(`Error: ${msg}`);
      if (!msg.includes("popup-closed") && !msg.includes("cancelled-by-user")) {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    logDebug(`Email ${tab} triggered for ${email}`);
    setError(null);

    if (tab === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (tab === "signup") {
        logDebug("Creating user...");
        await signUpWithEmail(email, password);
        logDebug("User created.");
        setSuccessRoute({ url: "/profile-setup", message: "Account secured. Diverting to profile configuration..." });
      } else {
        logDebug("Signing in...");
        await signInWithEmail(email, password);
        logDebug("Sign-in success.");
        setSuccessRoute({ url: "/", message: "Identity verified. Initializing systems..." });
      }
    } catch (e: unknown) {
      const raw = e instanceof Error ? e.message : "";
      logDebug(`Email error: ${raw}`);
      if (raw.includes("user-not-found") || raw.includes("wrong-password") || raw.includes("invalid-credential")) {
        setError("Invalid email or password.");
      } else if (raw.includes("email-already-in-use")) {
        setError("An account with this email already exists.");
      } else if (raw.includes("invalid-email")) {
        setError("Please enter a valid email address.");
      } else {
        setError(raw || "Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-[85vh] items-center justify-center gap-6">
        <BrandLogo size={64} glow={true} />
        <div className="flex flex-col items-center gap-2">
           <p className="text-xs tracking-widest uppercase text-text-secondary animate-pulse">Stage 2: Core Handshake...</p>
           {/* Real-time Handshake Logs */}
           {debugLog.length > 0 && (
             <div className="w-full mt-4 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[9px] space-y-1 animate-in fade-in slide-in-from-bottom-2">
               <p className="text-white/20 mb-2 uppercase font-black text-center">Boot Sequence Logs</p>
               {debugLog.map((log, i) => (
                 <div key={i} className="flex gap-2">
                   <span className="text-primary/40">[{i}]</span>
                   <span className="text-text-secondary text-wrap">{log}</span>
                 </div>
               ))}
             </div>
           )}
           <button 
             onClick={() => {
               alert("OVERRIDING HANDSHAKE...");
               forceReady();
             }}
             className="mt-6 text-[10px] text-primary/40 uppercase font-black hover:text-white transition-colors p-4"
           >
             Manual Override (Forced Entry)
           </button>
        </div>
      </div>
    );
  }

  if (successRoute) {
    return (
      <div className="max-w-md mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-[85vh] items-center justify-center animate-in fade-in zoom-in duration-500 text-center gap-6">
        <div className="p-5 rounded-full bg-primary/10 mb-2 relative">
          <div className="absolute inset-0 bg-primary-glow blur-xl rounded-full opacity-60 animate-pulse" />
          <Loader2 size={48} className="text-primary animate-spin relative z-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight">{tab === "login" ? "Access Granted" : "Welcome to Deadlift.ai"}</h2>
          <p className="text-text-secondary text-sm font-mono tracking-widest uppercase">{successRoute.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-screen items-center justify-center animate-in fade-in duration-500 relative pb-24">
      {/* Back Button */}
      <button 
        type="button"
        onClick={() => router.push("/")}
        className="absolute top-0 left-0 p-2 text-text-secondary hover:text-white transition-colors flex items-center gap-1 group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
        <span className="text-xs font-bold uppercase tracking-widest">Back</span>
      </button>

      <div className="flex flex-col items-center gap-3 mb-10">
        <BrandLogo size={80} className="shadow-2xl" />
        <h1 className="text-3xl font-black tracking-tighter">
          Deadlift<span className="text-primary">.ai</span>
        </h1>
        <p className="text-text-secondary text-sm">
          {tab === "login" ? "Welcome back, athlete." : "Build your elite profile."}
        </p>
      </div>

      <div className="w-full flex flex-col gap-5">
        {/* Google Button */}
        <div className="flex flex-col gap-2">
          <button
            id="google-signin-btn"
            type="button"
            onClick={handleGoogle}
            disabled={isLoading}
            className="
              flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold
              bg-white text-gray-900 hover:bg-gray-100 transition-all duration-200
              shadow-lg hover:shadow-xl active:scale-[0.98] disabled:opacity-60
            "
          >
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M43.6 20.2H42V20H24v8h11.3C33.7 32.6 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.8z"/>
              <path fill="#34A853" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.8 1.1 7.9 2.9l5.7-5.7C34.3 6.7 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#FBBC05" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.2l-6.4 4.9C7.1 39.7 15 44 24 44z"/>
              <path fill="#EA4335" d="M43.6 20.2H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C40.9 36.1 44 30.6 44 24c0-1.3-.1-2.6-.4-3.8z"/>
            </svg>
            {isLoading ? "Communicating..." : "Continue with Google"}
          </button>
          
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-text-secondary text-xs font-medium tracking-widest uppercase">or</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-surface rounded-xl p-1">
          <button
            type="button"
            id="tab-login"
            onClick={() => { setTab("login"); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
              tab === "login" ? "bg-primary text-background shadow" : "text-text-secondary hover:text-white"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            id="tab-signup"
            onClick={() => { setTab("signup"); setError(null); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
              tab === "signup" ? "bg-primary text-background shadow" : "text-text-secondary hover:text-white"
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleEmailAuth} className="flex flex-col gap-4">
          <div className="relative">
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-colors duration-200"
            />
          </div>

          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete={tab === "signup" ? "new-password" : "current-password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface border border-white/10 rounded-xl pl-11 pr-12 py-4 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-colors duration-200"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {tab === "signup" && (
            <div className="relative animate-in slide-in-from-top-2 duration-300">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-surface border border-white/10 rounded-xl pl-11 pr-4 py-4 text-white placeholder-white/30 focus:outline-none focus:border-primary transition-colors duration-200"
              />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-400 text-sm animate-in slide-in-from-top-2 p-3 bg-red-400/10 rounded-xl border border-red-400/20">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary mt-1"
          >
            {isLoading ? (
              <span className="animate-pulse">
                {tab === "signup" ? "Creating account..." : "Signing in..."}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                {tab === "signup" ? "Create Account" : "Log In"}
                <ArrowRight size={18} />
              </span>
            )}
          </button>
        </form>

        {/* Debug Log (Visible on error or interaction) */}
        {(debugLog.length > 0 || error) && (
          <div className="mt-8 p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[10px] space-y-1">
            <p className="text-white/20 mb-2 uppercase font-black">System Diagnostic Logs</p>
            {debugLog.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-primary/50">[{i}]</span>
                <span className="text-text-secondary text-wrap">{log}</span>
              </div>
            ))}
          </div>
        )}

        {/* Bottom spacer */}
        <div className="mt-8" />
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col min-h-[85vh] items-center justify-center animate-pulse gap-6">
        <BrandLogo size={64} glow={true} />
        <p className="text-xs tracking-widest uppercase text-text-secondary">Stage 1: Manifesting...</p>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}
