"use client";

import { useEffect, useState, use, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Zap,
  Calendar,
  Activity,
  ChevronRight,
  Database,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import {
  calculateProgramTiming,
  estimateMeet1RM,
  type WorkoutLog,
} from "@/lib/programming/periodization";

type Lift = "squat" | "bench" | "deadlift";

const LIFT_INFO: Record<Lift, { label: string; color: string; glow: string }> =
  {
    squat:    { label: "Squat",    color: "#22d3ee", glow: "rgba(34,211,238,0.5)"  },
    bench:    { label: "Bench",    color: "#a78bfa", glow: "rgba(167,139,250,0.5)" },
    deadlift: { label: "Deadlift", color: "#fb923c", glow: "rgba(251,146,60,0.5)"  },
  };

// Chart viewBox constants
const PADDING     = 40;
const VIEW_WIDTH  = 800;
const VIEW_HEIGHT = 400;
const CHART_W     = VIEW_WIDTH  - PADDING * 2;
const CHART_H     = VIEW_HEIGHT - PADDING * 2;

/**
 * MatrixDetailPage — interactive strength trajectory view for a single lift.
 *
 * WHY: Athletes need to see projected vs. actual 1RM progress across their macrocycle.
 * The scrubber lets them probe any week to see the exact data confluence between
 * the programme's prediction and their real-world logged performance.
 */
export default function MatrixDetailPage({
  params,
}: {
  params: Promise<{ lift: string }>;
}) {
  // ─── ALL HOOKS MUST COME FIRST — before any conditional returns ───────────
  const { lift: liftParam } = use(params);
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();

  const lift = (liftParam as Lift) in LIFT_INFO
    ? (liftParam as Lift)
    : "squat";
  const info = LIFT_INFO[lift];

  const [logs,        setLogs]        = useState<WorkoutLog[]>([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [totalWeeks,  setTotalWeeks]  = useState(12);
  const [pageLoading, setPageLoading] = useState(true);

  // Scrubber — null means the tooltip is hidden
  const [scrubWeek, setScrubWeek] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // ── Data load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth"); return; }
    loadData();
  }, [loading, user, lift]); // eslint-disable-line react-hooks/exhaustive-deps

  // Robust scroll lock for landing page only
  useEffect(() => {
    // Lock scroll on landing page for the deep-immersion HUD aesthetic
    // This effect should ideally be in the landing page component itself.
    // For functional pages like MatrixDetailPage, we ensure it's unset.
    document.body.style.overflow = 'unset'; // Ensure scroll is enabled for functional pages

    // Safety check: ensure it's removed on unmount to prevent leak to other pages
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []); // Only run once on mount for this page to ensure scroll is unset

  async function loadData() {
    if (!user || !userProfile?.onboardingData) return;

    const od = userProfile.onboardingData;
    const { currentWeek: week, totalWeeks: weeks } = calculateProgramTiming(
      userProfile.createdAt as { seconds: number } | undefined,
      od.goalType || "block",
      od.meetDate,
      od.meetWeeks
    );
    setCurrentWeek(week);
    setTotalWeeks(weeks);

    try {
      // WHY: Fetch then filter client-side to avoid needing a composite Firestore
      // index on (lift, completed, date).
      const snap = await getDocs(
        query(collection(db, "users", user.uid, "workoutLogs"), orderBy("date", "asc"))
      );
      const all = snap.docs.map((d) => d.data() as WorkoutLog);
      setLogs(all.filter((l) => l.lift === lift && l.completed));
    } catch (e) {
      console.error("Error loading logs:", e);
    }

    setPageLoading(false);
  }

  // ── Scrubber interaction (must be a hook, declared before early return) ────
  /**
   * WHY: SVG uses a fixed viewBox (800×400) with preserveAspectRatio="none",
   * so we must scale the mouse/touch clientX to viewBox coordinates manually.
   */
  const handleScrub = useCallback(
    (clientX: number) => {
      if (!svgRef.current) return;
      const rect    = svgRef.current.getBoundingClientRect();
      const scaleX  = VIEW_WIDTH / rect.width;
      const svgX    = (clientX - rect.left) * scaleX;
      const clamped = Math.max(PADDING, Math.min(VIEW_WIDTH - PADDING, svgX));
      const raw     = ((clamped - PADDING) / CHART_W) * totalWeeks;
      setScrubWeek(Math.round(Math.max(0, Math.min(totalWeeks, raw))));
    },
    [totalWeeks]
  );

  // ── CONDITIONAL RETURNS — only after every hook ────────────────────────────
  if (loading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-pulse space-y-4 text-center">
          <Activity className="w-12 h-12 text-primary mx-auto" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">
            Syncing Matrix...
          </p>
        </div>
      </div>
    );
  }

  // ── Pure chart calculations (no hooks below this line) ────────────────────
  const od         = userProfile?.onboardingData ?? {};
  const start1RM   = parseInt((od as Record<string, string>)[lift] || "0");
  const finalTarget = estimateMeet1RM(start1RM, totalWeeks, lift);

  const RATE = { squat: 0.008, bench: 0.005, deadlift: 0.007 } as const;
  const rate = RATE[lift];

  const projectedAt = (w: number) =>
    Math.round(start1RM * Math.pow(1 + rate, w));

  const trajectoryPoints = Array.from({ length: totalWeeks + 1 }, (_, i) => ({
    week: i, weight: projectedAt(i),
  }));

  const logPoints = logs.flatMap((log) => {
    const topSet = log.sets?.[0];
    if (!topSet) return [];
    const w = topSet.weight;
    const r = topSet.reps;
    const est1RM = Math.round(w / (1.0278 - 0.0278 * r));
    return [{ week: log.week || 1, weight: est1RM }];
  });

  const weights     = logPoints.map((p) => p.weight);
  const minWeight   = Math.min(start1RM, ...weights) * 0.95;
  const maxWeight   = Math.max(finalTarget, ...weights) * 1.05;
  const weightRange = maxWeight - minWeight;

  const getX = (w: number) => (w / totalWeeks) * CHART_W + PADDING;
  const getY = (wt: number) =>
    CHART_H - ((wt - minWeight) / weightRange) * CHART_H + PADDING;

  const trajectoryPath = trajectoryPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.week)} ${getY(p.weight)}`)
    .join(" ");

  // Build weekly actuals starting from origin (0, start1RM)
  const weeklyActuals: { week: number; weight: number }[] = [
    { week: 0, weight: start1RM },
  ];
  for (let i = 1; i <= currentWeek; i++) {
    const wl = logPoints.filter((p) => p.week === i);
    if (wl.length === 0) continue;
    const avg = wl.reduce((a, p) => a + p.weight, 0) / wl.length;
    weeklyActuals.push({ week: i, weight: Math.round(avg) });
  }

  const actualPath = weeklyActuals
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(p.week)} ${getY(p.weight)}`)
    .join(" ");

  // ── Interpolated actual value at any fractional week ──────────────────────
  const actualAt = (w: number): number | null => {
    const flr = Math.floor(w);
    const cel  = Math.ceil(w);
    const a    = weeklyActuals.find((p) => p.week === flr);
    const b    = weeklyActuals.find((p) => p.week === cel);
    if (!a && !b) return null;
    if (!a) return b!.weight;
    if (!b) return a.weight;
    const t = w - flr;
    return Math.round(a.weight + (b.weight - a.weight) * t);
  };

  // ── Scrubber derived values ───────────────────────────────────────────────
  const scrubX   = scrubWeek !== null ? getX(scrubWeek) : null;
  const projVal  = scrubWeek !== null ? projectedAt(scrubWeek) : null;
  const actualVal = scrubWeek !== null ? actualAt(scrubWeek) : null;
  const projY    = projVal   !== null ? getY(projVal)  : null;
  const actualY  = actualVal !== null ? getY(actualVal) : null;
  // Keep tooltip inside the SVG viewBox bounds
  const tooltipX = scrubX !== null
    ? scrubX > VIEW_WIDTH - 160 ? scrubX - 150 : scrubX + 14
    : 0;

  // ── Event handlers (use handleScrub from hook above) ─────────────────────
  const onMouseMove  = (e: React.MouseEvent<SVGSVGElement>)  => handleScrub(e.clientX);
  const onTouchMove  = (e: React.TouchEvent<SVGSVGElement>)  => {
    e.preventDefault();
    handleScrub(e.touches[0].clientX);
  };
  const onScrubLeave = () => setScrubWeek(null);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-white -mx-4 md:-mx-8 px-6 md:px-16 pb-16 selection:bg-primary/30">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <div className="relative z-10 max-w-5xl mx-auto mb-10 pt-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"
                style={{ color: info.color }}
              >
                {lift === "squat"    && <Target    size={24} />}
                {lift === "bench"    && <Zap        size={24} />}
                {lift === "deadlift" && <TrendingUp size={24} />}
              </div>
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">
                {info.label} <span className="text-white/10">Matrix</span>
              </h1>
            </div>
            <p className="text-text-secondary text-base max-w-lg font-medium leading-relaxed">
              Slide over the chart to probe any week — see projected trajectory meet real-world performance.
            </p>
          </div>

          <div className="flex gap-4 sm:gap-6">
            <div className="px-6 py-5 rounded-3xl bg-surface/40 border border-white/5 backdrop-blur-xl min-w-[140px] sm:min-w-[180px] shadow-lg shadow-black/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-60">Target 1RM</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter" style={{ color: info.color }}>
                  {finalTarget}
                </span>
                <span className="text-[10px] font-bold text-white/20 uppercase">lbs</span>
              </div>
            </div>
            <div className="px-6 py-5 rounded-3xl bg-surface/40 border border-white/5 backdrop-blur-xl min-w-[140px] sm:min-w-[180px] shadow-lg shadow-black/20">
              <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-60">Total Gain</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-black font-mono tracking-tighter text-white">
                  +{finalTarget - start1RM}
                </span>
                <span className="text-[10px] font-bold text-white/20 uppercase">lbs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Matrix Chart */}
      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="bg-surface/30 backdrop-blur-md rounded-[3rem] p-8 border border-white/5 overflow-hidden shadow-2xl">

          {/* Legend + hint */}
          <div className="flex items-center gap-6 mb-6 px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: info.color }} />
              <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Projected Path</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-white" />
              <span className="text-[9px] font-black uppercase tracking-widest text-text-secondary">Actual Progress</span>
            </div>
            {scrubWeek === null && (
              <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-white/20 animate-pulse hidden md:block">
                ← drag to probe →
              </span>
            )}

            {/* Live readout when scrubbing */}
            {scrubWeek !== null && (
              <div className="ml-auto flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: info.color }}>
                    W{scrubWeek} Projected
                  </p>
                  <p className="text-lg font-black font-mono" style={{ color: info.color }}>
                    {projVal} lbs
                  </p>
                </div>
                {actualVal !== null && (
                  <div className="text-right">
                    <p className="text-[8px] font-black uppercase tracking-widest text-white/50">Actual</p>
                    <p className="text-lg font-black font-mono text-white">{actualVal} lbs</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SVG — touch-none prevents page scroll while scrubbing on mobile */}
          <div className="relative aspect-[21/9] w-full touch-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
              className="w-full h-full overflow-visible cursor-crosshair select-none"
              preserveAspectRatio="none"
              onMouseMove={onMouseMove}
              onMouseLeave={onScrubLeave}
              onTouchMove={onTouchMove}
              onTouchEnd={onScrubLeave}
            >
              <defs>
                <filter id="glow-fx" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Grid lines */}
              {Array.from({ length: 5 }, (_, i) => {
                const y   = PADDING + (i * CHART_H) / 4;
                const val = Math.round(maxWeight - (i * weightRange) / 4);
                return (
                  <g key={i}>
                    <line x1={PADDING} y1={y} x2={VIEW_WIDTH - PADDING} y2={y}
                      stroke="white" strokeOpacity="0.04" strokeWidth="1" />
                    <text x={PADDING - 10} y={y + 4} textAnchor="end"
                      fill="rgba(255,255,255,0.18)" fontSize="11" fontFamily="monospace">
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Week markers */}
              {Array.from({ length: totalWeeks + 1 }, (_, i) => {
                if (i % (totalWeeks > 8 ? 2 : 1) !== 0) return null;
                const x = getX(i);
                return (
                  <g key={i}>
                    <line x1={x} y1={PADDING} x2={x} y2={VIEW_HEIGHT - PADDING}
                      stroke="white" strokeOpacity="0.04" strokeWidth="1" />
                    <text x={x} y={VIEW_HEIGHT - PADDING + 20} textAnchor="middle"
                      fill="rgba(255,255,255,0.18)" fontSize="9" fontWeight="900" letterSpacing="1">
                      W{i}
                    </text>
                  </g>
                );
              })}

              {/* Projected trajectory — glow */}
              <path d={trajectoryPath} fill="none"
                stroke={info.color} strokeWidth="14" strokeOpacity="0.05"
                strokeLinecap="round" strokeLinejoin="round" filter="url(#glow-fx)" />
              {/* Projected trajectory — main dashed line  */}
              <path d={trajectoryPath} fill="none"
                stroke={info.color} strokeWidth="2"
                strokeDasharray="6 4" strokeOpacity="0.45"
                strokeLinecap="round" strokeLinejoin="round" />

              {/* "Now" marker */}
              <line x1={getX(currentWeek)} y1={PADDING}
                x2={getX(currentWeek)} y2={VIEW_HEIGHT - PADDING}
                stroke="white" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="4 4" />
              <rect x={getX(currentWeek) - 40} y={PADDING - 30} width="80" height="20"
                rx="10" fill="#ffffff10" />
              <text x={getX(currentWeek)} y={PADDING - 16} textAnchor="middle"
                fill="rgba(255,255,255,0.6)" fontSize="8" fontWeight="900" letterSpacing="2">
                NOW
              </text>

              {/* Actual progress path */}
              <path d={actualPath} fill="none"
                stroke="white" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.3))" }}
                className="animate-[draw_2s_ease-out_forwards]"
              />

              {/* Actual data dots */}
              {weeklyActuals.map((p, i) => (
                <g key={i}>
                  <circle cx={getX(p.week)} cy={getY(p.weight)} r="5" fill="white" />
                  <circle cx={getX(p.week)} cy={getY(p.weight)} r="11"
                    fill="white" fillOpacity="0.07" className="animate-pulse" />
                </g>
              ))}

              {/* ═══════════════════════════ SCRUBBER ═══════════════════════════ */}
              {scrubX !== null && (
                <g>
                  {/* Crosshair */}
                  <line x1={scrubX} y1={PADDING} x2={scrubX} y2={VIEW_HEIGHT - PADDING}
                    stroke="white" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="5 3" />

                  {/* Projected intersection dot */}
                  {projY !== null && (
                    <>
                      <circle cx={scrubX} cy={projY} r="10"
                        fill={info.color} fillOpacity="0.15" />
                      <circle cx={scrubX} cy={projY} r="5" fill={info.color} />
                    </>
                  )}

                  {/* Actual intersection dot */}
                  {actualY !== null && (
                    <>
                      <circle cx={scrubX} cy={actualY} r="10"
                        fill="white" fillOpacity="0.15" />
                      <circle cx={scrubX} cy={actualY} r="5" fill="white" />
                    </>
                  )}

                  {/* Tooltip card via foreignObject */}
                  <foreignObject
                    x={tooltipX}
                    y={PADDING + 4}
                    width="148"
                    height={actualVal !== null ? 130 : 95}
                    style={{ overflow: "visible" }}
                  >
                    <div
                      style={{
                        background: "rgba(8,8,16,0.92)",
                        border: `1px solid ${info.color}40`,
                        borderRadius: "14px",
                        padding: "12px 16px",
                        backdropFilter: "blur(16px)",
                        boxShadow: `0 0 28px ${info.glow}, 0 4px 24px rgba(0,0,0,0.5)`,
                        pointerEvents: "none",
                      }}
                    >
                      <p style={{
                        fontSize: "8px", fontWeight: 900, letterSpacing: "3px",
                        textTransform: "uppercase", color: "rgba(255,255,255,0.35)",
                        margin: "0 0 10px 0",
                      }}>
                        Week {scrubWeek}
                      </p>

                      {/* Projected */}
                      <p style={{
                        fontSize: "8px", fontWeight: 900, letterSpacing: "2px",
                        textTransform: "uppercase", color: info.color,
                        margin: "0 0 2px 0",
                      }}>
                        Projected
                      </p>
                      <p style={{
                        fontSize: "24px", fontWeight: 900, fontFamily: "monospace",
                        color: info.color, lineHeight: 1.1, margin: "0 0 10px 0",
                      }}>
                        {projVal}
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>lbs</span>
                      </p>

                      {/* Actual (only if logged data exists) */}
                      {actualVal !== null && (
                        <>
                          <p style={{
                            fontSize: "8px", fontWeight: 900, letterSpacing: "2px",
                            textTransform: "uppercase", color: "rgba(255,255,255,0.45)",
                            margin: "0 0 2px 0",
                          }}>
                            Actual
                          </p>
                          <p style={{
                            fontSize: "24px", fontWeight: 900, fontFamily: "monospace",
                            color: "#fff", lineHeight: 1.1, margin: 0,
                          }}>
                            {actualVal}
                            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", marginLeft: "4px" }}>lbs</span>
                          </p>
                        </>
                      )}
                    </div>
                  </foreignObject>
                </g>
              )}
            </svg>
          </div>

          {/* Footer stats */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-white/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Current Phase</p>
                <p className="text-xs font-bold font-mono">Week {currentWeek} of {totalWeeks}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                <Database size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Data Integrity</p>
                <p className="text-xs font-bold font-mono">{logs.length} Data Points Logged</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-text-secondary">
                <Activity size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary">System Status</p>
                <p className="text-xs font-bold font-mono">Neural Engine Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => router.push("/workout")}
            className="group flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
          >
            Back to Dashboard
            <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes draw {
          from { stroke-dasharray: 2000; stroke-dashoffset: 2000; }
          to   { stroke-dasharray: 2000; stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
}
