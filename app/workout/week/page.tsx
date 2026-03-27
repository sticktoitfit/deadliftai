"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Layout, Calendar, CheckCircle2, Info } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { 
  prescribeFullWeek, 
  getTrainingPhase,
  type SessionPrescription,
  type WorkoutLog 
} from "@/lib/programming/periodization";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { cn } from "@/lib/utils";

export default function WeeklyHubPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const [weeklyPlan, setWeeklyPlan] = useState<SessionPrescription[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(1);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth"); return; }
    loadWeeklyPlan();
  }, [loading, user]);

  async function loadWeeklyPlan() {
    if (!user || !userProfile?.onboardingData) return;
    const od = userProfile.onboardingData;
    
    // Time calculation
    const joinTime = userProfile.createdAt
      ? (userProfile.createdAt as { seconds: number }).seconds * 1000
      : Date.now();
    const daysSince = Math.floor((Date.now() - joinTime) / 86400000);
    const weeksTotal = parseInt(od.meetWeeks) || 12;
    const week = Math.max(1, Math.min(Math.floor(daysSince / 7) + 1, weeksTotal));
    setCurrentWeek(week);

    // Fetch logs for fatigue adjustment
    let recentLogs: WorkoutLog[] = [];
    try {
      const q = query(collection(db, "users", user.uid, "workoutLogs"), orderBy("date", "desc"), limit(12));
      const snap = await getDocs(q);
      recentLogs = snap.docs.map(d => d.data() as WorkoutLog);
    } catch (e) {}

    const plan = prescribeFullWeek(
      { 
        squat: parseInt(od.squat) || 225, 
        bench: parseInt(od.bench) || 135, 
        deadlift: parseInt(od.deadlift) || 315 
      },
      recentLogs as any,
      week,
      weeksTotal
    );

    setWeeklyPlan(plan);
    setPageLoading(false);
  }

  if (loading || pageLoading) return <div className="p-8 text-center animate-pulse text-text-secondary uppercase tracking-widest text-xs">Generating Microcycle...</div>;

  return (
    <div className="max-w-3xl mx-auto px-6 md:px-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <header className="py-8">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-6 group"
        >
          <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back to Dashboard</span>
        </button>
        
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Microcycle Overview</p>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">Weekly Hub</h1>
          </div>
          <div className="md:text-right shrink-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary opacity-60 mb-1">Current Status</p>
            <p className="text-xl font-black tracking-tight text-white">Week {currentWeek}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {weeklyPlan.map((session, idx) => (
          <div 
            key={idx}
            className="bg-surface border border-white/5 rounded-[2.5rem] p-8 relative overflow-hidden group hover:border-primary/30 transition-all duration-500"
          >
            {/* Background number */}
            <span className="absolute -top-4 -right-2 text-8xl font-black text-white/[0.02] select-none group-hover:text-primary/[0.03] transition-colors">{idx + 1}</span>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                <Layout size={20} />
              </div>
              <div>
                <h3 className="font-black text-2xl tracking-tight capitalize">{session.lift} Focus</h3>
                <p className="text-xs font-black uppercase tracking-widest text-text-secondary opacity-80">Session {idx + 1} / {weeklyPlan.length}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {session.movements.map((m, mIdx) => {
                const topSet = m.sets[0];
                return (
                  <div key={mIdx} className="bg-white/[0.02] rounded-2xl p-4 flex items-center justify-between border border-white/5 group-hover:border-white/10 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">{m.type}</span>
                      <span className="font-bold text-base text-white">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Loads</span>
                        <span className="font-mono text-sm font-bold text-white">{topSet.weight} lbs</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Prescription</span>
                        <span className="font-mono text-sm font-bold text-white">{m.sets.length} × {topSet.reps} @ {topSet.rpeTarget}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex items-start gap-3 opacity-90 group-hover:opacity-100 transition-opacity">
              <Info size={16} className="shrink-0 mt-0.5 text-primary" />
              <p className="text-sm text-text-secondary leading-relaxed">{session.overallNote}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 p-8 rounded-[2.5rem] bg-primary/5 border border-primary/10 text-center">
        <Calendar size={32} className="text-primary mx-auto mb-4" />
        <h3 className="font-black text-lg mb-2 leading-tight">Block Continuity</h3>
        <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
          This hub adapts in real-time. As you finish sessions, the intensity of upcoming days adjusts based on your actual performance and RPE trends.
        </p>
      </div>
    </div>
  );
}
