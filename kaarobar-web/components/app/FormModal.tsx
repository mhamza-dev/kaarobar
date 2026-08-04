"use client";

import type { ReactNode } from "react";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";

type FormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  formId: string;
  submitLabel: string;
  cancelLabel?: string;
  submitLoading?: boolean;
  submitDisabled?: boolean;
  submitIcon?: ReactNode;
  children: ReactNode;
};

export default function FormModal({
  isOpen,
  onClose,
  title,
  description,
  size,
  formId,
  submitLabel,
  cancelLabel = "Cancel",
  submitLoading,
  submitDisabled,
  submitIcon,
  children,
}: FormModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <Button
            variant="outline"
            onClick={onClose}
            className="min-w-[5.5rem] rounded-full border-[color-mix(in_srgb,var(--glass-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--glass)_55%,transparent)] backdrop-blur-md hover:bg-[color-mix(in_srgb,var(--glass-strong)_70%,transparent)]"
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={submitLoading}
            disabled={submitDisabled}
            startIcon={submitIcon}
            className="min-w-[5.5rem] rounded-full shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--brand)_45%,transparent)]"
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Modal>
  );
}
