"use client";

import React from "react";

interface ButtonProps {
  type?: "button" | "submit" | "reset";

  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "ghost"
    | "danger"
    | "success"
    | "warning"
    | "info"
    | "link"
    | "inverted";

  size?: "xs" | "sm" | "md" | "lg" | "xl";

  children: React.ReactNode;

  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  rounded?: boolean;

  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;

  className?: string;

  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const Button = ({
  type = "button",
  variant = "primary",
  size = "md",
  children,
  disabled = false,
  loading = false,
  fullWidth = false,
  rounded = false,
  startIcon,
  endIcon,
  className = "",
  onClick,
}: ButtonProps): React.ReactElement => {
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
    focus:ring-2

    disabled:opacity-60
    disabled:pointer-events-none
    disabled:cursor-not-allowed
  `;

  const sizeClasses = {
    xs: "h-8 px-3 text-xs",
    sm: "h-9 px-4 text-sm",
    md: "h-10 px-5 text-sm",
    lg: "h-11 px-6 text-base",
    xl: "h-12 px-7 text-lg",
  };

  const radius = rounded ? "rounded-full" : "rounded-md";

  const variantClasses = {
    primary: `
      bg-brand
      text-white
      shadow-brand
      hover:bg-brand-hover
      focus:ring-brand-soft
    `,

    secondary: `
      bg-bg-secondary
      text-heading
      border
      border-border
      hover:bg-bg-tertiary
      focus:ring-brand-soft
    `,

    outline: `
      border
      border-border
      bg-transparent
      text-heading
      hover:bg-bg-tertiary
      focus:ring-brand-soft
    `,

    ghost: `
      bg-transparent
      text-heading
      hover:bg-bg-tertiary
      focus:ring-brand-soft
    `,

    danger: `
      bg-danger
      text-white
      hover:brightness-95
      focus:ring-danger-soft
    `,

    success: `
      bg-success
      text-white
      hover:brightness-95
      focus:ring-success-soft
    `,

    warning: `
      bg-warning
      text-white
      hover:brightness-95
      focus:ring-warning-soft
    `,

    info: `
      bg-info
      text-white
      hover:brightness-95
      focus:ring-info-soft
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
      focus:ring-0
    `,
    inverted: `
      bg-white
      text-brand
      hover:bg-slate-100
      focus:ring-brand-soft
    `,
  };

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`
        ${baseClass}
        ${variant !== "link" && "shadow-sm"}
        ${variant !== "link" ? sizeClasses[size] : ""}
        ${variant !== "link" ? radius : ""}
        ${variantClasses[variant]}
        ${fullWidth && variant !== "link" ? "w-full" : ""}
        ${className}
      `}
    >
      {loading ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
              className="opacity-25"
            />

            <path
              fill="currentColor"
              className="opacity-75"
              d="M12 2a10 10 0 0 1 10 10h-3A7 7 0 0 0 12 5V2z"
            />
          </svg>

          <span>Loading...</span>
        </>
      ) : (
        <>
          {startIcon && <span className="flex items-center">{startIcon}</span>}

          <span>{children}</span>

          {endIcon && <span className="flex items-center">{endIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;
