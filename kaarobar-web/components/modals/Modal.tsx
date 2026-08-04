"use client";

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
}

const Modal = ({
  isOpen,
  title,
  description,
  children,
  footer,
  onClose,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
}: ModalProps): React.ReactElement | null => {
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen || !mounted) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-2xl",
    lg: "max-w-4xl",
    xl: "max-w-6xl",
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        className="glass-modal-backdrop absolute inset-0"
        onClick={() => {
          if (closeOnBackdrop) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass-modal relative flex max-h-[90vh] w-full flex-col animate-sheet ${sizes[size]}`}
      >
        {(title || description || showCloseButton) && (
          <div className="glass-modal-header flex shrink-0 items-start justify-between gap-4 px-6 py-5 ps-7">
            <div className="min-w-0 space-y-1.5">
              {title && (
                <h2
                  id={titleId}
                  className="text-xl font-semibold tracking-tight text-heading"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="max-w-prose text-sm leading-relaxed text-body">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-glass-border bg-bg-secondary/50 text-body shadow-sm transition hover:border-brand/30 hover:bg-brand/10 hover:text-heading"
                aria-label="Close"
              >
                <X size={16} strokeWidth={2.25} />
              </button>
            )}
          </div>
        )}

        <div className="glass-modal-body min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="glass-modal-footer shrink-0 px-6 py-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
