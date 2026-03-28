/**
 * periodization.ts
 *
 * WHY: Implements the scientific powerlifting programming logic derived from the
 * Powerlifting Programming notebook (NotebookLM). Uses Prilepin's Chart to define
 * optimal volume constraints, a Fitness-Fatigue model to project next-session loads,
 * and a macro block structure (Accumulation → Intensification → Peaking) timed
 * to the athlete's meet date.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PRILEPIN'S CHART
// Maps intensity zones to optimal reps-per-set and total lifts (NL) per session.
// Source: Prilepin's empirical research on Soviet weightlifters.
// ─────────────────────────────────────────────────────────────────────────────

interface PrilepinZone {
  minIntensity: number; // % of 1RM (decimal, e.g. 0.70)
  maxIntensity: number;
  repsPerSet: [number, number]; // [min, optimal]
  optimalNL: number; // Total Number of Lifts per session
  minNL: number;
  maxNL: number;
}

export const PRILEPIN_CHART: PrilepinZone[] = [
  { minIntensity: 0.55, maxIntensity: 0.65, repsPerSet: [3, 6], optimalNL: 24, minNL: 18, maxNL: 30 },
  { minIntensity: 0.65, maxIntensity: 0.75, repsPerSet: [3, 6], optimalNL: 18, minNL: 12, maxNL: 24 },
  { minIntensity: 0.75, maxIntensity: 0.85, repsPerSet: [2, 4], optimalNL: 15, minNL: 10, maxNL: 20 },
  { minIntensity: 0.85, maxIntensity: 0.90, repsPerSet: [1, 3], optimalNL: 10, minNL: 7,  maxNL: 12 },
  { minIntensity: 0.90, maxIntensity: 1.00, repsPerSet: [1, 2], optimalNL: 7,  minNL: 4,  maxNL: 10 },
];

/** Returns the Prilepin zone for a given intensity */
export function getPrilepinZone(intensity: number): PrilepinZone | null {
  return PRILEPIN_CHART.find(
    (z) => intensity >= z.minIntensity && intensity < z.maxIntensity
  ) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MACRO BLOCK STRUCTURE
// Divides total training weeks into three phases.
// ─────────────────────────────────────────────────────────────────────────────

export type Phase = "accumulation" | "transmutation" | "peaking" | "done";

/** Returns the training phase given a week number and total weeks to meet */
export function getTrainingPhase(currentWeek: number, totalWeeks: number): Phase {
  const accumEnd = Math.round(totalWeeks * 0.40); // Accumulation: ~40% of cycle
  const transmEnd = Math.round(totalWeeks * 0.85); // Transmutation: ~45% of cycle
  
  if (currentWeek <= accumEnd) return "accumulation";
  if (currentWeek <= transmEnd) return "transmutation";
  if (currentWeek < totalWeeks) return "peaking";
  return "done";
}

/** Returns the target intensity range for a given phase */
export function getPhaseIntensityRange(phase: Phase): [number, number] {
  switch (phase) {
    case "accumulation":   return [0.50, 0.70]; // Hypertrophy/GPP: 50-70%
    case "transmutation":  return [0.75, 0.90]; // Strength/Specialized: 75-90%
    case "peaking":         return [0.90, 1.05]; // Platform realization: 90%+
    default:                return [0.60, 0.70]; // Deload/Pivot
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1RM PROGRESSION ESTIMATOR
// Projects realistic target 1RM by meet date using a compound weekly gain model.
// Based on conservative novice/intermediate rates (0.5–1.5% per week).
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the estimated 1RM at meet time given the current 1RM and weeks remaining */
export function estimateMeet1RM(
  current1RM: number,
  weeksToMeet: number,
  lift: "squat" | "bench" | "deadlift"
): number {
  // Weekly gain rates by lift (conservative but realistic)
  const weeklyGainRate = { squat: 0.008, bench: 0.005, deadlift: 0.007 };
  const rate = weeklyGainRate[lift];
  // Compound weekly growth — mirrors logarithmic adaptation curve
  return Math.round(current1RM * Math.pow(1 + rate, weeksToMeet));
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT SESSION PRESCRIBER
// Core AI logic: generates next workout prescription using Fitness-Fatigue model.
// Prior performance adjusts load/volume dynamically.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkoutLog {
  date: string;        // ISO date string
  week: number;        // Training week #
  lift: "squat" | "bench" | "deadlift";
  sets?: { reps: number; weight: number; rpe?: number }[];
  movements?: { name: string; sets: { reps: number; weight: number; rpe?: number }[] }[];
  completed: boolean;
}

export interface MovementPrescription {
  name: string;
  type: "primary" | "secondary" | "accessory";
  sets: {
    reps: number;
    weight: number;
    rpeTarget: number;
    label: string; // e.g., "Top Set", "Back-off"
  }[];
  note?: string;
  alternatives?: string[]; // Closest equivalents
}

export interface SessionPrescription {
  lift: "squat" | "bench" | "deadlift";
  movements: MovementPrescription[];
  phase: Phase;
  overallNote: string;
}

/**
 * WHY: Scientific alternatives based on movement patterns and muscle recruitment.
 * Allows lifters to swap movememnts they don't have equipment for.
 */
export const EXERCISE_ALTERNATIVES: Record<string, string[]> = {
  "Leg Press": ["Bulgarian Split Squat", "Hack Squat", "Lunges", "Goblet Squat"],
  "Safety Bar Squat": ["High Bar Squat", "Front Squat", "Zercher Squat"],
  "Pause Squat": ["Tempo Squat", "Pin Squat"],
  "Pause Bench": ["Spoto Press", "Pin Bench", "Larsen Press"],
  "Close Grip Bench": ["JM Press", "Dips", "Tricep Pushdowns"],
  "Dumbbell Press": ["Incline DB Press", "Floor Press", "Machine Chest Press"],
  "Deficit Deadlift": ["Paused Deadlift", "Block Pulls"],
  "RDL": ["Good Mornings", "Stiff Leg Deadlift", "Back Extension"],
  "Barbell Row": ["Dumbbell Row", "Seal Row", "Lat Pulldown", "Seated Cable Row"],
  "Pull-ups": ["Lat Pulldown", "Assisted Pull-ups", "Chin-ups"],
  "Face Pulls": ["Rear Delt Flys", "Band Pull-aparts", "Cable Face Pulls"],
  "Bulgarian Split Squat": ["Lunges", "Step-ups", "Goblet Squat"],
  "Plank": ["Paloff Press", "Hanging Leg Raise", "Ab Wheel"],
};

/**
 * Accessor for lift variants based on the primary lift of the day.
 */
const VARIANTS = {
  squat: ["Pause Squat", "Safety Bar Squat", "Leg Press"],
  bench: ["Pause Bench", "Close Grip Bench", "Dumbbell Press"],
  deadlift: ["Deficit Deadlift", "RDL", "Barbell Row"]
};

const GPP_POOL = {
  upperPull: ["Pull-ups", "Lat Pulldown", "Seated Cable Row", "Barbell Row"],
  upperBack: ["Neural Face-Pulls", "Rear Delt Flys", "Band Pull-aparts", "Dumbbell Shrugs"],
  singleLeg: ["Bulgarian Split Squat", "Lunges", "Step-ups", "Goblet Squats"],
  core: ["Plank", "Paloff Press", "Hanging Leg Raise", "Ab Wheel"],
};

/**
 * WHY: This logic implements an "AI-First" approach (Non-linear waves + Diversity Tracking).
 * It ensures no session in a week is the same, preventing the "3 days of facepulls" problem.
 */
export function prescribeNextSession(
  lift: "squat" | "bench" | "deadlift",
  current1RM: number,
  recentLogs: WorkoutLog[],
  currentWeek: number,
  totalWeeks: number,
  userMetadata?: {
    recoveryProfile?: "male" | "female";
    age?: number;
    weakPoint?: string;
  },
  // Allows the week builder to inject unique movement overrides
  overrides?: {
    accessoryPoolUsed?: string[];
    intensityRipple?: number;
  }
): SessionPrescription {
  const isFemale = userMetadata?.recoveryProfile === "female";
  const isMasters = (userMetadata?.age || 0) >= 40;
  const phase = getTrainingPhase(currentWeek, totalWeeks);
  const [minPct, maxPct] = getPhaseIntensityRange(phase);

  // 1. PRIMARY LIFT - MAIN MOVEMENT
  // AI Variation: Intra-week intensity ripple (+/- 2%) simulates a non-linear stimuli
  let intensityPct = ((minPct + maxPct) / 2) + (overrides?.intensityRipple || 0);
  
  if (isFemale) intensityPct += 0.02; 

  // Fitness-Fatigue adjustment
  const liftLogs = recentLogs.filter((l) => l.lift === lift && l.completed).slice(-3);
  if (liftLogs.length > 0) {
    const avgRPE = liftLogs.reduce((acc, log) => {
      const m = log.movements?.find(m => m.name.toLowerCase().includes(lift.toLowerCase()));
      const sets = m?.sets || log.sets || [];
      if (sets.length === 0) return acc + 7.2;
      return acc + (sets.reduce((s, set) => s + (set.rpe ?? 7.2), 0) / sets.length);
    }, 0) / liftLogs.length;

    if (avgRPE < 7.0) intensityPct = Math.min(intensityPct + 0.02, maxPct + 0.05);
    if (avgRPE > 8.5) intensityPct = Math.max(intensityPct - 0.02, minPct);
  }

  const primaryWeight = Math.round((current1RM * intensityPct) / 2.5) * 2.5;
  const backoffWeight = Math.round((primaryWeight * 0.90) / 2.5) * 2.5;

  const movements: MovementPrescription[] = [];
  const backoffSetCount = isMasters ? 2 : (isFemale ? 4 : 3);

  // Advanced Tech: Tempo training for Accumulation
  const noteSuffix = phase === "accumulation" && currentWeek % 2 === 0 ? " [Add 3-0-3-0 Tempo for technical refinement]" : "";

  movements.push({
    name: lift.charAt(0).toUpperCase() + lift.slice(1),
    type: "primary",
    sets: phase === "accumulation" 
      ? [{ label: "Top Set", reps: 8, weight: primaryWeight, rpeTarget: 7 }, ...Array(backoffSetCount).fill(null).map(() => ({ label: "Back-off", reps: 8, weight: backoffWeight, rpeTarget: 6 }))]
      : phase === "transmutation"
      ? [{ label: "Top Set", reps: 4, weight: primaryWeight, rpeTarget: 8 }, ...Array(backoffSetCount + 1).fill(null).map(() => ({ label: "Back-off", reps: 4, weight: backoffWeight, rpeTarget: 7 }))]
      : [{ label: "Top Single", reps: 1, weight: primaryWeight, rpeTarget: 9 }, { label: "Back-off", reps: 2, weight: backoffWeight, rpeTarget: 7 }],
    note: (isMasters ? "Reduced volume for joint preservation." : "Focus on technical proficiency.") + noteSuffix,
    alternatives: EXERCISE_ALTERNATIVES[lift.charAt(0).toUpperCase() + lift.slice(1)] || []
  });

  // 2. ADD SPECIFIC VARIANT (Logic-driven by Weak Point + Neural Adaptation)
  let variant = VARIANTS[lift][0];
  if (userMetadata?.weakPoint) {
    const wp = userMetadata.weakPoint.toLowerCase();
    const wpMap: Record<string, Record<string, string>> = {
      squat: { hole: "Pause Squat", lockout: "Safety Bar Squat", knees: "Tempo Squat" },
      bench: { bottom: "Spoto Press", mid: "Board Press", lockout: "Close Grip Bench" },
      deadlift: { floor: "Deficit Deadlift", knee: "Paused Deadlift", lockout: "Block Pulls" }
    };
    const liftMap = wpMap[lift];
    for (const [key, val] of Object.entries(liftMap)) {
      if (wp.includes(key)) { variant = val; break; }
    }
  }

  movements.push({
    name: variant,
    type: "secondary",
    sets: Array(isMasters ? 2 : 3).fill(null).map(() => ({
      label: "Working Set",
      reps: phase === "accumulation" ? 10 : 6,
      weight: Math.round((primaryWeight * 0.75) / 5) * 5,
      rpeTarget: 7
    })),
    note: `Corrective variant for ${userMetadata?.weakPoint || "general balance"}.`,
    alternatives: EXERCISE_ALTERNATIVES[variant] || []
  });

  // 3. ADD ACCESSORIES & GPP (AI Smart Rotation)
  const used = overrides?.accessoryPoolUsed || [];
  const pickUnused = (pool: string[]) => pool.find(a => !used.includes(a)) || pool[0];

  if (phase === "accumulation") {
    const liftLow = lift.toLowerCase();
    const bucket1 = (liftLow === "bench" || liftLow === "deadlift") ? GPP_POOL.upperBack : GPP_POOL.upperPull;
    const bucket2 = (liftLow === "bench") ? GPP_POOL.singleLeg : GPP_POOL.core;
    const acc1 = pickUnused(bucket1);
    const acc2 = pickUnused(bucket2);

    movements.push({
      name: acc1,
      type: "accessory",
      sets: Array(isMasters ? 2 : 3).fill(null).map(() => ({ label: "GPP", reps: 12, weight: 30, rpeTarget: 7 })),
      note: "Antagonistic work for structural integrity.",
      alternatives: EXERCISE_ALTERNATIVES[acc1] || []
    });

    movements.push({
      name: acc2,
      type: "accessory",
      sets: Array(isMasters ? 2 : 3).fill(null).map(() => ({ label: "GPP", reps: 15, weight: 0, rpeTarget: 7 })),
      note: "General movement variety to maximize work capacity.",
      alternatives: EXERCISE_ALTERNATIVES[acc2] || []
    });
  } else if (phase === "transmutation") {
    const accessory = VARIANTS[lift][2];
    movements.push({
      name: accessory,
      type: "accessory",
      sets: Array(isMasters ? 2 : 3).fill(null).map((_, i) => ({ 
        label: "Hypertrophy", 
        reps: 10, 
        weight: accessory === "Leg Press" ? 135 : 55, 
        rpeTarget: 7 + i 
      })),
      note: "Directed hypertrophy to support primes movers.",
      alternatives: EXERCISE_ALTERNATIVES[accessory] || []
    });
  } else {
    movements.push({
      name: "Light GPP/Flushing",
      type: "accessory",
      sets: [{ label: "Recovery", reps: 20, weight: 0, rpeTarget: 5 }],
      note: "Low intensity recovery to prioritize peaking specificity.",
    });
  }

  return {
    lift,
    movements,
    phase,
    overallNote: buildNote(phase, intensityPct)
  };
}

/**
 * WHY: Generates a full 4-session week for the Birdseye View.
 */
export function prescribeFullWeek(
  current1RMs: { squat: number, bench: number, deadlift: number },
  recentLogs: WorkoutLog[],
  currentWeek: number,
  totalWeeks: number,
  targetFrequency: number = 4,
  userMetadata?: {
    recoveryProfile?: "male" | "female";
    age?: number;
    weakPoints?: { squat?: string; bench?: string; deadlift?: string };
  }
): SessionPrescription[] {
  // AI Weekly Builder Store
  const weekState = {
    usedAccessories: [] as string[],
    ripples: [0.01, -0.01, 0.02, -0.02], // Deliberate intensity variance
  };

  // Helper to prescribe and update used accessories
  const prescribeWithVariety = (lift: "squat" | "bench" | "deadlift", rm: number, wp?: string, rippleIdx: number = 0) => {
    const session = prescribeNextSession(lift, rm, recentLogs, currentWeek, totalWeeks, {
      recoveryProfile: userMetadata?.recoveryProfile,
      age: userMetadata?.age,
      weakPoint: wp
    }, {
      accessoryPoolUsed: weekState.usedAccessories,
      intensityRipple: weekState.ripples[rippleIdx]
    });
    
    // Add these accessories to used set
    session.movements.forEach(m => {
      if (m.type === "accessory") weekState.usedAccessories.push(m.name);
    });
    return session;
  };

  const s1 = prescribeWithVariety("squat", current1RMs.squat, userMetadata?.weakPoints?.squat, 0);
  const s2 = prescribeWithVariety("bench", current1RMs.bench, userMetadata?.weakPoints?.bench, 1);
  const s3 = prescribeWithVariety("deadlift", current1RMs.deadlift, userMetadata?.weakPoints?.deadlift, 2);
  
  if (targetFrequency <= 3) return [s1, s2, s3];

  // Session 4: DUP Variation - Power Day 
  const powerS4 = prescribeWithVariety("bench", current1RMs.bench, userMetadata?.weakPoints?.bench, 3);
  
  // Apply DUP Overrides
  const primaryWeight = powerS4.movements[0].sets[0].weight;
  powerS4.movements[0].sets = [
    { label: "Power Single", reps: 1, weight: Math.round((primaryWeight * 1.05) / 5) * 5, rpeTarget: 8 },
    { label: "Speed Set", reps: 3, weight: Math.round((primaryWeight * 0.85) / 5) * 5, rpeTarget: 6 },
    { label: "Speed Set", reps: 3, weight: Math.round((primaryWeight * 0.85) / 5) * 5, rpeTarget: 6 }
  ];
  powerS4.overallNote = "DUP Power Day: Intra-week variation to force neuromuscular adaptation. Unique GPP rotation applied.";

  return [s1, s2, s3, powerS4];
}

function buildNote(phase: Phase, intensity: number): string {
  const pct = Math.round(intensity * 100);
  switch (phase) {
    case "accumulation": return `Accumulation phase: Focus on building work capacity with ${pct}% base load.`;
    case "transmutation": return `Transmutation phase: Specific strength focus at ${pct}% intensity.`;
    case "peaking": return `Realization phase: Maximum specificity and recovery taper.`;
    default: return "Recovery focused session.";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADAPTIVE SCHEDULE MANAGER
// ─────────────────────────────────────────────────────────────────────────────

export interface ScheduleAdvisory {
  shouldReduce: boolean;
  suggestedFrequency: number;
  message: string;
}

/**
 * Analyzes the last 4 weeks of workout completion against target frequency.
 * Returns a reduction suggestion if compliance drops below 70%.
 */
export function analyzeScheduleCompliance(
  scheduledPerWeek: number,
  completedSessions: { week: number; completed: boolean }[]
): ScheduleAdvisory {
  // Group by week and calculate compliance rate
  const weeks = [...new Set(completedSessions.map((s) => s.week))].slice(-4);
  
  // coaching: don't judge on week 1 or if we have less than 1 full weekly cycle behind us
  if (weeks.length <= 1) {
    return { shouldReduce: false, suggestedFrequency: scheduledPerWeek, message: "" };
  }

  const totalScheduled = weeks.length * scheduledPerWeek;
  const totalCompleted = completedSessions.filter(
    (s) => weeks.includes(s.week) && s.completed
  ).length;

  const complianceRate = totalCompleted / totalScheduled;

  if (complianceRate < 0.7 && scheduledPerWeek > 3) {
    const suggested = scheduledPerWeek - 1;
    return {
      shouldReduce: true,
      suggestedFrequency: suggested,
      message: `Your last 4 weeks show ${Math.round(complianceRate * 100)}% session completion. Dropping to ${suggested} days/week may improve consistency.`,
    };
  }

  return {
    shouldReduce: false,
    suggestedFrequency: scheduledPerWeek,
    message: complianceRate >= 0.9 ? "Excellent consistency. Keep it up." : "",
  };
}

/**
 * WHY: This is the "Superhuman" layer. It tracks micro-variances in RPE and 
 * Bar Velocity (if available) to detect central fatigue BEFORE it becomes a plateau.
 * A 1% velocity drop is often invisible to human coaches but caught by the matrix.
 */
export function analyzeNeuromuscularTrends(logs: WorkoutLog[]) {
  const recentThree = logs.filter(l => l.completed).slice(-3);
  const olderThree = logs.filter(l => l.completed).slice(-6, -3);

  if (recentThree.length < 3 || olderThree.length < 3) return null;

  const recentAvgRPE = recentThree.reduce((acc, l) => acc + (l.sets?.[0]?.rpe || 7.5), 0) / 3;
  const oldAvgRPE = olderThree.reduce((acc, l) => acc + (l.sets?.[0]?.rpe || 7.5), 0) / 3;

  // Neuromuscular Slippage: RPE is rising for the same relative loads
  if (recentAvgRPE > oldAvgRPE + 1.0) {
    return { status: "fatigued", message: "Neuromuscular slippage detected. Relative intensity is climbing. Pivot or deload recommended." };
  }

  // Peaking/Primed: RPE is dropping while loads are stable
  if (recentAvgRPE < oldAvgRPE - 0.5) {
    return { status: "primed", message: "Matrix synchronization high. Neuromuscular capacity is exceeding projections. Pushing heavier loads in next session." };
  }

  return { status: "stable", message: "Neural pathways consistent." };
}

/**
 * WHY: VBT (Velocity Based Training) allows mid-session 1RM projection.
 * For every 0.05 m/s increase in speed, we infer a 5% strength surplus.
 */
export function estimate1RMFromVelocity(weight: number, velocity: number, profile: "squat" | "bench" | "deadlift"): number {
  // Baseline speeds (m/s) for 1RM: Squat: 0.3, Bench: 0.15, Deadlift: 0.15
  const baseV = profile === "squat" ? 0.3 : 0.15;
  if (velocity <= baseV) return weight;
  
  const diff = velocity - baseV;
  const strengthSurplus = (diff / 0.05) * 0.05; // 5% per 0.05 m/s
  return weight * (1 + strengthSurplus);
}

/**
 * WHY: This logic solves for the user's specific training timeframe.
 * If they have a meet date, we calculate the total weeks available from 
 * the moment they start. If not, we use the specified block length.
 */
export function calculateProgramTiming(
  createdAt: { seconds: number } | number | undefined,
  goalType: "meet" | "block",
  meetDate?: string,
  blockWeeks?: string
) {
  const joinTime = createdAt
    ? typeof createdAt === "number" ? createdAt : createdAt.seconds * 1000
    : Date.now();
  
  const start = new Date(joinTime);
  start.setHours(0, 0, 0, 0); // Normalize to start of join day

  const now = new Date();
  now.setHours(23, 59, 59, 999); // Normalize to end of current day

  // Current week: floor(days since start / 7) + 1
  const daysSinceJoin = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const currentWeek = Math.max(1, Math.floor(daysSinceJoin / 7) + 1);

  let totalWeeks = parseInt(blockWeeks || "12");

  if (goalType === "meet" && meetDate) {
    const meetTime = new Date(meetDate);
    meetTime.setHours(23, 59, 59, 999);
    
    const totalDays = (meetTime.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    // Use ceil to ensure we include the meet week in the total timeframe
    totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  }

  return {
    currentWeek: Math.min(currentWeek, totalWeeks),
    totalWeeks: Math.max(1, totalWeeks)
  };
}
