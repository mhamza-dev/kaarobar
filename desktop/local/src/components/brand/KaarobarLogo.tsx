import type { SVGAttributes } from 'react'
import { cn } from '../../lib/cn'

type Props = Omit<SVGAttributes<SVGSVGElement>, 'viewBox' | 'xmlns' | 'role' | 'aria-label'> & {
  /** Decorative mark (hide from accessibility tree). */
  mark?: boolean
}

/** Kaarobar brand mark — background tracks `currentColor` / `text-brand-primary`. */
export function KaarobarLogo({ className, mark, ...props }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      role={mark ? 'presentation' : 'img'}
      aria-label={mark ? undefined : 'Kaarobar'}
      aria-hidden={mark || undefined}
      className={cn('shrink-0 overflow-hidden rounded-lg text-brand-primary shadow-soft', className)}
      {...props}
    >
      <rect width="1024" height="1024" fill="currentColor" />
      <g fill="none" stroke="#ffffff" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 270 512 L 478 512" />
        <path d="M 390 230 L 390 410 Q 390 512 478 512" />
        <path d="M 390 794 L 390 614 Q 390 512 478 512" />
      </g>
      <g fill="#ffffff">
        <circle cx="270" cy="512" r="75" />
        <circle cx="390" cy="230" r="75" />
        <circle cx="390" cy="794" r="75" />
        <circle cx="478" cy="512" r="46" />
      </g>
      <g fill="#ffffff">
        <g transform="translate(582, 408) rotate(-45)">
          <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z" />
        </g>
        <g transform="translate(582, 616) rotate(45)">
          <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z" />
        </g>
      </g>
    </svg>
  )
}
