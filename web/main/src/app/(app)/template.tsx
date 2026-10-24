/**
 * Remounted on every navigation between top-level screens (moving between
 * settings pages keeps the settings layout), so each screen settles into
 * place as it opens instead of snapping in.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  // Full height only where the screen above it has one (the till); on every
  // other screen this resolves to auto.
  return <div className="h-full animate-page-in">{children}</div>;
}
