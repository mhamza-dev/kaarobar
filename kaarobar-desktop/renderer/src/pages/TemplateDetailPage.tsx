import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, getSession } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import { useT } from "@/lib/i18n";
import { crmKeys } from "@/lib/queryClient";

type MsgTemplate = {
  id: string;
  name: string;
  channel: string;
  title_template: string;
  body_template: string;
  variables: Record<string, string>;
};

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const businessId = getSession()?.business_id ?? null;

  const templateQuery = useQuery({
    queryKey: [...crmKeys.templates(businessId), id] as const,
    queryFn: async () => {
      const [tplRes, varsRes] = await Promise.all([
        api<{ data: MsgTemplate }>(`/crm/templates/${id}`),
        api<{ data: { sample_values: Record<string, string> } }>("/crm/templates/variables"),
      ]);
      const tpl = tplRes.data;
      const sample = {
        ...(varsRes.data?.sample_values || {}),
        ...(tpl.variables || {}),
      };
      const rendered = await api<{ data: { title: string; message: string } }>(
        "/crm/templates/preview",
        {
          method: "POST",
          body: JSON.stringify({
            channel: tpl.channel,
            title_template: tpl.title_template,
            body_template: tpl.body_template,
            variables: sample,
          }),
        }
      );
      return { template: tpl, preview: rendered.data };
    },
    enabled: !!id && !!businessId,
  });

  const template = templateQuery.data?.template ?? null;
  const preview = templateQuery.data?.preview ?? null;
  const loading = templateQuery.isLoading;
  const error = templateQuery.error
    ? templateQuery.error instanceof Error
      ? templateQuery.error.message
      : t("common.loadFailed")
    : null;

  return (
    <DetailShell
      backHref={`${routes.marketing}?tab=templates`}
      backLabel={t("marketing.backToTemplates")}
      eyebrow={t("marketing.eyebrow")}
      title={template?.name || t("marketing.templateFallback")}
      subtitle={template?.title_template}
      loading={loading}
      error={error}
    >
      {template ? (
        <>
          <DetailSection title={t("marketing.overview")}>
            <DetailFieldGrid
              fields={[
                { label: t("marketing.channel"), value: template.channel },
                {
                  label: t("marketing.titleTemplate"),
                  value: template.title_template,
                },
              ]}
            />
            <p className="mt-4 whitespace-pre-wrap rounded-md bg-bg-tertiary px-3 py-3 text-sm text-heading">
              {template.body_template}
            </p>
          </DetailSection>

          <DetailSection title={t("marketing.templatePreview")}>
            <p className="mb-2 text-sm text-body">{t("marketing.sampleValues")}</p>
            {preview ? (
              <div className="rounded-md border border-border bg-white p-4 text-sm shadow-sm">
                <p className="font-bold text-heading">{preview.title}</p>
                <p className="mt-2 whitespace-pre-wrap text-body">{preview.message}</p>
                {template.channel === "sms" ? (
                  <p className="mt-2 text-xs text-muted">
                    {t("marketing.charsCount", { count: preview.message.length })}
                  </p>
                ) : null}
              </div>
            ) : null}
          </DetailSection>
        </>
      ) : null}
    </DetailShell>
  );
}
