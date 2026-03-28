"use client";

import { useState } from "react";
import { Brain, Zap, Gauge, UserCheck, ShieldCheck, ChevronDown, ChevronUp, Cpu, Network } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ProgrammingTransparency.tsx
 * 
 * WHY: Provides the "Glass Box" view of the AI's training logic. 
 * Explains how the Prilepin's Chart, Fitness-Fatigue model, and 
 * individualized recovery profiling (sex/age) determine daily loading.
 */
export function ProgrammingTransparency() {
  const [isOpen, setIsOpen] = useState(false);

  const sections = [
    {
      id: "structure",
      icon: <Network size={16} className="text-primary" />,
      title: "Cycle Architecture",
      desc: "Our macro-cycle follows a strictly periodized 40 / 45 / 15 structure: Accumulation (Hypertrophy), Transmutation (Specialized Strength), and Peaking (Meet realization).",
    },
    {
      id: "recovery",
      icon: <UserCheck size={16} className="text-accent" />,
      title: "Biological Individualization",
      desc: "Recovery profiles are calculated based on bio-markers. Estrogen-dominant profiles often handle 5-10% more relative volume. Masters (40+) receive joint-preservation scaling.",
    },
    {
      id: "neural",
      icon: <Cpu size={16} className="text-orange-400" />,
      title: "Neural Matrix Sync",
      desc: "We monitor RPE trends for 'Neural Slippage' (climbing intensity at static loads) or 'Primed' status, adjusting your next weights before you physically plateau.",
    },
    {
      id: "prilepin",
      icon: <Gauge size={16} className="text-green-400" />,
      title: "Loading constraints",
      desc: "Prescriptions are bound by Prilepin's empirical research, mapping intensity (INOL) to optimal lift counts per session to maximize adaptation without overtraining.",
    },
    {
      id: "variants",
      icon: <Zap size={16} className="text-yellow-400" />,
      title: "Weak Point Feedback",
      desc: "Your sticking point (Off the floor, Mid-range, Lockout) dynamically swaps movement variants like Spoto Press or Pause Squats to correct leverage deficiencies.",
    }
  ];

  return (
    <div 
      className={cn(
        "bg-surface/50 rounded-2xl border border-white/5 overflow-hidden transition-all duration-500",
        isOpen ? "ring-1 ring-primary/20 shadow-[0_0_40px_rgba(34,211,238,0.05)]" : ""
      )}
    >
      {/* Trigger Header */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between group hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Brain size={20} />
          </div>
          <div className="text-left">
            <p className="font-bold text-white text-sm tracking-tight">AI Transparency</p>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mt-0.5">Neural Programming Logic</p>
          </div>
        </div>
        <div className="p-1 rounded-full bg-white/5 text-text-secondary group-hover:text-white transition-colors">
          <div className={cn("transition-transform duration-300", isOpen ? "rotate-180" : "rotate-0")}>
            <ChevronDown size={16} />
          </div>
        </div>
      </button>

      {/* Expandable Content */}
      <div 
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="p-6 pt-2 space-y-4">
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 mb-6">
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Deadlift.ai operates as a <strong>Glass Box</strong>. Our algorithmic weighting is based on peer-reviewed sport science—specifically the Fitness-Fatigue model and Daily Undulating Periodization (DUP).
              </p>
            </div>

            <div className="grid gap-6">
              {sections.map(section => (
                <div key={section.id} className="flex gap-4 group">
                  <div className="mt-1 p-2 h-fit rounded-lg bg-surface border border-white/5 transition-colors group-hover:border-white/10 shrink-0">
                    {section.icon}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1 leading-snug">
                      {section.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-text-secondary">
                      {section.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Evidence-Based System</span>
              </div>
              <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest">v4.2.0-neural-stable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
