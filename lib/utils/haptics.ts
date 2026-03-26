/**
 * Haptic and Audio Feedback Utility
 * 
 * WHY: Mobile-first applications feel more "alive" with tactile and auditory feedback.
 * This utility provides simple, non-intrusive triggers for key workout milestones.
 */

export const Haptics = {
  /** Light tap for button clicks or low-stakes actions */
  light() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  },

  /** Medium impact for completing a set */
  medium() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  },

  /** Double pulse for rest timer completion */
  success() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  },

  /** Heavy impact for PR or session completion */
  heavy() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(100);
    }
  }
};

/**
 * Audio feedback for key moments.
 */
export const PlaySound = {
  /** Subtle click for logging */
  click() {
    // Generate a quick sine wave beep (high end, subtle)
    this._beep(880, 0.05, 'sine', 0.1);
  },

  /** Chime for rest timer finish */
  chime() {
    // Sequence of notes
    this._beep(660, 0.1, 'triangle', 0.2);
    setTimeout(() => this._beep(880, 0.2, 'triangle', 0.2), 100);
  },

  /** Private helper to generate dynamic audio without assets */
  _beep(freq: number, duration: number, type: OscillatorType = 'sine', volume = 0.2) {
    if (typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
      
      // Auto-close context to save resources
      setTimeout(() => ctx.close(), duration * 1000 + 100);
    } catch (e) {
      console.warn("Audio Context failed:", e);
    }
  }
};
