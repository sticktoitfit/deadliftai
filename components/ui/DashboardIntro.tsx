"use client";

import { Layout, Calendar, ChevronRight, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface DashboardIntroProps {
  onComplete: () => void;
}

export default function DashboardIntro({ onComplete }: DashboardIntroProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Small delay to trigger animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const steps = [
    {
      title: "Welcome to Deadlift.ai",
      description: "Let's take a quick tour of your two primary menus. This will only take a moment.",
      icon: <Sparkles className="w-10 h-10 text-primary" />,
      image: null
    },
    {
      title: "The Workout Dashboard",
      description: "This is your daily command center. It shows exactly what lifts, reps, and sets are prescribed for your next training session.",
      icon: <Layout className="w-10 h-10 text-primary" />,
    },
    {
      title: "The Weekly Hub",
      description: "Need the big picture? The Weekly Hub shows your entire microcycle at once, helping you anticipate the intensity and focus of the coming days.",
      icon: <Calendar className="w-10 h-10 text-accent" />,
    },
    {
      title: "Seamless Toggling",
      description: "Use the 'Weekly Hub' button on the dashboard to zoom out, and 'Back to Dashboard' to dive back into your active session.",
      icon: (
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 border border-primary/20"><Layout size={20} className="text-primary" /></div>
          <div className="w-8 h-[1px] bg-white/20" />
          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20"><Calendar size={20} className="text-accent" /></div>
        </div>
      ),
    }
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const handleNext = () => {
    if (isLast) {
      setIsVisible(false);
      setTimeout(onComplete, 500);
    } else {
      setStep(step + 1);
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md transition-opacity duration-700",
      isVisible ? "opacity-100" : "opacity-0"
    )}>
      {/* Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 blur-[150px] -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 blur-[150px] -z-10 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className={cn(
        "bg-surface/90 border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl relative overflow-hidden transition-all duration-700",
        isVisible ? "translate-y-0 scale-100" : "translate-y-12 scale-95"
      )}>
        <button 
          onClick={() => {
            setIsVisible(false);
            setTimeout(onComplete, 500);
          }}
          className="absolute top-8 right-8 text-text-secondary hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="mb-8 p-6 rounded-[2rem] bg-white/5 border border-white/5 relative group">
             <div className="absolute inset-0 bg-primary/5 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
             {current.icon}
          </div>

          <h2 className="text-4xl font-black tracking-tight mb-4 transition-all duration-300">
            {current.title}
          </h2>
          
          <p className="text-text-secondary text-base leading-relaxed mb-10 transition-all duration-300 min-h-[5rem]">
            {current.description}
          </p>

          <div className="w-full space-y-4">
            <button
              onClick={handleNext}
              className="w-full py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
            >
              <span>{isLast ? "Begin Training" : "Next Step"}</span>
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <div className="flex justify-center gap-2">
              {steps.map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1 transition-all duration-300 rounded-full",
                    i === step ? "w-8 bg-primary" : "w-2 bg-white/10"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
