"use client";

/**
 * /workout page — the "Home Base" for the athlete's active program.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  TrendingUp, 
  Calendar, 
  ChevronRight, 
  AlertCircle, 
  Layout, 
  CheckCircle2,
  Info,
  Settings,
  X,
  Clock,
  ArrowUp,
  RotateCcw,
  LogOut,
  Maximize2,
  Activity
} from "lucide-react";
import BrandLogo from "@/components/ui/BrandLogo";
import { useAuth } from "@/hooks/useAuth";
import { PassiveQuote } from "@/components/ui/PassiveQuote";
import DashboardIntro from "@/components/ui/DashboardIntro";
import {
  prescribeNextSession,
  prescribeFullWeek,
  estimateMeet1RM,
  getTrainingPhase,
  analyzeScheduleCompliance,
  calculateProgramTiming,
  analyzeNeuromuscularTrends,
  type SessionPrescription,
  type WorkoutLog,
} from "@/lib/programming/periodization";
import { db, auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  doc,
  updateDoc,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { cn } from "@/lib/utils";

type Lift = "squat" | "bench" | "deadlift";

const LIFT_LABELS: Record<Lift, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
};

const PHASE_LABELS: Record<string, { label: string; color: string }> = {
  accumulation:    { label: "Accumulation Block", color: "text-primary shadow-[0_0_10px_rgba(59,130,246,0.2)]" },
  transmutation:   { label: "Transmutation Block", color: "text-accent shadow-[0_0_10px_rgba(139,92,246,0.2)]" },
  peaking:         { label: "Realization Block", color: "text-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.2)]" },
  done:            { label: "Meet Week!", color: "text-green-400 shadow-[0_0_10px_rgba(74,222,128,0.2)]" },
};

export default function WorkoutPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  
  const [fullWeekPlan, setFullWeekPlan] = useState<SessionPrescription[]>([]);
  const [meetTargets, setMeetTargets] = useState<Record<Lift, number>>({ squat: 0, bench: 0, deadlift: 0 });
  const [scheduleAdvisory, setScheduleAdvisory] = useState<{ shouldReduce: boolean; message: string } | null>(null);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks, setTotalWeeks] = useState(12);
  const [weeklySessions, setWeeklySessions] = useState(0);
  const [targetFrequency, setTargetFrequency] = useState(4);
  const [phase, setPhase] = useState<string>("accumulation");
  const [pageLoading, setPageLoading] = useState(true);
  const [trendMessage, setTrendMessage] = useState<string | null>(null);
  const [neuralStatus, setNeuralStatus] = useState<string>("stable");

  const todayStr = new Date().toLocaleDateString("en-US", { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth"); return; }
    if (!userProfile?.onboardingComplete) { router.replace("/onboarding"); return; }

    // Force scroll restoration on mount to prevent stale lock from Landing/Auth pages
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';

    loadProgram();

    // Check if user needs intro
    if (userProfile && !userProfile.preferences?.hasSeenDashboardIntro) {
      setShowIntro(true);
    }
  }, [loading, user, userProfile]);

  async function loadProgram() {
    if (!user || !userProfile?.onboardingData) return;

    const od = userProfile.onboardingData;
    
    const { currentWeek: week, totalWeeks: weeks } = calculateProgramTiming(
      userProfile.createdAt as { seconds: number } | undefined,
      od.goalType || "block",
      od.meetDate,
      od.meetWeeks
    );

    setTotalWeeks(weeks);
    setCurrentWeek(week);

    const freq = parseInt(od.frequency) || 4;
    setTargetFrequency(freq);

    const p = getTrainingPhase(week, weeks);
    setPhase(p);

    let recentLogs: WorkoutLog[] = [];
    try {
      const logsQuery = query(
        collection(db, "users", user.uid, "workoutLogs"),
        orderBy("date", "desc"),
        limit(15)
      );
      const snap = await getDocs(logsQuery);
      recentLogs = snap.docs.map((d) => d.data() as WorkoutLog);
      
      const joinTime = userProfile.createdAt
        ? (userProfile.createdAt as { seconds: number }).seconds * 1000
        : Date.now();
      const currentWeekStart = joinTime + (week - 1) * 7 * 86400000;
      const completedThisWeek = recentLogs.filter(log => {
        const logTime = new Date(log.date).getTime();
        return log.completed && logTime >= currentWeekStart;
      }).length;
      setWeeklySessions(completedThisWeek);

      const trend = analyzeNeuromuscularTrends(recentLogs);
      if (trend) {
        setTrendMessage(trend.message);
        setNeuralStatus(trend.status);
      }
    } catch (e) {}

    // Build the full 4-session plan
    const weekPlan = prescribeFullWeek(
      { 
        squat: parseInt(od.squat) || 225, 
        bench: parseInt(od.bench) || 135, 
        deadlift: parseInt(od.deadlift) || 315 
      },
      recentLogs,
      week,
      weeks,
      freq,
      {
        recoveryProfile: od.recoveryProfile,
        age: parseInt(od.age || "25"),
        weakPoints: od.weakPoints
      }
    );
    setFullWeekPlan(weekPlan);

    // Meet targets
    setMeetTargets({
      squat: estimateMeet1RM(parseInt(od.squat) || 225, weeks - week, "squat"),
      bench: estimateMeet1RM(parseInt(od.bench) || 135, weeks - week, "bench"),
      deadlift: estimateMeet1RM(parseInt(od.deadlift) || 315, weeks - week, "deadlift"),
    });

    // Schedule check
    const mappedLogs = recentLogs.map(l => ({ 
      week: l.week ?? week, 
      completed: l.completed 
    }));
    const advisory = analyzeScheduleCompliance(freq, mappedLogs);
    if (advisory.shouldReduce) {
      setScheduleAdvisory(advisory);
      setShowFrequencyDialog(true);
    }

    setPageLoading(false);
  }

  const [showFrequencyDialog, setShowFrequencyDialog] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const { updatePreferences } = useAuth();

  async function completeIntro() {
    setShowIntro(false);
    try {
      await updatePreferences({ hasSeenDashboardIntro: true });
    } catch (e) {
      console.error("Failed to update intro preference:", e);
    }
  }

  async function updateFrequency(newFreq: number) {
    if (!user) return;
    setPageLoading(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        "onboardingData.frequency": newFreq.toString()
      });
      // Refresh
      await loadProgram();
    } catch (e) {
      console.error(e);
    }
    setShowFrequencyDialog(false);
    setShowSettings(false);
    setPageLoading(false);
  }

  async function logSessionStart(lift: Lift, prescription: SessionPrescription) {
    if (!user) return;
    
    const logRef = await addDoc(collection(db, "users", user.uid, "workoutLogs"), {
      lift,
      week: currentWeek,
      date: new Date().toISOString(),
      movements: prescription.movements,
      completed: false,
      phase: prescription.phase,
      createdAt: serverTimestamp(),
    });

    const encodedMovements = encodeURIComponent(JSON.stringify(prescription.movements));
    router.push(`/workout/active?lift=${lift}&logId=${logRef.id}&p=${encodedMovements}`);
  }

  if (loading || pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 animate-pulse">
        <BrandLogo size={64} glow={false} className="opacity-40" />
        <div className="text-center space-y-3">
          <p className="text-text-secondary text-xs tracking-widest uppercase font-black">Building Program…</p>
          <PassiveQuote className="opacity-100" />
        </div>
      </div>
    );
  }

  const phaseInfo = PHASE_LABELS[phase] ?? PHASE_LABELS.accumulation;

  return (
    <>
      {showIntro && <DashboardIntro onComplete={completeIntro} />}
      <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="pt-4 mb-2 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-1">
            {todayStr}
          </p>
          <h1 className="text-3xl font-black tracking-tight leading-none mb-3">
            Training Session <span className="text-primary">{weeklySessions + 1}</span> <span className="text-white/20">/</span> {targetFrequency}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
             <div className={cn("text-[8px] sm:text-[9px] font-black px-3 py-1.5 rounded-full inline-block uppercase tracking-widest bg-surface border border-white/10", phaseInfo.color)}>
               {phaseInfo.label}
             </div>
             
             {trendMessage && (
               <div className={cn(
                 "text-[8px] sm:text-[9px] font-black px-3 py-1.5 rounded-full inline-block uppercase tracking-widest bg-surface border border-white/10 flex items-center gap-2",
                 neuralStatus === "fatigued" ? "text-red-400 border-red-500/20" : 
                 neuralStatus === "primed" ? "text-green-400 border-green-500/20" : "text-primary border-primary/20"
               )}>
                 <Activity size={10} className={cn(neuralStatus === "fatigued" ? "animate-pulse" : "")} />
                 {neuralStatus === "fatigued" ? "NEURAL SLIPPAGE" : neuralStatus === "primed" ? "MATRIX PRIMED" : "NEURAL SYNC"}
               </div>
             )}

             <p className="text-text-secondary text-[9px] sm:text-[10px] font-black tracking-widest uppercase">
               {userProfile?.onboardingData?.goalType === "meet" 
                 ? `${totalWeeks - currentWeek} Weeks to Competition` 
                 : `Week ${currentWeek} of ${totalWeeks}`}
             </p>
          </div>
        </div>
        
        <div className="flex gap-2 sm:gap-3 shrink-0 items-center">
          <button 
            onClick={() => router.push("/workout/week")}
            className="bg-white/5 border border-white/20 hover:bg-white/10 hover:border-primary/60 rounded-3xl px-6 sm:px-8 py-4 transition-all duration-300 group flex items-center gap-4 shrink-0 shadow-lg shadow-black/20"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:bg-primary/20 transition-all border border-primary/20">
              <Layout size={20} className="sm:size-[24px]" />
            </div>
            <div className="text-left">
               <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-text-secondary group-hover:text-white transition-colors">Birdseye View</p>
               <p className="text-xs sm:text-sm font-black text-white leading-tight">Weekly Hub</p>
            </div>
          </button>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl p-2.5 sm:p-3 transition-all duration-300 text-text-secondary hover:text-white"
          >
            <Settings size={20} className={cn(showSettings && "rotate-90", "transition-transform duration-500 sm:size-[22px]")} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-surface border border-white/10 rounded-3xl p-6 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest">Program Settings</h3>
            <button onClick={() => setShowSettings(false)} className="text-text-secondary hover:text-white"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-[10px] font-black uppercase text-text-secondary mb-3">Training Frequency</p>
              <div className="flex gap-2">
                {[3, 4].map(f => (
                  <button
                    key={f}
                    onClick={() => updateFrequency(f)}
                    className={cn(
                      "flex-1 py-2 rounded-xl text-xs font-black transition-all",
                      targetFrequency === f ? "bg-primary text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                    )}
                  >
                    {f} DAYS
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <p className="text-[10px] font-black uppercase text-text-secondary mb-3">Account</p>
              <button
                onClick={() => signOut(auth)}
                className="w-full py-2 rounded-xl text-xs font-black bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={14} />
                SIGN OUT
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-text-secondary text-sm leading-relaxed max-w-lg mb-8 opacity-80">
        Your prescribed 4-session sequence for the week. Follow the path below in order to maximize your strength peaks.
      </p>

      {/* Frequency Dialog (Adaptive Coach) */}
      {showFrequencyDialog && targetFrequency === 4 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-surface border border-white/10 rounded-[3rem] p-10 max-w-md w-full shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] -z-10" />
             
             <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center text-primary mb-8">
               <Clock size={32} />
             </div>

             <h2 className="text-3xl font-black tracking-tight mb-4">Life getting in the way?</h2>
             <p className="text-text-secondary text-sm leading-relaxed mb-8">
               We've noticed you've missed a few sessions lately. To keep your momentum high and prevent burnout, your coach suggests scaling to **3 days per week**.
               <br/><br/>
               You can always scale back up to 4 when your schedule clears.
             </p>

             <div className="space-y-3">
               <button 
                 onClick={() => updateFrequency(3)}
                 className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all"
               >
                 Adapt to 3 Sessions
               </button>
               <button 
                 onClick={() => setShowFrequencyDialog(false)}
                 className="w-full py-5 bg-white/5 text-white/60 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all"
               >
                 Keep it at 4 for now
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Schedule Advisory */}
      {scheduleAdvisory?.shouldReduce && !showFrequencyDialog && (
        <div className="flex gap-3 items-start p-4 rounded-2xl bg-orange-400/10 border border-orange-400/20 text-orange-300">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-sm leading-relaxed">{scheduleAdvisory.message}</p>
        </div>
      )}

      {/* Sequential Session Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        {fullWeekPlan.map((p, idx) => {
          const isNext = idx === weeklySessions;
          const isDone = idx < weeklySessions;
          const primary = p.movements[0];
          const topSet = primary.sets[0];
          
          return (
            <div 
              key={idx}
              className={cn(
                "group relative bg-surface border rounded-[2.5rem] p-8 transition-all duration-500 overflow-hidden flex flex-col justify-between h-full",
                isNext 
                  ? "border-primary/50 shadow-[0_0_40px_rgba(59,130,246,0.15)] ring-1 ring-primary/20" 
                  : "border-white/5 opacity-60 hover:opacity-90"
              )}
            >
              {isDone && (
                <div className="absolute top-6 right-8 text-green-400 flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Completed</span>
                </div>
              )}
              
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary/60">
                    Session {idx + 1} / {targetFrequency}
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight capitalize mb-6">
                   {p.lift} Focus
                </h3>

                <div className="flex items-center gap-6">
                  <div>
                     <p className="text-[10px] text-text-secondary/60 uppercase mb-1.5 font-black tracking-wider">Top Set</p>
                     <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-black font-mono text-white leading-none">
                        {topSet.weight}
                      </span>
                      <span className="text-text-secondary/60 font-black text-[10px] uppercase">lbs</span>
                     </div>
                  </div>
                  <div className="h-10 w-px bg-white/10" />
                  <div>
                    <p className="text-[10px] text-text-secondary/60 uppercase mb-1.5 font-black tracking-wider">Target</p>
                    <p className="text-2xl font-black font-mono text-white leading-none">
                      {topSet.reps} @ {topSet.rpeTarget}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-8 pt-6 border-t border-white/5">
                {p.movements.slice(0, 3).map((m, mIdx) => (
                  <div key={mIdx} className="flex items-center justify-between">
                    <span className="text-white/80 font-bold text-xs uppercase tracking-wider">{m.name}</span>
                    <span className="font-mono text-[10px] font-black text-white/40">
                      {m.sets.length} SETS
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => logSessionStart(p.lift as any, p)}
                className={cn(
                  "h-16 font-black uppercase tracking-widest text-xs rounded-2xl w-full flex items-center justify-center transition-all duration-300",
                  isNext 
                    ? "btn-glow-trail text-primary border border-primary/20" 
                    : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                )}
              >
                <div className="flex items-center gap-2">
                  {isDone ? "Repeat Session" : isNext ? "Start Session" : "Start Session"}
                  <ChevronRight size={18} />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <PassiveQuote className="my-12 opacity-100" />

      {/* Futuristic Analytics HUD */}
      <div className="bg-surface/30 backdrop-blur-md rounded-[3rem] p-10 border border-white/5 relative overflow-hidden group shadow-2xl transition-all duration-700 hover:border-primary/20">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/5 blur-[100px] -z-10 group-hover:bg-primary/10 transition-all duration-1000" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-accent/5 blur-[100px] -z-10 group-hover:bg-accent/10 transition-all duration-1000" />
        
        <div className="flex flex-col items-center justify-center text-center w-full mb-12 relative z-10 border-b border-white/10 pb-8">
          <h2 className="text-xs font-black uppercase tracking-[0.6em] text-white/90">
            Peak Performance Matrix
          </h2>
          <p className="text-[7px] font-black uppercase tracking-[0.3em] text-primary mt-2 opacity-50">
            Real-time Neural Analysis
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 relative z-10 max-w-2xl mx-auto">
          {(["squat", "bench", "deadlift"] as Lift[]).map((lift, idx) => {
            const target = meetTargets[lift];
            // Arc math
            const r = 54;
            const circ = 2 * Math.PI * r;
            const trackDash = circ * 0.75;
            const trackGap  = circ * 0.25;
            const fillDash  = circ * 0.55; 
            const fillGap   = circ - fillDash;

            const colors = [
              { stroke: "#22d3ee", glow: "rgba(34,211,238,0.5)"  },
              { stroke: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
              { stroke: "#fb923c", glow: "rgba(251,146,60,0.5)"  },
            ];
            const { stroke, glow } = colors[idx];

            return (
              <div 
                key={lift} 
                onClick={() => router.push(`/workout/matrix/${lift}`)}
                className="flex flex-col items-center gap-4 group/gauge cursor-pointer relative"
              >
                {/* FLOATING INTERACTION STICKER (Fixed to the ring) */}
                <div className="absolute top-0 right-0 z-20 pointer-events-none animate-bounce flex flex-col items-center">
                  <div className="bg-primary/20 backdrop-blur-md border border-primary/40 text-primary text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.3)] tracking-widest leading-none">
                    Lift Progress Analysis
                  </div>
                  <div className="w-[1px] h-4 bg-gradient-to-b from-primary/40 to-transparent" />
                </div>

                {/* Self-contained SVG gauge */}
                <div className="relative w-36 h-36 group-hover/gauge:scale-110 transition-transform duration-500">
                  <svg viewBox="0 0 160 160" className="w-full h-full rotate-[-225deg]">
                    {/* Background track — 270° arc */}
                    <circle
                      cx="80" cy="80" r={r}
                      fill="none"
                      stroke="white"
                      strokeOpacity="0.05"
                      strokeWidth="4"
                      strokeDasharray={`${trackDash} ${trackGap}`}
                      strokeLinecap="round"
                    />
                    {/* Coloured progress arc */}
                    <circle
                      cx="80" cy="80" r={r}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity="0.9"
                      strokeWidth="4"
                      strokeDasharray={`${fillDash} ${fillGap}`}
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
                      className="group-hover/gauge:stroke-[6] transition-all duration-300"
                    />
                  </svg>

                  {/* Centred text (Grows and shifts on hover to make room for 'VIEW') */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 group-hover/gauge:-translate-y-2 transition-transform duration-500">
                    <span className="text-3xl font-black font-mono tracking-tight leading-none text-white group-hover/gauge:text-primary transition-colors">
                      {target}
                    </span>
                    <span className="text-[8px] font-black uppercase tracking-[0.25em] text-white/30 group-hover/gauge:text-white/60 transition-colors">
                      lbs
                    </span>
                  </div>

                  {/* Hidden 'VIEW' affordance that slides up on hover */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pt-10 opacity-0 group-hover/gauge:opacity-100 group-hover/gauge:translate-y-2 transition-all duration-500 pointer-events-none">
                     <div className="flex items-center gap-1.5 text-primary">
                       <span className="text-[11px] font-black uppercase tracking-[0.25em] drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">View Details</span>
                       <Maximize2 size={12} className="stroke-[3]" />
                     </div>
                  </div>

                  {/* Matrix Hover Illumination Glow Overlay */}
                  <div 
                    className="absolute inset-0 -z-10 bg-gradient-to-tr from-transparent to-white/5 opacity-0 group-hover/gauge:opacity-100 blur-2xl transition-opacity duration-700 pointer-events-none"
                    style={{ backgroundColor: `${stroke}10` }}
                  />
                  
                  {/* Outer Ring Pulse (Subtle Interactive Cue) */}
                  <div className={cn(
                    "absolute inset-0 border border-white/10 rounded-full -z-10 transition-all duration-1000",
                    "group-hover/gauge:scale-125 group-hover/gauge:opacity-0 group-hover/gauge:border-primary/40",
                    "animate-[pulse_4s_infinite_ease-in-out]"
                  )} />
                  <div className="absolute inset-[-4px] border border-white/5 rounded-full -z-20 opacity-20 pointer-events-none" />
                </div>

                {/* Label + sparkline */}
                <div className="text-center relative">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 group-hover/gauge:text-white transition-all">
                      {LIFT_LABELS[lift]}
                    </p>
                    <Maximize2 size={10} className="text-white/20 group-hover/gauge:text-primary transition-colors duration-500" />
                  </div>
                  
                  <svg viewBox="0 0 80 12" className="w-24 h-4 opacity-20 group-hover/gauge:opacity-100 group-hover/gauge:translate-y-[-2px] transition-all duration-500 mx-auto overflow-visible">
                    {/* Shadow Pulse (Phantom Frequency) */}
                    <path
                      d="M0 6 L15 6 L17 4 L19 8 L21 6 L35 6 L37 2 L39 10 L41 6 L60 6 L62 3 L64 9 L66 6 L80 6"
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1"
                      strokeOpacity="0.2"
                      className="animate-[pulse_3s_infinite]"
                    />
                    {/* Sharp Data Pulse */}
                    <path
                      d="M0 6 L15 6 L17 4 L19 8 L21 6 L35 6 L37 2 L39 10 L41 6 L60 6 L62 3 L64 9 L66 6 L80 6"
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.2"
                      strokeLinejoin="miter"
                      className="drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                    />
                  </svg>

                  {/* Pre-hover Affordance Hint (Always subtly visible) */}
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/gauge:opacity-100 transition-opacity duration-300">
                     <span className="text-[7px] font-black uppercase tracking-widest text-primary/60">Tap to expand</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Interface */}
      <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-30">
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {[1, 2].map(i => <div key={i} className="w-6 h-6 rounded-full border-2 border-surface bg-white/5" />)}
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em]">
             {totalWeeks - currentWeek} Cycles Remaining <span className="text-white/20">|</span> Proto-V.2.8.4
          </p>
        </div>
        <div className="flex items-center gap-6 text-[8px] font-bold uppercase tracking-widest">
           <span className="hover:text-primary transition-colors cursor-pointer">Security Protocol Active</span>
           <span className="hover:text-primary transition-colors cursor-pointer">Neural Training Matrix</span>
        </div>
      </div>
    </div>
  </>
);
}
