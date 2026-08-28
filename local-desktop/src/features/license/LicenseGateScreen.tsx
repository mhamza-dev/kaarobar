import { Form, Formik } from "formik";
import * as yup from "yup";
import { useTranslation } from "react-i18next";
import { Button, Card } from "../../components/ui";
import { FormTextField } from "../../components/form";
import { AuthShell, LanguageSelect } from "../../components/layout";
import { useFormatDate } from "../../lib/useFormatDate";

const SUPPORT_EMAIL = "support.kaarobar@gmail.com";

type Props = {
  mode: "missing" | "expired";
  expiresAt?: string | null;
  issuedTo?: string | null;
  loading: boolean;
  error?: string;
  onActivate: (licenseKey: string) => Promise<void>;
};

export function LicenseGateScreen({
  mode,
  expiresAt,
  issuedTo,
  loading,
  error,
  onActivate,
}: Props) {
  const { t } = useTranslation();
  const { formatDate } = useFormatDate();

  const schema = yup.object({
    licenseKey: yup.string().trim().required(t("license.licenseKeyRequired")),
  });

  const expiryLabel = expiresAt ? formatDate(expiresAt) : null;

  return (
    <AuthShell
      width="md"
      brandAlign="center"
      tagline={t("auth.brandTagline")}
      headerActions={<LanguageSelect containerClassName="w-40" />}
    >
      <Card
        title={
          mode === "expired"
            ? t("license.expiredTitle")
            : t("license.missingTitle")
        }
        description={
          mode === "expired"
            ? t("license.expiredDesc")
            : t("license.missingDesc")
        }
        accent="brand"
      >
        <div className="mb-4 space-y-2 text-sm text-ink-muted">
          {issuedTo ? (
            <p>
              <span className="font-medium text-ink">
                {t("license.issuedTo")}:{" "}
              </span>
              {issuedTo}
            </p>
          ) : null}
          {mode === "expired" && expiryLabel ? (
            <p>
              <span className="font-medium text-ink">
                {t("license.expiredOn")}:{" "}
              </span>
              {expiryLabel}
            </p>
          ) : null}
          <p>{t("license.buyOrContact")}</p>
          <a
            className="inline-flex break-all font-medium text-brand-primary hover:underline"
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Kaarobar license renewal")}`}
          >
            {t("license.contactTeam")} ({SUPPORT_EMAIL})
          </a>
        </div>

        <Formik
          initialValues={{ licenseKey: "" }}
          validationSchema={schema}
          onSubmit={async (values) => {
            await onActivate(values.licenseKey.trim());
          }}
        >
          {() => (
            <Form className="space-y-4">
              <FormTextField
                name="licenseKey"
                label={t("license.licenseKey")}
                placeholder="XXXX-XXXX-XXXX"
                autoFocus
              />
              {error ? (
                <p
                  className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <Button type="submit" loading={loading} className="w-full">
                {t("license.activate")}
              </Button>
            </Form>
          )}
        </Formik>
      </Card>
    </AuthShell>
  );
}
