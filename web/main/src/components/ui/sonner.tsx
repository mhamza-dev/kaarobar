"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // richColors, on the same text-safe pairs StatusBadge uses. Sonner's
          // own greens and reds fall short of 4.5:1 on their tinted grounds.
          "--success-bg": "var(--success-soft)",
          "--success-border": "var(--success-soft)",
          "--success-text": "var(--success)",
          "--error-bg": "var(--danger-soft)",
          "--error-border": "var(--danger-soft)",
          "--error-text": "var(--danger)",
          "--warning-bg": "var(--warning-soft)",
          "--warning-border": "var(--warning-soft)",
          "--warning-text": "var(--warning)",
          "--info-bg": "var(--brand-tint)",
          "--info-border": "var(--brand-tint)",
          "--info-text": "var(--foreground)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
