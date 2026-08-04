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
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={submitLoading}
            disabled={submitDisabled}
            startIcon={submitIcon}
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
