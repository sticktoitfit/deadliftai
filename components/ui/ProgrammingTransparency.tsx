import React from 'react';
import { Info, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  recoveryProfile?: string;
  age?: number;
  frequency?: number;
  className?: string;
}

/**
 * WHY: This component exposes the "Logic Layer" of the AI programmer.
 * It builds trust by explaining the scientific rationale behind volume adjustments.
 */
export default function ProgrammingTransparency({ recoveryProfile, age, frequency, className }: Props) {
  const isMasters = (age || 0) >= 40;
  const isFemale = recoveryProfile === 'female';
  
  return (
    <div className={cn("bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 text-primary">
        <ShieldCheck size={16} />
        <span className="text-[10px] font-black uppercase tracking-widest">Scientific Volume Scaling</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-text-secondary">Recovery Profile:</span>
          <span className="font-bold text-white uppercase">{recoveryProfile || 'standard'}</span>
        </div>
        
        <div className="flex items-start gap-2">
          <Info size={12} className="text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-text-secondary leading-tight">
            {frequency === 3 
              ? "3-day frequency detected. Increasing sets-per-session to maintain Weekly Effective Volume (WEV)."
              : "Standard 4-day frequency. Optimized for intra-week muscle protein synthesis cycles."}
          </p>
        </div>

        {isFemale && (
          <div className="flex items-start gap-2">
            <Activity size={12} className="text-green-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-green-400 leading-tight italic">
              Estrogen-dominant profile detected. Volume ceiling increased by 20% to maximize hormonal recovery capacity.
            </p>
          </div>
        )}

        {isMasters && (
          <div className="flex items-start gap-2">
            <Activity size={12} className="text-orange-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-orange-400 leading-tight italic">
              Masters age profile (40+). Set count capped for joint capsule preservation and systemic recovery.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
