"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useAuth, AuthProvider } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

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

  // Dynamic routing and scroll lock
  useEffect(() => {
    // Lock scroll on landing page
    document.body.style.overflow = 'hidden';
    
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

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [loading, user, userProfile, router]);

  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-center bg-background overflow-hidden selection:bg-primary selection:text-background">
      {/* Hero Background Animation */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background z-10 opacity-90" />
        <div className="absolute inset-0 bg-background/50 z-10" />
        <img 
          src="/assets/misc/background-hero.gif" 
          alt="Hero Background" 
          className="w-full h-full object-cover object-bottom mix-blend-screen opacity-10 md:opacity-20 transition-opacity duration-1000"
        />
      </div>

      {/* Main Content - Centered & Non-Scrollable */}
      <div className="relative z-20 flex flex-col items-center justify-center h-full gap-8 text-center animate-in fade-in zoom-in duration-1000 px-6">
        <div className="flex flex-col items-center gap-4">
          <div className="group relative">
            <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <h1 className="text-6xl md:text-[11rem] font-black tracking-tighter drop-shadow-[0_10px_40px_rgba(var(--color-primary),0.2)] leading-none select-none">
              Deadlift<span className="text-primary">.ai</span>
            </h1>
          </div>
          <p className="text-text-secondary text-base md:text-xl max-w-[280px] md:max-w-md font-medium px-4 leading-relaxed">
            Precision powerlifting periodization. <br className="hidden md:block"/>Engineered for your next meet.
          </p>
        </div>

        <div className="w-full mt-4 flex flex-col items-center gap-5 max-w-[280px] md:max-w-xs mx-auto">
          <Link
            id="signup-cta-btn"
            href={signupHref}
            className="btn-primary h-14 md:h-16 text-lg group relative overflow-hidden active:scale-95 transition-all flex items-center justify-center border border-white/10 shadow-[0_0_30px_rgba(var(--color-primary),0.2)]"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              Start Training <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </span>
          </Link>

          <Link
            id="login-cta-btn"
            href={loginHref}
            className="w-full h-14 md:h-16 rounded-2xl bg-surface/40 backdrop-blur-xl border border-white/5 text-white font-black uppercase tracking-[0.2em] text-[10px] hover:bg-surface/60 hover:border-primary/40 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-2xl"
          >
            <LogIn size={16} className="text-primary" />
            Log In
          </Link>
        </div>
      </div>
    </div>



  );
}
