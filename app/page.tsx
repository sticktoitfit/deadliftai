"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useAuth, AuthProvider } from "@/lib/auth-context";

export default function Home() {
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}

function HomeContent() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const [signupHref, setSignupHref] = useState("/auth?tab=signup");
  const [loginHref, setLoginHref] = useState("/auth?tab=login");

  // Determine dynamic routing based on actual auth state
  useEffect(() => {
    if (!loading) {
      if (user) {
        if (userProfile?.onboardingComplete) {
          router.replace("/workout");
          return;
        }

        if (userProfile?.username) {
          setSignupHref("/onboarding");
        } else {
          setSignupHref("/profile-setup");
        }
        setLoginHref("/workout");
      } else {
        setSignupHref("/auth?tab=signup");
        setLoginHref("/auth?tab=login");
      }
    }
  }, [loading, user, userProfile, router]);

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-background overflow-hidden">
      {/* Hero Background Animation */}
      <div className="absolute inset-0 z-0">
        {/* Top mask to hide any image artifacts on mobile devices with notches */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-background z-20 pointer-events-none md:hidden" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-10 opacity-90" />
        <div className="absolute inset-0 bg-background/30 z-10" />
        <img 
          src="/assets/misc/background-hero.gif" 
          alt="Hero Background" 
          className="w-full h-full object-cover object-bottom mix-blend-screen opacity-40 animate-pulse-slow"
        />
      </div>

      <div className="relative z-20 flex flex-col items-center justify-center min-h-[80vh] gap-8 text-center animate-in fade-in zoom-in duration-1000">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter drop-shadow-2xl">
            Deadlift<span className="text-primary">.ai</span>
          </h1>
          <p className="text-text-secondary text-lg md:text-xl max-w-[320px] md:max-w-md font-medium">
            Precision powerlifting periodization. <br/>Engineered for your next meet.
          </p>
        </div>

        <div className="w-full mt-12 flex flex-col items-center gap-5 max-w-xs mx-auto">
          <Link
            id="signup-cta-btn"
            href={signupHref}
            className="btn-primary w-full h-16 text-lg group relative overflow-hidden active:scale-95 transition-all flex items-center justify-center border border-white/10"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              Start Training <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          <Link
            id="login-cta-btn"
            href={loginHref}
            className="w-full h-16 rounded-2xl bg-surface/80 backdrop-blur-md border border-white/10 text-white font-black uppercase tracking-widest text-xs hover:bg-surface-hover hover:border-primary/40 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xl"
          >
            <LogIn size={18} className="text-primary" />
            Log In to Athlete Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
