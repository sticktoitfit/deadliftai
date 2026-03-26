"use client";

import { Home, Dumbbell, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Workouts", href: "/workout", icon: Dumbbell },
  { label: "Profile", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // Hide BottomNav on marketing, auth, onboarding, and flow states
  const hiddenRoutes = ["/workout/active", "/onboarding", "/auth", "/profile-setup"];
  const isExactRoot = pathname === "/";
  const isHidden = isExactRoot || hiddenRoutes.some((route) => pathname?.startsWith(route));

  if (isHidden) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 nav-blur pb-safe">
      <div className="flex max-w-md mx-auto items-center justify-around h-20 px-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-300",
                isActive ? "text-primary" : "text-text-secondary hover:text-text-primary"
              )}
            >
              <div className="relative">
                <Icon
                  size={26}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn("transition-transform duration-300", isActive && "scale-110")}
                />
                {isActive && (
                  <span className="absolute -inset-2 bg-primary-glow rounded-full blur-md -z-10 animate-pulse" />
                )}
              </div>
              <span className="text-[10px] font-semibold tracking-wide uppercase">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
