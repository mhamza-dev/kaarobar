/**
 * Money / measured-amount formatting.
 *
 * Single source of truth is `shared/core` (ADR 002) — this module stays as a
 * re-export so existing `@/lib/decimal` imports keep working unchanged.
 */
export * from "@core/lib/decimal";
