import { describe, expect, it } from "vitest";

import { normalizeProductForKind, productFieldRules, productKindLabel } from "./productKinds";

describe("productFieldRules", () => {
  it("allows stock tracking only on the stockable kinds", () => {
    expect(productFieldRules("item").canTrackStock).toBe(true);
    expect(productFieldRules("rental").canTrackStock).toBe(true);
    expect(productFieldRules("service").canTrackStock).toBe(false);
    expect(productFieldRules("gift_card").canTrackStock).toBe(false);
  });

  it("gates batch and serial behind stock actually being tracked", () => {
    const off = productFieldRules("item", { tracksStock: false });
    expect(off.canTrackBatch).toBe(false);
    expect(off.canTrackSerial).toBe(false);

    const on = productFieldRules("item", { tracksStock: true });
    expect(on.canTrackBatch).toBe(true);
    expect(on.canTrackSerial).toBe(true);
  });

  it("never offers batch on a kind that cannot hold stock at all", () => {
    expect(productFieldRules("service", { tracksStock: true }).canTrackBatch).toBe(false);
  });

  it("asks for the duration field only where the kind needs one", () => {
    expect(productFieldRules("service").needsServiceDuration).toBe(true);
    expect(productFieldRules("rental").needsRentalPeriod).toBe(true);
    expect(productFieldRules("membership").needsMembershipDays).toBe(true);
    expect(productFieldRules("item").needsServiceDuration).toBe(false);
  });

  it("treats bundles and deals as component-bearing", () => {
    expect(productFieldRules("bundle").hasComponents).toBe(true);
    expect(productFieldRules("deal").hasComponents).toBe(true);
    expect(productFieldRules("item").hasComponents).toBe(false);
  });
});

describe("normalizeProductForKind", () => {
  it("clears stock tracking the backend would force off anyway", () => {
    const result = normalizeProductForKind({
      kind: "service" as const,
      tracks_stock: true,
      tracks_batch: true,
      tracks_serial: true,
    });

    expect(result.tracks_stock).toBe(false);
    expect(result.tracks_batch).toBe(false);
    expect(result.tracks_serial).toBe(false);
  });

  it("drops batch and serial when stock tracking is off", () => {
    const result = normalizeProductForKind({
      kind: "item" as const,
      tracks_stock: false,
      tracks_batch: true,
      tracks_serial: true,
    });

    expect(result.tracks_batch).toBe(false);
    expect(result.tracks_serial).toBe(false);
  });

  it("forces batch on for a regulated vertical that tracks stock", () => {
    const result = normalizeProductForKind(
      { kind: "item" as const, tracks_stock: true, tracks_batch: false },
      { requiresBatch: true },
    );

    expect(result.tracks_batch).toBe(true);
  });

  it("does not force batch on when nothing is stocked", () => {
    const result = normalizeProductForKind(
      { kind: "service" as const, tracks_stock: true, tracks_batch: false },
      { requiresBatch: true },
    );

    expect(result.tracks_batch).toBe(false);
  });

  it("clears duration fields belonging to other kinds", () => {
    const result = normalizeProductForKind({
      kind: "service" as const,
      service_duration_minutes: 30,
      rental_period_minutes: 120,
      membership_days: 365,
    });

    expect(result.service_duration_minutes).toBe(30);
    expect(result.rental_period_minutes).toBeNull();
    expect(result.membership_days).toBeNull();
  });

  it("keeps weight only on plain items", () => {
    expect(normalizeProductForKind({ kind: "item" as const, is_weighted: true }).is_weighted).toBe(
      true,
    );
    expect(
      normalizeProductForKind({ kind: "service" as const, is_weighted: true }).is_weighted,
    ).toBe(false);
  });
});

describe("productKindLabel", () => {
  it("humanizes the underscored kinds", () => {
    expect(productKindLabel("gift_card")).toBe("Gift card");
    expect(productKindLabel("item")).toBe("Item");
  });
});
