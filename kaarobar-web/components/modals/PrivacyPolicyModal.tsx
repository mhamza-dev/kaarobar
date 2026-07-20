"use client";

import React from "react";
import Link from "next/link";

import Modal from "@/components/modals/Modal";
import LegalSections from "@/components/legal/LegalSections";
import { privacySections } from "@/lib/legal/content";
import { routes } from "@/lib/navigation";

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PrivacyPolicyModal = ({
  isOpen,
  onClose,
}: PrivacyPolicyModalProps): React.ReactElement => {
  return (
    <Modal
      isOpen={isOpen}
      size="xl"
      title="Privacy Policy"
      description="How we collect, use, and look after your information."
      onClose={onClose}
    >
      <LegalSections sections={privacySections} compact />
      <p className="mt-6 text-sm text-muted">
        Prefer the full page?{" "}
        <Link href={routes.privacy} className="font-medium text-brand hover:underline">
          Open Privacy Policy
        </Link>
      </p>
    </Modal>
  );
};

export default PrivacyPolicyModal;
