'use client'

import React, { useEffect, useState } from 'react';
import { Trophy, Star } from 'lucide-react';

/**
 * PRCelebration — High-energy overlay for personal records.
 * 
 * WHY: Celebrating progress is key to motivation. This component provides
 * a visual and auditory "win" state when a lifter exceeds their previous bests.
 */
export function PRCelebration({ liftName, weight, reps, onComplete }: { liftName: string, weight: number, reps: number, onComplete: () => void }) {
  const [active, setActive] = useState(true);

  const played = React.useRef(false);

  useEffect(() => {
    if (played.current) return;
    played.current = true;

    // Play the Air Horn sound
    const audio = new Audio('/assets/sounds/dj-air-horn.mp3');
    audio.volume = 0.6;
    audio.play().catch(e => console.warn("Audio interaction required:", e));

    const fadeOutTimer = setTimeout(() => {
      setActive(false);
      setTimeout(onComplete, 800);
    }, 3500);

    return () => clearTimeout(fadeOutTimer);
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none transition-all duration-700 ${active ? 'opacity-100' : 'opacity-0'}`}>
      {/* Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.3)_0%,transparent_70%)]" />
      
      {/* Text Container */}
      <div className={`relative px-8 py-12 rounded-[4rem] bg-black/40 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-1000 ${active ? 'scale-100 rotate-0' : 'scale-75 rotate-3'}`}>
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-primary rounded-3xl flex items-center justify-center shadow-[0_0_50px_var(--color-primary-glow)] animate-bounce">
           <Trophy size={48} className="text-white" />
        </div>

        <div className="text-center space-y-2 mt-4">
          <p className="text-primary font-black uppercase tracking-[0.4em] text-xs">Achievement Unlocked</p>
          <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-white drop-shadow-2xl">
            NEW PR!
          </h1>
          <div className="h-1 bg-primary/20 w-32 mx-auto rounded-full" />
          <p className="text-2xl font-bold text-text-secondary">
            {weight} <span className="text-white/50 lowercase">lbs</span> × {reps} <span className="text-white/50 lowercase">reps</span>
          </p>
          <p className="text-[10px] font-black uppercase tracking-widest text-primary pt-4">{liftName}</p>
        </div>

        {/* Decorative Stars */}
        <Star className="absolute top-10 right-10 text-primary w-6 h-6 animate-pulse" />
        <Star className="absolute bottom-10 left-10 text-accent w-5 h-5 animate-pulse delay-100" />
      </div>

      {/* Screen Rays */}
      <div className="absolute inset-0 -z-10 bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-primary)_10deg,transparent_20deg)] opacity-[0.05] animate-[spin_10s_linear_infinite]" />
    </div>
  );
}
