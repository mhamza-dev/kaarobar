"use client";

import React from "react";
import Modal from "@/components/modals/Modal";

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
      description="Please read these Terms & Conditions carefully before using Kaarobar."
      onClose={onClose}
    >
      <div className="space-y-6 text-sm leading-7 text-body">
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">
            1. Acceptance of Terms
          </h3>
          <p>
            By creating an account or using Kaarobar, you agree to these Terms
            &amp; Conditions. If you disagree, discontinue use of the platform.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">
            2. Account Responsibilities
          </h3>
          <p>
            You are responsible for safeguarding credentials and ensuring
            information provided for your business is accurate.
          </p>
        </section>
        <section>
          <h3 className="mb-2 text-lg font-semibold text-heading">
            3. Acceptable Use
          </h3>
          <p>
            You agree not to misuse Kaarobar, attempt unauthorized access, or use
            the platform for unlawful activities.
          </p>
        </section>
      </div>
    </Modal>
  );
};

export default TermsModal;
