"use client";

import React from "react";
import Link from "next/link";

import Modal from "@/components/modals/Modal";
import LegalSections from "@/components/legal/LegalSections";
import { termsSections } from "@/lib/legal/content";
import { routes } from "@/lib/navigation";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TermsModal = ({
  isOpen,
  onClose,
}: TermsModalProps): React.ReactElement => {
  return (
    <Modal
      isOpen={isOpen}
      size="xl"
      title="Terms & Conditions"
      description="Please read these before you create an account."
      onClose={onClose}
    >
      <LegalSections sections={termsSections} compact />
      <p className="mt-6 text-sm text-muted">
        Prefer the full page?{" "}
        <Link href={routes.terms} className="font-medium text-brand hover:underline">
          Open Terms & Conditions
        </Link>
      </p>
    </Modal>
  );
};

export default TermsModal;
