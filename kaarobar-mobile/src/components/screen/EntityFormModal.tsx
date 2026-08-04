import type { PropsWithChildren } from "react";
import { FormModal } from "../FormModal";

type EntityFormModalProps = PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  submitLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: () => void;
}>;

export default function EntityFormModal(props: EntityFormModalProps) {
  return (
    <FormModal
      visible={props.visible}
      title={props.title}
      subtitle={props.subtitle}
      submitLabel={props.submitLabel}
      busy={props.busy}
      onClose={props.onClose}
      onSubmit={props.onSubmit}
    >
      {props.children}
    </FormModal>
  );
}
