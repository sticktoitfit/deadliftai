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
    <div className={`text-center max-w-sm mx-auto py-8 px-6 space-y-3 transition-all duration-1000 animate-in fade-in zoom-in-95 ${className}`}>
      <div className="relative flex flex-col items-center">
        {/* Subdued Glow */}
        <div className="absolute inset-0 bg-primary/5 blur-[80px] rounded-full -z-10" />
        
        <p className="text-base md:text-lg font-bold leading-relaxed italic text-white/90 drop-shadow-sm">
          "{quote.text}"
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-3">
        <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-primary/40" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
          {quote.author}
        </p>
        <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-primary/40" />
      </div>
    </div>
  );
}
