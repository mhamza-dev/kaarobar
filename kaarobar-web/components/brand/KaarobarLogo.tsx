import type { SVGProps } from "react";

type KaarobarLogoProps = {
  /** `icon` = blue tile + white mark; `mark` = mark only (inherits currentColor) */
  variant?: "icon" | "mark";
  size?: number;
  className?: string;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * Kaarobar modular-K brand mark (canonical geometry from docs/brand).
 */
export default function KaarobarLogo({
  variant = "icon",
  size = 40,
  className,
  title = "Kaarobar",
  ...rest
}: KaarobarLogoProps) {
  const isIcon = variant === "icon";
  const ink = isIcon ? "#ffffff" : "currentColor";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {isIcon ? <rect width="1024" height="1024" fill="#2d6df6" /> : null}
      <g fill="none" stroke={ink} strokeWidth="44" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 270 512 L 478 512" />
        <path d="M 390 230 L 390 410 Q 390 512 478 512" />
        <path d="M 390 794 L 390 614 Q 390 512 478 512" />
      </g>
      <g fill={ink}>
        <circle cx="270" cy="512" r="75" />
        <circle cx="390" cy="230" r="75" />
        <circle cx="390" cy="794" r="75" />
        <circle cx="478" cy="512" r="46" />
        <g transform="translate(582, 408) rotate(-45)">
          <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z" />
        </g>
        <g transform="translate(582, 616) rotate(45)">
          <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z" />
        </g>
      </g>
    </svg>
  );
}
