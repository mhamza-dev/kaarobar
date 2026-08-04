/** Display labels for POS / sale payment methods (maps legacy khata → credit). */

export function paymentMethodLabel(
  method: string,
  t: (key: string) => string
): string {
  const normalized = method === "khata" ? "credit" : method;
  switch (normalized) {
    case "cash":
      return t("pos.cash");
    case "card":
      return t("pos.card");
    case "wallet":
      return t("pos.wallet");
    case "credit":
      return t("pos.khata");
    default:
      return method;
  }
}

export function campaignAudienceLabel(
  audience: string,
  t: (key: string) => string
): string {
  switch (audience) {
    case "all":
      return t("marketing.audienceAll");
    case "credit":
    case "khata":
      return t("marketing.audienceKhata");
    case "min_points":
      return t("marketing.audienceMinPoints");
    default:
      return audience;
  }
}
