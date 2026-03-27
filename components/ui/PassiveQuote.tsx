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
    <div className={`text-center max-w-[280px] mx-auto py-6 px-4 space-y-2.5 transition-all duration-1000 animate-in fade-in zoom-in-95 ${className}`}>
      <div className="relative">
        <p className="text-sm font-medium leading-relaxed italic text-white drop-shadow-sm">
          "{quote.text}"
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-3">
        <div className="h-[1px] w-6 bg-primary/30" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/60">
          {quote.author}
        </p>
        <div className="h-[1px] w-6 bg-primary/30" />
      </div>
    </div>
  );
}
