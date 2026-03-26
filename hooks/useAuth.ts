"use client";

/**
 * Thin re-export so components can `import { useAuth } from "@/hooks/useAuth"`
 * without knowing the implementation lives in lib/auth-context.
 */
export { useAuth } from "@/lib/auth-context";
export type { UserProfile } from "@/lib/auth-context";
