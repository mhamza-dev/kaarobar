import type { PaymentProviderKey } from "@/types/api/payments";

export type CredentialField = { key: string; label: string; secret: boolean };

/**
 * The credential keys each gateway adapter reads
 * (`Kaarobar.Payments.Adapters.*` → `Provider.credential/2`). A field the
 * adapter never reads is a field someone would paste a secret into for
 * nothing; a field it reads but the form omits is a gateway that can't
 * authenticate.
 */
export const PROVIDER_CREDENTIALS: Record<PaymentProviderKey, CredentialField[]> = {
  manual: [],
  stripe: [{ key: "secret_key", label: "Secret key", secret: true }],
  jazzcash: [
    { key: "merchant_id", label: "Merchant ID", secret: false },
    { key: "password", label: "Password", secret: true },
    { key: "integrity_salt", label: "Integrity salt", secret: true },
  ],
  easypaisa: [
    { key: "store_id", label: "Store ID", secret: false },
    { key: "hash_key", label: "Hash key", secret: true },
  ],
};

export const PROVIDER_LABELS: Record<PaymentProviderKey, string> = {
  manual: "Manual / bank transfer",
  stripe: "Stripe",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
};

/**
 * The credentials to send from a form's values.
 *
 * Credentials are write-only — the backend never returns them — so an edit
 * form starts blank. Blank means "keep what's stored": when every field is
 * empty nothing is sent at all. A partial fill is sent as-is and the
 * backend replaces the whole map, which is why the form asks for all of
 * them together.
 */
export function credentialsToSend(
  provider: string,
  values: Record<string, string>,
): Record<string, string> | undefined {
  const fields = PROVIDER_CREDENTIALS[provider as PaymentProviderKey] ?? [];
  const filled = fields.filter((field) => (values[field.key] ?? "").trim() !== "");
  if (filled.length === 0) return undefined;
  return Object.fromEntries(fields.map((field) => [field.key, (values[field.key] ?? "").trim()]));
}

/** Where the gateway should send its webhooks — `POST /api/v1/webhooks/:provider`. */
export function webhookUrlFor(apiUrl: string, provider: string): string {
  return `${apiUrl.replace(/\/$/, "")}/webhooks/${provider}`;
}
