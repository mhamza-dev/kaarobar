/**
 * Mirrors `SalesSerializers.customer/1`.
 *
 * Phase 4 needs customers for credit sales and receipts; Phase 5 builds the
 * customer screens proper on top of this.
 */
export type Customer = {
  id: string;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  tax_number: string | null;
  date_of_birth: string | null;
  notes: string | null;
  balance: string | null;
  credit_limit: string | null;
  credit_allowed: boolean;
  /** `null` means unlimited; a number is what is left to spend on account. */
  available_credit: string | null;
  owing: boolean;
  is_active: boolean;
};
