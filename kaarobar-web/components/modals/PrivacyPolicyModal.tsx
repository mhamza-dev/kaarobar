"use client";

import React from "react";
import Modal from "@/components/modals/Modal";

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
      description="How Kaarobar collects, uses, and protects your information."
      onClose={onClose}
    >
      <div className="space-y-6 text-sm leading-7 text-body">
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">1. Overview</h3>
          <p>
            Kaarobar collects account and business information needed to provide
            and improve our Business Operating System.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">
            2. How We Use Information
          </h3>
          <p>
            We use information to operate the platform, authenticate users,
            provide support, and improve product quality.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">
            3. Children&apos;s Privacy
          </h3>
          <p>
            Kaarobar is intended for businesses and individuals who are at least
            18 years old.
          </p>
        </section>
      </div>
    </Modal>
  );
};

export default PrivacyPolicyModal;
