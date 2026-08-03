import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api/client";
import { routes } from "@/lib/navigation";
import { DetailFieldGrid, DetailSection, DetailShell } from "@/components/app/DetailShell";
import { useT } from "@/lib/i18n";

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
  const [template, setTemplate] = useState<MsgTemplate | null>(null);
  const [preview, setPreview] = useState<{ title: string; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [tplRes, varsRes] = await Promise.all([
        api<{ data: MsgTemplate }>(`/crm/templates/${id}`),
        api<{ data: { sample_values: Record<string, string> } }>("/crm/templates/variables"),
      ]);
      const tpl = tplRes.data;
      setTemplate(tpl);
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
      setPreview(rendered.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
