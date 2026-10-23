import { cn } from "@/lib/utils";

/**
 * The Kaarobar mark — the network glyph from desktop/local's app icon, the
 * same one web/landing draws. Always Kaarobar blue: it's the product's
 * mark, while a business's own brand color shows in its switcher badge.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="1024" height="1024" rx="232" fill="#2d6df6" />
      <g fill="none" stroke="#fff" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 270 512 L 478 512" />
        <path d="M 390 230 L 390 410 Q 390 512 478 512" />
        <path d="M 390 794 L 390 614 Q 390 512 478 512" />
      </g>
      <g fill="#fff">
        <circle cx="270" cy="512" r="75" />
        <circle cx="390" cy="230" r="75" />
        <circle cx="390" cy="794" r="75" />
        <circle cx="478" cy="512" r="46" />
        <path
          transform="translate(582 408) rotate(-45)"
          d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"
        />
        <path
          transform="translate(582 616) rotate(45)"
          d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"
        />
      </g>
    </svg>
  );
}
