'use client'

/**
 * Passive Quote Component
 * 
 * WHY: Provides subtle, non-intrusive motivational cues during liminal spaces
 * (rest timers, loading states). 
 * Rules followed: 
 * - Passive placement
 * - Visual Hierarchy (muted colors, smaller font)
 * - Bite-sized content
 */

import React, { useMemo } from 'react';
import { POWERLIFTING_QUOTES } from '@/lib/programming/quotes';
import { useAuth } from '@/hooks/useAuth';

interface PassiveQuoteProps {
  className?: string;
}

export function PassiveQuote({ className }: PassiveQuoteProps) {
  const { userProfile } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  
  // Kill switch check
  const showQuotes = userProfile?.preferences?.showQuotes ?? true;

  const quote = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const index = Math.floor(Math.random() * POWERLIFTING_QUOTES.length);
    return POWERLIFTING_QUOTES[index];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !quote || !showQuotes) return <div className={className} style={{ minHeight: '3em' }} />;

  return (
    <div className={`text-center max-w-lg mx-auto py-12 px-6 space-y-4 transition-all duration-1000 animate-in fade-in zoom-in-95 ${className}`}>
      <div className="relative flex flex-col items-center">
        {/* Neon Core Glow */}
        <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full -z-10 animate-pulse" />
        
        <p className="text-2xl md:text-3xl font-black leading-tight italic text-white drop-shadow-[0_2px_15px_rgba(255,255,255,0.2)]">
          "{quote.text}"
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-4">
        <div className="h-[2px] w-12 bg-gradient-to-r from-transparent to-primary" />
        <p className="text-sm font-black uppercase tracking-[0.4em] text-primary drop-shadow-[0_0_12px_rgba(var(--color-primary),0.5)]">
          {quote.author}
        </p>
        <div className="h-[2px] w-12 bg-gradient-to-l from-transparent to-primary" />
      </div>
    </div>
  );
}
