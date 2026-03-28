"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Activity, Trophy, ArrowRight, Settings, LogOut } from "lucide-react";
import { useAuth, type UserProfile } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import type { WorkoutLog } from "@/lib/programming/periodization";
import { cn } from "@/lib/utils";
import { ProgrammingTransparency } from "@/components/ui/ProgrammingTransparency";

// ─────────────────────────────────────────────────────────────────────────────
// STREAK LOGIC
// ─────────────────────────────────────────────────────────────────────────────
function calculateStreak(logs: WorkoutLog[], targetFreq: number): number {
  if (logs.length === 0) return 0;

  // Group logs by week
  const logsByWeek = logs.reduce((acc, log) => {
    const w = log.week || 1;
    acc[w] = (acc[w] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  const weeks = Object.keys(logsByWeek).map(Number).sort((a, b) => b - a);
  const currentWeek = weeks[0];
  
  let streak = 0;
  
  // Check backwards from the current week
  // We'll walk down from currentWeek to 1. 
  // If a week is missing or under the target, the streak breaks.
  // Exception: the current active week shouldn't break the streak if we are still in it.
  
  for (let w = currentWeek; w >= 1; w--) {
    const count = logsByWeek[w] || 0;
    
    if (count >= targetFreq) {
      streak++;
    } else if (w === currentWeek) {
      // Still in progress, don't count it but don't break yet
      continue;
    } else {
      // Missed a previous week's target
      break;
    }
  }

  return streak;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG SPARKLINE COMPONENTS (Minimalist 1RM & Volume charts limit weight)
// ─────────────────────────────────────────────────────────────────────────────


function BarChart({ data, colorVariant = "primary" }: { data: number[]; colorVariant?: "primary" | "accent" | "orange" }) {
  if (data.length === 0) return null;
  const max = Math.max(...data) || 1;
  const colorClass = 
    colorVariant === "primary" ? "bg-primary" : 
    colorVariant === "accent" ? "bg-accent" : 
    "bg-orange-400";

  return (
    <div className="flex h-16 items-end gap-1 w-full justify-between mt-2">
      {data.map((val, i) => {
        const heightPct = Math.max((val / max) * 100, 5); // min 5% height
        return (
          <div key={i} className="w-full h-full flex items-end group relative">
            <div 
              className={cn("w-full rounded-t-sm transition-all duration-500 opacity-80 group-hover:opacity-100", colorClass)}
              style={{ height: `${heightPct}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();
  const { user, userProfile, loading, signOut, updatePreferences } = useAuth();
  
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth"); return; }
    if (!userProfile?.onboardingComplete) { router.replace("/onboarding"); return; }

    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, userProfile]);

  async function fetchStats() {
    if (!user) return;
    try {
      const logsQuery = query(
        collection(db, "users", user.uid, "workoutLogs"),
        orderBy("date", "asc") // Oldest to newest
      );
      const snap = await getDocs(logsQuery);
      const fetchedLogs = snap.docs.map(d => d.data() as WorkoutLog);
      
      // Filter fully completed sessions (not strictly required if we just want volume, but ensures accuracy)
      setLogs(fetchedLogs.filter(l => l.completed));
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setStatsLoading(false);
    }
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  if (loading || statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] animate-pulse gap-4">
        <Activity size={48} className="text-primary opacity-50" />
        <p className="text-xs tracking-widest uppercase text-text-secondary">Loading Stats…</p>
      </div>
    );
  }

  // Calculate stats
  const targetFreq = parseInt(userProfile?.onboardingData?.frequency || "3");
  const streak = calculateStreak(logs, targetFreq);
  // Calculate total volume across all logged sets (sum of weight × reps per set)
  const totalVolume = logs.reduce((sum, l) => {
    if (!Array.isArray(l.sets)) return sum;
    return sum + l.sets.reduce((sv, s) => sv + (s.weight * s.reps), 0);
  }, 0);
  const totalWorkouts = logs.length;

  // Volume trend per lift using the new sets array
  const defaultTrend = [1000, 1200, 1150, 1400, 1600];
  const calcVolume = (l: WorkoutLog) => Array.isArray(l.sets) ? l.sets.reduce((sv, s) => sv + (s.weight * s.reps), 0) : 0;
  const squatVolumeTrend = logs.filter(l => l.lift === "squat").slice(-7).map(calcVolume);
  const benchVolumeTrend = logs.filter(l => l.lift === "bench").slice(-7).map(calcVolume);
  const deadliftVolumeTrend = logs.filter(l => l.lift === "deadlift").slice(-7).map(calcVolume);

  return (
    <div className="max-w-3xl mx-auto w-full px-4 md:px-8 py-4 md:py-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
      {/* Header Profile Info */}
      <div className="pt-6 pb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white mb-1">
            {userProfile?.username || "Athlete"}
          </h1>
          <p className="text-xs font-mono text-text-secondary tracking-widest uppercase">
            {userProfile?.isGuest ? "Guest Mode" : "Registered Athlete"}
          </p>
        </div>
        
        {/* Settings / Signout Actions */}
        <div className="flex gap-2">
          {userProfile?.isGuest && (
            <button 
              onClick={() => router.push("/profile-setup")}
              className="px-3 py-1.5 rounded-lg bg-surface border border-primary/30 text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary/10 transition-colors"
            >
              Save Account
            </button>
          )}
          <button 
            onClick={handleSignOut}
            className="p-2 rounded-lg bg-surface border border-white/5 text-text-secondary hover:text-orange-400 transition-colors"
            aria-label="Sign Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Gamification Grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {/* Streak Counter */}
        <div className="bg-surface rounded-2xl p-4 border border-white/5 relative overflow-hidden group">
          <div className={cn(
            "absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500",
            streak > 0 ? "bg-orange-500" : "bg-white"
          )} />
          <div className="flex items-center gap-2 mb-2 text-text-secondary">
            <Flame size={16} className={streak > 0 ? "text-orange-400" : ""} />
            <span className="text-xs font-bold uppercase tracking-widest">Streak</span>
          </div>
          <p className="text-4xl font-black font-mono tracking-tighter">
            {streak} <span className="text-lg text-text-secondary tracking-normal">{streak === 1 ? 'week' : 'weeks'}</span>
          </p>
        </div>

        {/* Total Workouts */}
        <div className="bg-surface rounded-2xl p-4 border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
          <div className="flex items-center gap-2 mb-2 text-text-secondary">
            <Trophy size={16} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest">Sessions</span>
          </div>
          <p className="text-4xl font-black font-mono tracking-tighter">
            {totalWorkouts}
          </p>
        </div>
      </div>


      {/* Volume History Dashboard (Bar Charts) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
          <Activity size={16} />
          Volume History
        </h2>
        
        <div className="space-y-3">
          <div className="bg-surface rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-end mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Squat Volume</p>
            </div>
            <BarChart data={squatVolumeTrend.length > 2 ? squatVolumeTrend : defaultTrend.map(v => v * 1.2)} colorVariant="primary" />
          </div>

          <div className="bg-surface rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-end mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Bench Volume</p>
            </div>
            <BarChart data={benchVolumeTrend.length > 2 ? benchVolumeTrend : defaultTrend.map(v => v * 0.8)} colorVariant="accent" />
          </div>

          <div className="bg-surface rounded-xl p-4 border border-white/5">
            <div className="flex justify-between items-end mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-text-secondary">Deadlift Volume</p>
            </div>
            <BarChart data={deadliftVolumeTrend.length > 2 ? deadliftVolumeTrend : defaultTrend.map(v => v * 1.5)} colorVariant="orange" />
          </div>
        </div>

        {/* Global Stats */}
        <div className="pt-6 border-t border-white/5 mt-6">
          <p className="text-xs text-text-secondary uppercase tracking-widest mb-1">Lifetime Tonnage</p>
          <p className="text-2xl font-black font-mono tracking-tight text-white flex items-end gap-2">
            {(totalVolume / 2000).toFixed(2)} <span className="text-sm text-text-secondary font-sans font-medium mb-1 tracking-normal uppercase">Tons Moved</span>
          </p>
        </div>
      </div>

      {/* Programming AI Transparency Section */}
      <div className="mt-12">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2 mb-6">
          <Activity size={16} />
          Training Architecture
        </h2>
        <ProgrammingTransparency />
      </div>

      {/* Preferences Section (The "Kill Switch") */}
      <div className="mt-12 pt-8 border-t border-white/5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2 mb-6">
          <Settings size={16} />
          App Preferences
        </h2>
        
        <div className="bg-surface/50 rounded-2xl p-6 border border-white/5 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">Motivational Cues</p>
            <p className="text-[10px] text-text-secondary mt-1">Show powerlifting quotes in liminal spaces.</p>
          </div>
          <button 
            onClick={() => {
              const current = userProfile?.preferences?.showQuotes ?? true;
              updatePreferences({ showQuotes: !current });
            }}
            className={cn(
              "w-12 h-6 rounded-full transition-all duration-300 relative",
              (userProfile?.preferences?.showQuotes ?? true) ? "bg-primary" : "bg-white/10"
            )}
          >
            <div className={cn(
              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300",
              (userProfile?.preferences?.showQuotes ?? true) ? "left-7" : "left-1"
            )} />
          </button>
        </div>
      </div>
    </div>
  );
}
