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
    <div className="flex justify-end gap-2.5">
      <Button
        type="button"
        variant={cancelVariant}
        onClick={onCancel}
        className="rounded-full border-[color-mix(in_srgb,var(--glass-border)_90%,transparent)] bg-[color-mix(in_srgb,var(--glass)_55%,transparent)] backdrop-blur-md hover:bg-[color-mix(in_srgb,var(--glass-strong)_70%,transparent)]"
      >
        {cancelLabel}
      </Button>
      <Button
        type="submit"
        form={submitFormId}
        loading={loading}
        disabled={submitDisabled}
        className="rounded-full shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--brand)_45%,transparent)]"
      >
        {submitLabel}
      </Button>
    </div>
  );
}
