"use client";

/**
 * /workout/active — Distraction-Free "Flow Mode" page.
 *
 * WHY: When lifting, the athlete should only see what matters: the current lift,
 * next lift, and a large rest timer. This version supports the multi-movement
 * hierarchy (Main → Variant → Accessory) and handles Top/Back-off sets.
 */

import { Suspense } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, Pause, Play, SkipForward, ArrowRight, List, X, RefreshCw, ArrowLeft, Minus, Plus, Trophy } from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { doc, updateDoc, serverTimestamp, collection, query, getDocs, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Haptics, PlaySound } from "@/lib/utils/haptics";
import { type MovementPrescription } from "@/lib/programming/periodization";
import { PRCelebration } from "@/components/ui/PRCelebration";
import { PassiveQuote } from "@/components/ui/PassiveQuote";

const REST_TIMER_DEFAULT = 180;

interface CompletedMovement {
  name: string;
  sets: { weight: number; reps: number; rpe: number }[];
}

function ActiveWorkoutContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, userProfile } = useAuth();

  const lift = params.get("lift") ?? "squat";
  const logId = params.get("logId") ?? "";
  
  // Parse movements from URL
  const [movements, setMovements] = useState<MovementPrescription[]>([]);
  const [currentMovementIndex, setCurrentMovementIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [completedMovements, setCompletedMovements] = useState<CompletedMovement[]>([]);
  
  const [currentSetLogs, setCurrentSetLogs] = useState<{ reps: number; weight: number; rpe: number | null }[]>([]);

  const [restTimer, setRestTimer] = useState(REST_TIMER_DEFAULT);
  const [isResting, setIsResting] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [showRPE, setShowRPE] = useState(false);
  const [showFullWorkout, setShowFullWorkout] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState<number | null>(null);

  // ── PR Tracking ──────────────────────────────────────────────────────────
  const [personalBests, setPersonalBests] = useState<Record<string, Record<number, number>>>({});
  const [celebratingPR, setCelebratingPR] = useState<{name: string, weight: number, reps: number} | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [weeklySessions, setWeeklySessions] = useState(0);
  const [targetFrequency, setTargetFrequency] = useState(4);

  const todayStr = new Date().toLocaleDateString("en-US", { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });

  // Initialize movements from URL
  useEffect(() => {
    const p = params.get("p");
    if (p) {
      try {
        const decoded = JSON.parse(decodeURIComponent(p)) as MovementPrescription[];
        setMovements(decoded);
        // Initialize log array for first movement
        setCurrentSetLogs(decoded[0].sets.map(s => ({ weight: s.weight, reps: s.reps, rpe: null })));
        
        // Fetch historical bests for PR tracking
        const names = decoded.map(m => m.name);
        fetchMovementBests(names);
        
        // Fetch session count if user is ready
        if (user && userProfile?.onboardingData) {
          const od = userProfile.onboardingData;
          setTargetFrequency(parseInt(od.frequency) || 4);
          
          const joinTime = userProfile.createdAt
            ? (userProfile.createdAt as { seconds: number }).seconds * 1000
            : Date.now();
          const daysSince = Math.floor((Date.now() - joinTime) / 86400000);
          const week = Math.max(1, Math.floor(daysSince / 7) + 1);
          const currentWeekStart = joinTime + (week - 1) * 7 * 86400000;

          // Note: we don't query Firestore here for performance, 
          // but we'll show a default and could enhance if needed.
          // For now, let's just use the current date in the header as requested.
        }
      } catch (e) {
        console.error("Failed to parse movements:", e);
      }
    }
  }, [params, user, userProfile]);

  // ── Rest Timer ───────────────────────────────────────────────────────────
  const startTimer = useCallback(() => {
    setRestTimer(REST_TIMER_DEFAULT);
    setIsResting(true);
    setTimerPaused(false);
  }, []);

  useEffect(() => {
    if (!isResting || timerPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setRestTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setIsResting(false);
          Haptics.success();
          PlaySound.chime();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [isResting, timerPaused]);

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  function updateLoggedPerformance(field: 'reps' | 'weight', delta: number) {
    const updated = [...currentSetLogs];
    const current = { ...updated[currentSetIndex] };
    if (field === 'reps') {
      current.reps = Math.max(0, current.reps + delta);
    } else {
      current.weight = Math.max(0, current.weight + delta);
    }
    Haptics.light();
    updated[currentSetIndex] = current;
    setCurrentSetLogs(updated);
  }

  /**
   * WHY: Fetches the all-time best for each movement in the current session
   * so we can detect real-time PRs during the set.
   */
  const fetchMovementBests = useCallback(async (movementNames: string[]) => {
    if (!user || movementNames.length === 0) return;

    try {
      // WHY: We'll query all completed logs for this lift
      const logsRef = collection(db, "users", user.uid, "workoutLogs");
      const q = query(logsRef, where("lift", "==", lift), where("completed", "==", true));
      const snap = await getDocs(q);
      
      const bests: Record<string, Record<number, number>> = {};
      
      snap.docs.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.movements)) {
          data.movements.forEach((m: any) => {
            if (!bests[m.name]) bests[m.name] = {};
            m.sets.forEach((s: any) => {
              const r = s.reps;
              if (!bests[m.name][r] || s.weight > bests[m.name][r]) {
                bests[m.name][r] = s.weight;
              }
            });
          });
        }
      });
      
      setPersonalBests(bests);
    } catch (e) {
      console.warn("Failed to pre-fetch PR data:", e);
    }
  }, [user, lift]);

  function completeSet(rpe: number) {
    const updatedLogs = [...currentSetLogs];
    updatedLogs[currentSetIndex] = { ...updatedLogs[currentSetIndex], rpe };
    setCurrentSetLogs(updatedLogs);
    setShowRPE(false);
    Haptics.medium();
    PlaySound.click();

    const movement = movements[currentMovementIndex];
    const loggedSet = updatedLogs[currentSetIndex];

    // ── PR Detection ─────────────────────────────────────────────────────
    // Check if the current weight for this rep count is higher than the best in history
    const bestForReps = personalBests[movement.name]?.[loggedSet.reps] || 0;
    if (loggedSet.weight > bestForReps && loggedSet.reps > 0) {
      // Trigger PR celebration
      setCelebratingPR({
        name: movement.name,
        weight: loggedSet.weight,
        reps: loggedSet.reps
      });
      
      // Update local bests state instantly so we don't trigger the same PR multiple times in one session
      setPersonalBests(prev => ({
        ...prev,
        [movement.name]: {
          ...(prev[movement.name] || {}),
          [loggedSet.reps]: loggedSet.weight
        }
      }));
    }

    if (currentSetIndex < movement.sets.length - 1) {
      // Next set in current movement
      setCurrentSetIndex(s => s + 1);
      startTimer();
    } else {
      // Current movement finished
      const completed = {
        name: movement.name,
        sets: updatedLogs as { weight: number; reps: number; rpe: number }[]
      };
      const nextCompletedMovements = [...completedMovements, completed];
      setCompletedMovements(nextCompletedMovements);

      if (currentMovementIndex < movements.length - 1) {
        // Prepare next movement
        const nextIdx = currentMovementIndex + 1;
        setCurrentMovementIndex(nextIdx);
        setCurrentSetIndex(0);
        setCurrentSetLogs(movements[nextIdx].sets.map(s => ({ weight: s.weight, reps: s.reps, rpe: null })));
        startTimer();
      } else {
        // Session complete
        finalizeSession(nextCompletedMovements);
      }
    }
  }

  function swapMovement(idx: number, newName: string) {
    const updated = [...movements];
    updated[idx] = { ...updated[idx], name: newName };
    setMovements(updated);
    setShowSwapModal(null);
  }

  async function finalizeSession(finalPayload: CompletedMovement[]) {
    setSessionDone(true);
    Haptics.heavy();
    if (!user || !logId) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "workoutLogs", logId), {
        completed: true,
        completedAt: serverTimestamp(),
        movements: finalPayload // Detailed set-by-set log
      });
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  }

  const handlePRComplete = useCallback(() => setCelebratingPR(null), []);

  if (sessionDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[85vh] gap-8 text-center animate-in fade-in zoom-in duration-700">
        <div className="relative">
          <CheckCircle2 size={80} className="text-primary" />
          <div className="absolute inset-0 bg-primary-glow blur-3xl -z-10 animate-pulse" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tight">Session Done</h2>
          <p className="text-text-secondary mt-2">
            AI has recorded your session. Recovery begins now.
          </p>
        </div>
        
        <PassiveQuote className="my-4" />

        <button onClick={() => router.replace("/workout")} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (movements.length === 0) return null;

  const currentMovement = movements[currentMovementIndex];
  const currentSetData = currentMovement.sets[currentSetIndex];

  return (
    <div className="flex flex-col min-h-[85vh] animate-in fade-in duration-500">
      {/* PR Celebration Overlay */}
      {celebratingPR && (
        <PRCelebration 
          liftName={celebratingPR.name}
          weight={celebratingPR.weight}
          reps={celebratingPR.reps}
          onComplete={handlePRComplete}
        />
      )}
      
      {/* Full Session Overlay */}
      {showFullWorkout && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-surface-dark border-t border-white/10 rounded-t-[32px] p-6 pb-12 overflow-y-auto animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black tracking-tight">Full Session</h2>
              <button 
                onClick={() => setShowFullWorkout(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-text-secondary hover:text-white transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {movements.map((m, idx) => (
                <div key={idx} className={cn(
                  "p-5 rounded-2xl border transition-all duration-300",
                  idx === currentMovementIndex ? "bg-primary/5 border-primary/30" : 
                  idx < currentMovementIndex ? "bg-white/[0.02] border-white/5 opacity-50" : 
                  "bg-surface border-white/5"
                )}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{m.type}</p>
                      <h3 className="font-black text-white">{m.name}</h3>
                    </div>
                    {idx >= currentMovementIndex && m.alternatives && m.alternatives.length > 0 && (
                      <button 
                        onClick={() => setShowSwapModal(idx)}
                        className="p-2 rounded-lg bg-white/5 text-text-secondary hover:text-white transition-colors"
                        title="Swap for Alternative"
                      >
                        <RefreshCw size={14} />
                      </button>
                    )}
                  </div>

                  <PassiveQuote className="mt-8 scale-90" />
                  
                  <div className="space-y-2">
                    {m.sets.map((s, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between text-xs py-2 border-b border-white/[0.03] last:border-0 opacity-80">
                        <span className="font-mono text-xs font-black uppercase tracking-widest text-text-secondary">Set {sIdx + 1}: {s.label}</span>
                        <div className="flex gap-6 font-black text-xl">
                          <span className={cn(
                            s.weight > 0 ? "text-white" : "text-primary shadow-[0_0_10px_rgba(var(--color-primary),0.2)] font-bold italic"
                          )}>
                            {s.weight > 0 ? `${s.weight} lbs` : "RPE"}
                          </span>
                          <span className="text-text-secondary/80 w-16 text-right">× {s.reps}</span>
                          <span className="text-primary w-16 text-right">@ {s.rpeTarget}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {showSwapModal === idx && (
                    <div className="mt-4 pt-4 border-t border-white/10 animate-in slide-in-from-top-2">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black uppercase tracking-widest text-text-secondary">Closest Equivalents</p>
                        <p className="text-[10px] text-primary italic font-medium">Adjust weight as needed</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {m.alternatives?.map(alt => (
                          <button
                            key={alt}
                            onClick={() => swapMovement(idx, alt)}
                            className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setShowFullWorkout(false)}
              className="mt-8 w-full py-4 rounded-2xl bg-white/5 text-text-secondary font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-colors"
            >
              Back to Flow
            </button>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 mb-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest pt-0.5">Back to Dashboard</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">Flow Active</span>
        </div>
      </div>

      {/* Progression Breadcrumb */}
      <div className="pt-1 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary mb-2 opacity-60 flex items-center gap-2">
            <span>{todayStr}</span>
            <span className="text-white/20 font-bold">•</span>
            <span className="text-primary font-bold uppercase">Session {weeklySessions + 1} / {targetFrequency} Flow</span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {movements.map((m, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                 <div className={cn(
                   "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-500",
                   idx === currentMovementIndex ? "bg-primary border-primary text-white shadow-[0_0_20px_rgba(59,130,246,0.25)] scale-105" :
                   idx < currentMovementIndex ? "bg-white/5 border-white/20 text-white/20" :
                   "bg-surface border-white/5 text-text-secondary opacity-40"
                 )}>
                    {m.name}
                 </div>
                 {idx < movements.length - 1 && <span className="text-white/10 font-bold text-[10px] select-none">/</span>}
              </div>
            ))}
          </div>
        </div>
        <button 
          onClick={() => setShowFullWorkout(true)}
          className="shrink-0 w-10 h-10 rounded-xl bg-surface border border-white/10 text-text-secondary hover:text-white hover:border-primary/40 transition-all duration-300 flex items-center justify-center group shadow-2xl shadow-black/40"
          title="View Full Session"
        >
          <List size={20} className="group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Primary Display */}
      <div className="flex-1 flex flex-col items-center justify-center gap-1 py-2 relative text-center">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-primary/5 blur-[80px] -z-10" />
        
        {/* Movement Detail */}
        <div className="mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
          <p className="text-primary text-[9px] font-black uppercase tracking-[0.4em] mb-2 opacity-60">Executing</p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white leading-tight uppercase max-w-sm mx-auto">
            {currentMovement.name}
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
             <div className="h-[1px] w-6 bg-white/10" />
             <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary">
               Set {currentSetIndex + 1} of {currentMovement.sets.length}
             </p>
             <div className="h-[1px] w-6 bg-white/10" />
          </div>
        </div>

        <p className="text-text-secondary text-[9px] uppercase font-black tracking-widest mb-1">{currentSetData.label}</p>
        
        <div className="text-center group">
          <span className={cn(
            "font-black font-mono text-white leading-none transition-transform duration-500 hover:scale-105 inline-block",
            currentSetData.weight > 0 ? "text-7xl md:text-8xl" : "text-7xl italic text-primary"
          )}>
            {currentSetData.weight > 0 ? currentSetData.weight : "RPE"}
          </span>
          {currentSetData.weight > 0 && <span className="text-xl text-text-secondary font-black ml-2 uppercase">lbs</span>}
        </div>
        
        <p className="text-2xl font-black text-text-secondary mt-4">
          Perform <span className="text-white">{currentSetData.reps}</span> reps
        </p>

        {/* Intensity Marker */}
        <div className="mt-4 flex items-center gap-3">
           <div className="h-[1px] w-6 bg-white/10" />
           <p className="text-[9px] font-black uppercase tracking-[0.3em] text-primary">Target RPE {currentSetData.rpeTarget}</p>
           <div className="h-[1px] w-6 bg-white/10" />
        </div>

        {/* Set Nav dots */}
        <div className="flex gap-2.5 mt-10">
          {currentSetLogs.map((log, idx) => (
            <div
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                log.rpe !== null ? "bg-primary shadow-[0_0_12px_var(--color-primary-glow)]" :
                idx === currentSetIndex ? "bg-white scale-125" : "bg-surface border border-white/5"
              )}
            />
          ))}
        </div>
      </div>

      {/* Interaction Layer */}
      <div className="min-h-[140px] flex flex-col justify-end">
        {isResting ? (
          <div className="text-center pb-4 animate-in slide-in-from-bottom-6 duration-500">
            <p className="text-[9px] text-text-secondary uppercase font-black tracking-widest mb-2">Inter-Set Recovery</p>
            <div className="text-5xl font-black font-mono text-primary tabular-nums tracking-tighter">
              {formatTime(restTimer)}
            </div>
          <div className="h-0.5 w-10 bg-green-500/20 mx-auto rounded-full mb-4" />
          
          {currentMovement.activeRecovery ? (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mx-4 mb-6 relative overflow-hidden group">
               <div className="absolute top-0 left-1/4 w-32 h-32 bg-primary/20 blur-[50px] -z-10 animate-pulse" />
               <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">Active Recovery / Prep</p>
               <p className="text-white text-sm font-bold">{currentMovement.activeRecovery}</p>
            </div>
          ) : (
            <PassiveQuote className="mb-6 scale-90" />
          )}

            <div className="flex justify-center gap-3 mt-4">
              <button
                onClick={() => setTimerPaused((p) => !p)}
                className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center text-text-secondary hover:text-white transition-all active:scale-95"
              >
                {timerPaused ? <Play size={20} fill="currentColor" /> : <Pause size={20} fill="currentColor" />}
              </button>
              <button
                onClick={() => { setIsResting(false); setShowRPE(true); }}
                className="px-6 h-12 rounded-xl bg-surface border border-white/10 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-white transition-all active:scale-95"
              >
                <SkipForward size={16} /> Skip Rest
              </button>
            </div>
          </div>
        ) : showRPE ? (
          <div className="pb-4 animate-in slide-in-from-bottom-6 duration-500">
            {/* Performance Adjustment */}
            <div className="flex items-center justify-around mb-6 px-1">
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">Actual Reps</p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateLoggedPerformance('reps', -1)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-white"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-xl font-black font-mono w-6 text-center">{currentSetLogs[currentSetIndex].reps}</span>
                  <button 
                    onClick={() => updateLoggedPerformance('reps', 1)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="h-10 w-[1px] bg-white/5" />

              <div className="flex flex-col items-center gap-1.5">
                <p className="text-[8px] font-black uppercase tracking-widest text-text-secondary">Actual weight</p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => updateLoggedPerformance('weight', -5)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-white"
                  >
                    <Minus size={14} />
                  </button>
                  <div className="flex flex-col items-center">
                    <span className="text-xl font-black font-mono min-w-[2.5rem] text-center leading-none">{currentSetLogs[currentSetIndex].weight}</span>
                    <span className="text-[7px] font-bold text-text-secondary uppercase mt-0.5">lbs</span>
                  </div>
                  <button 
                    onClick={() => updateLoggedPerformance('weight', 5)}
                    className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary hover:text-white"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-[9px] font-black uppercase tracking-widest text-text-secondary mb-4">Rate Effort (RPE)</p>
            <div className="grid grid-cols-5 gap-2.5 mb-4">
              {[6, 7, 8, 9, 10].map((rpe) => (
                <button
                  key={rpe}
                  onClick={() => completeSet(rpe)}
                  className={cn(
                    "h-14 rounded-xl font-black text-lg transition-all duration-300 active:scale-90",
                    rpe >= 9 ? "bg-orange-500/10 border border-orange-500/30 text-orange-400" :
                    rpe >= 8 ? "bg-accent/10 border border-accent/30 text-accent" :
                    "bg-surface border border-white/10 text-white hover:bg-surface-hover"
                  )}
                >
                  {rpe}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowRPE(false)}
              className="w-full text-[9px] font-black uppercase tracking-widest text-text-secondary py-1 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="pb-4 animate-in slide-in-from-bottom-6 duration-500">
            <button
              onClick={() => setShowRPE(true)}
              className="btn-primary h-14 text-xs font-black tracking-widest uppercase transition-all duration-300 shadow-[0_0_30px_rgba(59,130,246,0.15)]"
            >
              Log Set {currentSetIndex + 1}
            </button>
            <button
              onClick={() => router.back()}
              className="w-full text-[9px] font-black uppercase tracking-widest text-text-secondary py-3 hover:text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronDown size={12} /> End Session Early
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActiveWorkout() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[85vh] gap-6 animate-pulse">
        <BrandLogo size={64} glow={false} className="opacity-20" />
        <div className="text-text-secondary text-xs font-black tracking-widest uppercase">Initialising Flow…</div>
        <PassiveQuote className="opacity-100" />
      </div>
    }>
      <ActiveWorkoutContent />
    </Suspense>
  );
}
