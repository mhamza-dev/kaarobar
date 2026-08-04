"use client";

import React from "react";
import NextLink from "next/link";

type LinkVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success"
  | "warning"
  | "info"
  | "link"
  | "nav"
  | "inverted";

type LinkSize = "xs" | "sm" | "md" | "lg" | "xl";

interface LinkProps {
  href: string;
  children: React.ReactNode;

  variant?: LinkVariant;
  size?: LinkSize;

  disabled?: boolean;
  fullWidth?: boolean;
  rounded?: boolean;
  external?: boolean;

  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;

  className?: string;
  target?: React.HTMLAttributeAnchorTarget;
  rel?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

const baseClass = `
  inline-flex
  items-center
  justify-center
  gap-2
  font-medium
  whitespace-nowrap
  transition-all
  duration-200
  focus:outline-none
  focus:ring-0
`;

const sizeClasses: Record<LinkSize, string> = {
  xs: "h-8 px-3 text-xs",
  sm: "h-9 px-4 text-sm",
  md: "h-10 px-5 text-sm",
  lg: "h-11 px-6 text-base",
  xl: "h-12 px-7 text-lg",
};

const variantClasses: Record<LinkVariant, string> = {
  primary: `
    bg-brand
    text-white
    shadow-brand
    hover:bg-brand-hover
  `,
  secondary: `
    bg-bg-secondary
    text-heading
    border
    border-border
    hover:bg-bg-tertiary
  `,
  outline: `
    border
    border-border
    bg-transparent
    text-heading
    hover:bg-bg-tertiary
  `,
  ghost: `
    bg-transparent
    text-heading
    hover:bg-bg-tertiary
  `,
  danger: `
    bg-danger
    text-white
    hover:brightness-95
  `,
  success: `
    bg-success
    text-white
    hover:brightness-95
  `,
  warning: `
    bg-warning
    text-white
    hover:brightness-95
  `,
  info: `
    bg-info
    text-white
    hover:brightness-95
  `,
  link: `
    bg-transparent
    text-brand
    shadow-none
    h-auto
    px-0
    py-0
    rounded-none
    hover:underline
    hover:text-brand-hover
  `,
  nav: `
    bg-transparent
    text-body
    shadow-none
    h-auto
    px-0
    py-0
    rounded-none
    hover:text-brand
  `,
  inverted: `
    bg-white
    text-brand
    hover:bg-slate-100
  `,
};

const Link = ({
  href,
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  rounded = false,
  external = false,
  startIcon,
  endIcon,
  className = "",
  target,
  rel,
  onClick,
}: LinkProps): React.ReactElement => {
  const isButtonLike = variant !== "link" && variant !== "nav";
  const radius = rounded ? "rounded-full" : "rounded-md";
  const isExternal = external || href.startsWith("http");

  const classes = `
    ${baseClass}
    ${isButtonLike ? "shadow-sm" : ""}
    ${isButtonLike ? sizeClasses[size] : ""}
    ${isButtonLike ? radius : ""}
    ${variantClasses[variant]}
    ${fullWidth && isButtonLike ? "w-full" : ""}
    ${disabled ? "pointer-events-none opacity-60" : ""}
    ${className}
  `;

  const content = (
    <>
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      <span>{children}</span>
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </>
  );

  if (disabled) {
    return (
      <span aria-disabled="true" className={classes}>
        {content}
      </span>
    );
  }

  if (isExternal) {
    return (
      <a
        href={href}
        target={target ?? "_blank"}
        rel={rel ?? "noopener noreferrer"}
        onClick={onClick}
        className={classes}
      >
        {content}
      </a>
    );
  }

  return (
    <NextLink href={href} onClick={onClick} className={classes}>
      {content}
    </NextLink>
  );
};

export default Link;
