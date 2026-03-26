"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Dumbbell, Calendar, Activity, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

interface OnboardingData {
  squat: string;
  bench: string;
  deadlift: string;
  meetWeeks: string;
  meetDate: string;
  frequency: string;
  goalType: "meet" | "block";
}

export default function Onboarding() {
  const router = useRouter();
  const { user, userProfile, refreshProfile, loading } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRoute, setSuccessRoute] = useState<{ url: string, message: string } | null>(null);
  const [data, setData] = useState<OnboardingData>({
    squat: "",
    bench: "",
    deadlift: "",
    meetWeeks: "12",
    meetDate: "",
    frequency: "4",
    goalType: "block",
  });

  useEffect(() => {
    if (successRoute) {
      const timer = setTimeout(() => router.push(successRoute.url), 2000);
      return () => clearTimeout(timer);
    }
  }, [successRoute, router]);

  // Redirect to auth if user is not logged in after auth state is determined
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading, router]);

  // If already finished onboarding, bounce to workout
  useEffect(() => {
    if (!loading && userProfile?.onboardingComplete) {
      router.replace("/workout");
    }
  }, [userProfile, loading, router]);

  const updateData = (fields: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...fields }));
    if (error) setError(null);
  };

  const handleNext = async () => {
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }

    // Final Step — save 1RM data to authenticated user's Firestore doc
    setIsSubmitting(true);
    setError(null);
    try {
      if (!user) {
        throw new Error("You must be logged in to save your program.");
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          onboardingData: data,
          onboardingComplete: true,
          onboardingCompletedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Ensure session cookie is set for middleware
      document.cookie = "fb-session=1; path=/; max-age=86400";

      // IMPORTANT: Refresh profile so the App context knows onboarding is done,
      // preventing the stale state redirect loop in /workout
      await refreshProfile();

      setSuccessRoute({ url: "/workout", message: "Matrix compiled. Initializing training protocol..." });
    } catch (err) {
      console.error("Failed to save onboarding data:", err);
      const msg = err instanceof Error ? err.message : "Failed to generate program. Check your connection.";
      setError(msg);
      
      if (process.env.NODE_ENV === "development" && !user) {
        router.push("/workout");
      }
    } finally {
      setIsSubmitting(false);
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
          <h2 className="text-2xl font-black tracking-tight">Calibration Complete</h2>
          <p className="text-text-secondary text-sm font-mono tracking-widest uppercase">{successRoute.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 flex flex-col min-h-screen justify-between animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        {step > 1 ? (
          <button 
            onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-2 p-2 -ml-2 text-text-secondary hover:text-white transition-colors group"
          >
            <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold uppercase tracking-widest pt-0.5">Back</span>
          </button>
        ) : <div className="w-10" />}
        
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`h-2 rounded-full transition-all duration-300 ${
                step >= i ? "w-8 bg-primary shadow-[0_0_10px_var(--color-primary-glow)]" : "w-4 bg-surface"
              }`}
            />
          ))}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="mb-8">
              <h2 className="text-3xl font-black flex items-center gap-3">
                <Dumbbell className="text-primary" /> Current 1RM
              </h2>
              <p className="text-text-secondary mt-2 text-sm leading-relaxed">
                Enter your best estimated 1-rep max. We use Prilepin's complex analysis to build your foundational NL matrix.
              </p>
            </div>
            
            {["squat", "bench", "deadlift"].map((lift) => (
              <div key={lift} className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-wider text-text-secondary pl-1">
                  {lift} (lbs)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={data[lift as keyof OnboardingData]}
                  onChange={(e) => updateData({ [lift]: e.target.value })}
                  className="w-full bg-surface hover:bg-surface-hover border border-white/5 rounded-xl px-5 py-4 text-xl font-mono text-white placeholder-white/20 focus:outline-none focus:border-primary transition-colors duration-300"
                />
              </div>
            ))}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="mb-8">
              <h2 className="text-3xl font-black flex items-center gap-3">
                <Calendar className="text-primary" /> Training Goal
              </h2>
              <p className="text-text-secondary mt-2 text-sm leading-relaxed">
                Are you training for a specific competition date, or just starting a standard training block?
              </p>
            </div>
            
            <div className="flex bg-surface p-1 rounded-2xl border border-white/5 mb-8">
              <button
                onClick={() => updateData({ goalType: "block" })}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  data.goalType === "block" ? "bg-white/10 text-white" : "text-text-secondary hover:text-white/60"
                }`}
              >
                Standard Block
              </button>
              <button
                onClick={() => updateData({ goalType: "meet" })}
                className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  data.goalType === "meet" ? "bg-white/10 text-white" : "text-text-secondary hover:text-white/60"
                }`}
              >
                Meet Prep
              </button>
            </div>

            {data.goalType === "block" ? (
              <div className="grid grid-cols-2 gap-4">
                {["8", "12", "16", "20"].map((weeks) => (
                  <button
                    key={weeks}
                    onClick={() => updateData({ meetWeeks: weeks })}
                    className={`py-8 rounded-xl border text-2xl font-black transition-all duration-300 ${
                      data.meetWeeks === weeks 
                        ? "bg-primary/10 border-primary text-primary shadow-[0_0_20px_var(--color-primary-glow)]" 
                        : "bg-surface border-white/5 text-text-secondary hover:bg-surface-hover hover:text-white"
                    }`}
                  >
                    {weeks} <span className="text-sm font-normal text-text-secondary ml-1">wks</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in duration-500">
                 <p className="text-sm font-bold uppercase tracking-wider text-text-secondary pl-1">
                  When is the meet?
                </p>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={data.meetDate}
                  onChange={(e) => updateData({ meetDate: e.target.value })}
                  className="w-full bg-surface hover:bg-surface-hover border border-white/5 rounded-xl px-5 py-4 text-xl font-mono text-white placeholder-white/20 focus:outline-none focus:border-primary transition-colors duration-300 [color-scheme:dark]"
                />
                <p className="text-[10px] text-text-secondary italic pl-1">
                  The AI will intelligently divide the time between today and your meet date into optimal Accumulation, Transmutation, and Peaking blocks.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4">
            <div className="mb-8">
              <h2 className="text-3xl font-black flex items-center gap-3">
                <Activity className="text-primary" /> Volume
              </h2>
              <p className="text-text-secondary mt-2 text-sm leading-relaxed">
                How many days per week can you consistently train? The AI adapts dynamically if you miss sessions.
              </p>
            </div>
            
            <div className="flex flex-col gap-4">
              {[
                { val: "3", label: "3 Days", desc: "Optimal recovery, high intensity" },
                { val: "4", label: "4 Days", desc: "Balanced volume & intensity" },
                { val: "5", label: "5 Days", desc: "High volume, rigorous schedule" }
              ].map((freq) => (
                <button
                  key={freq.val}
                  onClick={() => updateData({ frequency: freq.val })}
                  className={`flex flex-col items-start p-5 rounded-xl border transition-all duration-300 ${
                    data.frequency === freq.val 
                      ? "bg-primary/10 border-primary shadow-[0_0_20px_var(--color-primary-glow)]" 
                      : "bg-surface border-white/5 hover:bg-surface-hover"
                  }`}
                >
                  <span className={`text-xl font-black ${data.frequency === freq.val ? "text-primary" : "text-white"}`}>
                    {freq.label}
                  </span>
                  <span className="text-sm text-text-secondary mt-1">{freq.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-8 flex items-start gap-2 text-red-400 text-sm animate-in slide-in-from-top-2 p-4 bg-red-400/10 rounded-xl border border-red-400/20">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-12">
        <button
          type="button"
          onClick={handleNext}
          disabled={
            isSubmitting || 
            (step === 1 && (!data.squat || !data.bench || !data.deadlift)) ||
            (step === 2 && data.goalType === "meet" && !data.meetDate)
          }
          className="btn-primary"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={20} className="animate-spin" /> Building Matrix...
            </span>
          ) : step === 3 ? (
            "Generate Program"
          ) : (
            <span className="flex items-center gap-2">Next Step <ArrowRight size={20} /></span>
          )}
        </button>
      </div>

    </div>
  );
}
