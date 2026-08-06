import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, colors } from "../lib/api";
import { t } from "../lib/i18n";
import { useToast } from "./Toast";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { pushPath } from "../lib/nav";
import { formatDecimal } from "../lib/decimal";
import CustomForm from "./ui/CustomForm";
import { FormikTextField } from "./ui/FormFields";
import {
  appointmentNotesSchema,
  type AppointmentNotesValues,
} from "../lib/validations/checkout";

export type BookableService = {
  id: string;
  name: string;
  price?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  image_url?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string } | null;
  product_kind?: string | null;
};

export type BookableStaff = {
  id: string;
  name: string;
};

type Slot = {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  product_id: string;
  branch_id: string;
  duration_minutes: number;
};

type Step = "service" | "staff" | "slot" | "confirm";

function formatPrice(price?: string | number | null) {
  return formatDecimal(price);
}

function formatSlotTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  businessId: string;
  branchId?: string | null;
  services: BookableService[];
  staff: BookableStaff[];
  accent?: string;
};

/** Customer appointment booking: service → optional staff → slot → confirm (CUS-FR-005 / SCH-FR-001). */
export default function BuyerBookFlow({
  businessId,
  branchId,
  services,
  staff,
  accent,
}: Props) {
  const toast = useToast();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<BookableService | null>(null);
  const [staffMember, setStaffMember] = useState<BookableStaff | null>(null);
  const [anyStaff, setAnyStaff] = useState(true);
  const [date, setDate] = useState(addDaysIso(1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const iso = addDaysIso(i === 0 ? 0 : i);
        const label = new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        return { iso, label, disabled: iso < todayIso() };
      }),
    []
  );

  const loadSlots = useCallback(async () => {
    if (!service) return;
    const staffIds = anyStaff
      ? staff.map((s) => s.id)
      : staffMember
        ? [staffMember.id]
        : [];
    if (staffIds.length === 0) {
      setSlots([]);
      setError(t("appointments.noStaff"));
      return;
    }

    setLoadingSlots(true);
    setError(null);
    setSlot(null);
    try {
      const results = await Promise.all(
        staffIds.map((sid) =>
          api<{ data: Slot[] }>(
            `/portal/appointments/slots?business_id=${encodeURIComponent(businessId)}&product_id=${encodeURIComponent(service.id)}&staff_id=${encodeURIComponent(sid)}&date=${encodeURIComponent(date)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`
          ).then((res) => res.data || [])
        )
      );
      const merged = results
        .flat()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      setSlots(merged);
      if (merged.length === 0) setError(t("appointments.noSlots"));
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : t("appointments.slotsFailed"));
    } finally {
      setLoadingSlots(false);
    }
  }, [anyStaff, branchId, businessId, date, service, staff, staffMember]);

  useEffect(() => {
    if (step === "slot") void loadSlots();
  }, [step, loadSlots]);

  function pickService(s: BookableService) {
    setService(s);
    setStep("staff");
  }

  function continueFromStaff() {
    if (!anyStaff && !staffMember) {
      toast.error(t("appointments.pickStaff"));
      return;
    }
    setStep("slot");
  }

  function pickSlot(s: Slot) {
    setSlot(s);
    setStep("confirm");
  }

  async function confirmBooking(values: AppointmentNotesValues) {
    if (!service || !slot) return;
    setError(null);
    try {
      await api("/portal/appointments", {
        method: "POST",
        body: JSON.stringify({
          business_id: businessId,
          branch_id: branchId || slot.branch_id,
          product_id: service.id,
          staff_id: slot.staff_id,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          notes: values.notes.trim() || undefined,
        }),
      });
      toast.success(t("appointments.booked"));
      pushPath(navigation, "/app/sales");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("appointments.bookFailed");
      setError(msg);
      toast.error(msg);
    }
  }

  const staffNameForSlot = (sid: string) =>
    staff.find((s) => s.id === sid)?.name || t("appointments.staff");

  if (services.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>{t("appointments.emptyServicesTitle")}</Text>
        <Text style={styles.emptyBody}>{t("appointments.emptyServicesBody")}</Text>
      </View>
    );
  }

  const steps: { id: Step; label: string }[] = [
    { id: "service", label: t("appointments.stepService") },
    { id: "staff", label: t("appointments.stepStaff") },
    { id: "slot", label: t("appointments.stepSlot") },
    { id: "confirm", label: t("appointments.stepConfirm") },
  ];
  const order: Step[] = ["service", "staff", "slot", "confirm"];

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <View style={styles.stepRow}>
        {steps.map((s, i) => {
          const active = step === s.id;
          const done = order.indexOf(step) > i;
          return (
            <View
              key={s.id}
              style={[
                styles.stepChip,
                active && { backgroundColor: accent || colors.brand },
                done && !active && styles.stepDone,
              ]}
            >
              <Text
                style={[
                  styles.stepChipText,
                  (active || done) && { color: active ? colors.white : colors.brand },
                ]}
              >
                {s.label}
              </Text>
            </View>
          );
        })}
      </View>

      {error && step !== "slot" ? <Text style={styles.error}>{error}</Text> : null}

      {step === "service" ? (
        <View style={styles.grid}>
          {services.map((s) => (
            <Pressable
              key={s.id}
              style={[
                styles.card,
                accent ? { borderTopColor: accent, borderTopWidth: 3 } : null,
              ]}
              onPress={() => pickService(s)}
            >
              <Text style={styles.cat}>
                {s.category_ref?.name || s.category || t("appointments.service")}
              </Text>
              <Text style={styles.cardTitle}>{s.name}</Text>
              {s.duration_minutes ? (
                <Text style={styles.meta}>
                  {t("appointments.minutes", { count: s.duration_minutes })}
                </Text>
              ) : null}
              <Text style={styles.price}>Rs {formatPrice(s.price)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {step === "staff" && service ? (
        <View style={styles.section}>
          <Pressable onPress={() => setStep("service")}>
            <Text style={[styles.backLink, { color: accent || colors.brand }]}>
              ← {service.name}
            </Text>
          </Pressable>
          <Text style={styles.hint}>{t("appointments.staffHint")}</Text>
          <Pressable
            style={[styles.staffCard, anyStaff && styles.staffCardOn]}
            onPress={() => {
              setAnyStaff(true);
              setStaffMember(null);
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>?</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t("appointments.anyStaff")}</Text>
              <Text style={styles.meta}>{t("appointments.anyStaffHint")}</Text>
            </View>
          </Pressable>
          {staff.map((s) => {
            const on = !anyStaff && staffMember?.id === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.staffCard, on && styles.staffCardOn]}
                onPress={() => {
                  setAnyStaff(false);
                  setStaffMember(s);
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {s.name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardTitle}>{s.name}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: accent || colors.brand }]}
            onPress={continueFromStaff}
          >
            <Text style={styles.primaryBtnText}>{t("appointments.continueToSlots")}</Text>
          </Pressable>
        </View>
      ) : null}

      {step === "slot" && service ? (
        <View style={styles.section}>
          <Pressable onPress={() => setStep("staff")}>
            <Text style={[styles.backLink, { color: accent || colors.brand }]}>
              ← {t("appointments.stepStaff")}
            </Text>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateRow}
          >
            {dateOptions.map((d) => (
              <Pressable
                key={d.iso}
                disabled={d.disabled}
                onPress={() => setDate(d.iso)}
                style={[
                  styles.dateChip,
                  date === d.iso && {
                    backgroundColor: accent || colors.brand,
                    borderColor: accent || colors.brand,
                  },
                  d.disabled && { opacity: 0.4 },
                ]}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    date === d.iso && { color: colors.white },
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {loadingSlots ? (
            <Text style={styles.meta}>{t("appointments.loadingSlots")}</Text>
          ) : error ? (
            <Text style={styles.warn}>{error}</Text>
          ) : (
            <View style={styles.slotGrid}>
              {slots.map((s) => (
                <Pressable
                  key={`${s.staff_id}-${s.starts_at}`}
                  style={styles.slotCard}
                  onPress={() => pickSlot(s)}
                >
                  <Text style={styles.cardTitle}>{formatSlotTime(s.starts_at)}</Text>
                  {anyStaff ? (
                    <Text style={styles.meta}>{staffNameForSlot(s.staff_id)}</Text>
                  ) : null}
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {step === "confirm" && service && slot ? (
        <View style={styles.section}>
          <Pressable onPress={() => setStep("slot")}>
            <Text style={[styles.backLink, { color: accent || colors.brand }]}>
              ← {t("appointments.stepSlot")}
            </Text>
          </Pressable>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{service.name}</Text>
            <Text style={styles.meta}>{new Date(slot.starts_at).toLocaleString()}</Text>
            <Text style={styles.meta}>{staffNameForSlot(slot.staff_id)}</Text>
            <Text style={styles.meta}>
              {t("appointments.minutes", {
                count: slot.duration_minutes || service.duration_minutes || 30,
              })}
              {" · "}
              Rs {formatPrice(service.price)}
            </Text>
            <CustomForm
              initialValues={{ notes: "" }}
              validationSchema={appointmentNotesSchema}
              onSubmit={confirmBooking}
            >
              {({ handleSubmit, isSubmitting }) => (
                <View>
                  <FormikTextField
                    name="notes"
                    label={t("appointments.notes")}
                    multiline
                    placeholder={t("appointments.notesPlaceholder")}
                    inputStyle={styles.notesInput}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <Pressable
                    style={[
                      styles.primaryBtn,
                      {
                        backgroundColor: accent || colors.brand,
                        opacity: isSubmitting ? 0.6 : 1,
                      },
                    ]}
                    disabled={isSubmitting}
                    onPress={() => handleSubmit()}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.primaryBtnText}>
                        {t("appointments.confirmBook")}
                      </Text>
                    )}
                  </Pressable>
                </View>
              )}
            </CustomForm>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 40, gap: 12 },
  stepRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  stepChip: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.bgSecondary || "#F1F5F9",
  },
  stepDone: { backgroundColor: colors.brandSoft },
  stepChipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.muted,
  },
  error: { color: colors.danger, marginBottom: 4 },
  warn: { color: "#b45309", marginTop: 8 },
  grid: { gap: 10 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cat: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  cardTitle: { fontWeight: "700", color: colors.heading, marginTop: 4, fontSize: 15 },
  meta: { marginTop: 4, color: colors.body, fontSize: 13 },
  price: { marginTop: 10, fontWeight: "800", color: colors.heading, fontSize: 18 },
  section: { gap: 10 },
  backLink: { fontWeight: "700", marginBottom: 4 },
  hint: { color: colors.body, fontSize: 14 },
  staffCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  staffCardOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary || "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: colors.heading },
  primaryBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  dateRow: { gap: 8, paddingVertical: 4 },
  dateChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  dateChipText: { fontSize: 12, fontWeight: "700", color: colors.heading },
  slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  slotCard: {
    width: "47%",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  confirmCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  confirmTitle: { fontSize: 18, fontWeight: "800", color: colors.heading },
  notesInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 64,
    color: colors.heading,
    textAlignVertical: "top",
  },
  emptyWrap: { paddingVertical: 32, alignItems: "center", paddingHorizontal: 12 },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: colors.heading, textAlign: "center" },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.body,
    textAlign: "center",
    lineHeight: 20,
  },
});
