"use client";

/** Pre-defined avatar options for the profile setup picker */
export const AVATARS = [
  { id: "lifter-1", emoji: "🏋️", label: "Lifter" },
  { id: "fire",     emoji: "🔥", label: "Fire" },
  { id: "bolt",     emoji: "⚡", label: "Bolt" },
  { id: "skull",    emoji: "💀", label: "Skull" },
  { id: "flex",     emoji: "💪", label: "Flex" },
  { id: "target",   emoji: "🎯", label: "Target" },
  { id: "gem",      emoji: "💎", label: "Gem" },
  { id: "wolf",     emoji: "🐺", label: "Wolf" },
  { id: "rocket",   emoji: "🚀", label: "Rocket" },
  { id: "crown",    emoji: "👑", label: "Crown" },
  { id: "shield",   emoji: "🛡️", label: "Shield" },
  { id: "atom",     emoji: "⚛️", label: "Atom" },
];

interface AvatarGridProps {
  selected: string;
  onSelect: (id: string) => void;
  /** Optional Google photo URL to show as a 13th option */
  googlePhotoURL?: string | null;
}

/**
 * Renders a scrollable grid of emoji avatars for the profile-setup step.
 * Highlights the selected avatar with a primary glow border.
 */
export function AvatarGrid({ selected, onSelect, googlePhotoURL }: AvatarGridProps) {
  const allOptions = googlePhotoURL
    ? [{ id: "google-photo", emoji: "", label: "Google Photo" }, ...AVATARS]
    : AVATARS;

  return (
    <div className="grid grid-cols-4 gap-3">
      {allOptions.map((av) => {
        const isSelected = selected === av.id;
        return (
          <button
            key={av.id}
            type="button"
            onClick={() => onSelect(av.id)}
            aria-label={`Select avatar: ${av.label}`}
            className={`
              relative flex flex-col items-center justify-center aspect-square rounded-2xl 
              border-2 transition-all duration-200 text-3xl
              ${isSelected
                ? "border-primary bg-primary/10 shadow-[0_0_20px_var(--color-primary-glow)] scale-105"
                : "border-white/10 bg-surface hover:bg-surface-hover hover:border-white/20"
              }
            `}
          >
            {av.id === "google-photo" && googlePhotoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={googlePhotoURL}
                alt="Google profile"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span>{av.emoji}</span>
            )}
            {isSelected && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                <span className="text-background text-[10px] font-black">✓</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
