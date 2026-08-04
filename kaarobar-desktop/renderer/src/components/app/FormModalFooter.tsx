import Button from "@/components/ui/Button";

type FormModalFooterProps = {
  cancelLabel: string;
  submitLabel: string;
  onCancel: () => void;
  submitFormId: string;
  loading?: boolean;
  submitDisabled?: boolean;
  cancelVariant?: "outline" | "secondary";
};

export default function FormModalFooter({
  cancelLabel,
  submitLabel,
  onCancel,
  submitFormId,
  loading = false,
  submitDisabled = false,
  cancelVariant = "outline",
}: FormModalFooterProps) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant={cancelVariant} onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        form={submitFormId}
        loading={loading}
        disabled={submitDisabled}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
