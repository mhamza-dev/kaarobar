/**
 * `GET /business-types` — mirrors Kaarobar.Verticals via
 * backend/lib/backend_web/controllers/business_controller.ex#types/2.
 * Public (unauthenticated): needed on the registration form, before a
 * session exists.
 *
 * `groups` is keyed by group name (e.g. "retail", "food"), each holding the
 * business types in it — `Verticals.grouped/0` builds it via
 * `Enum.group_by/3`, not an array of `{key,label,types}`. `modules` and
 * `product_kinds` are just the full flat catalogues of every module/kind key
 * this platform understands, not per-type maps — per-business-type gating
 * comes from `business.modules`/`business.product_kinds` on the `Business`
 * record itself (already resolved server-side), not from these.
 */
export type BusinessTypeOption = {
  type: string;
  label: string;
};

export type BusinessTypesResponse = {
  groups: Record<string, BusinessTypeOption[]>;
  modules: string[];
  product_kinds: string[];
};
