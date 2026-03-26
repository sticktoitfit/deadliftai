import Image from "next/image";

/**
 * BrandLogo Component
 * 
 * Scalable logo component for Deadlift.ai. Replaces the generic Dumbbell icon
 * with the official minimalist deadlift setup mark.
 */
interface BrandLogoProps {
  size?: number;
  className?: string;
  glow?: boolean;
}

export default function BrandLogo({ size = 64, className = "", glow = false }: BrandLogoProps) {
  return (
    <div 
      className={`relative flex items-center justify-center overflow-hidden rounded-2xl ${className}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div 
          className="absolute inset-0 bg-primary-glow blur-xl rounded-full opacity-40 translate-z-0" 
          style={{ width: '100%', height: '100%' }}
        />
      )}
      <Image
        src="/assets/logos/logo.png"
        alt="Deadlift.ai Logo"
        width={size}
        height={size}
        className="relative z-10 object-cover w-full h-full mix-blend-screen"
        priority
      />
    </div>
  );
}
