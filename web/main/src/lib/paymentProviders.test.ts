import { describe, expect, it } from "vitest";

import { credentialsToSend, webhookUrlFor } from "./paymentProviders";

describe("credentialsToSend", () => {
  it("sends nothing when every field is blank, so the stored secret stays", () => {
    expect(credentialsToSend("jazzcash", { merchant_id: "", password: " " })).toBeUndefined();
  });

  it("sends the provider's full set of keys once anything is filled", () => {
    expect(credentialsToSend("easypaisa", { store_id: "123", hash_key: "abc" })).toEqual({
      store_id: "123",
      hash_key: "abc",
    });
  });

  it("never sends keys the adapter does not read", () => {
    expect(credentialsToSend("stripe", { secret_key: "sk_test", other: "x" })).toEqual({
      secret_key: "sk_test",
    });
  });

  it("has nothing to send for a manual provider", () => {
    expect(credentialsToSend("manual", {})).toBeUndefined();
  });
});

describe("webhookUrlFor", () => {
  it("points at the provider's webhook route under the API", () => {
    expect(webhookUrlFor("https://api.kaarobar.pk/api/v1/", "stripe")).toBe(
      "https://api.kaarobar.pk/api/v1/webhooks/stripe",
    );
  });
});
