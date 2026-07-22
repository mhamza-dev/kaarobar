"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalSession, portalApi } from "@/lib/portal-api";
import Button from "@/components/ui/Button";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";

type PortalCustomer = {
  name: string;
  phone?: string | null;
  marketing_opt_in_email: boolean;
  marketing_opt_in_sms: boolean;
  marketing_opt_in_whatsapp: boolean;
  profile_pic_url?: string | null;
};

export default function PortalPreferencesPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailOpt, setEmailOpt] = useState(false);
  const [smsOpt, setSmsOpt] = useState(false);
  const [waOpt, setWaOpt] = useState(false);
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!getPortalSession()) {
      router.replace("/portal/login");
      return;
    }
    void portalApi<{ data: { customer: PortalCustomer } }>("/portal/me")
      .then((res) => {
        const c = res.data.customer;
        setName(c.name || "");
        setPhone(c.phone || "");
        setEmailOpt(c.marketing_opt_in_email);
        setSmsOpt(c.marketing_opt_in_sms);
        setWaOpt(c.marketing_opt_in_whatsapp);
        setPicUrl(c.profile_pic_url || null);
      })
      .catch(() => router.replace("/portal/login"));
  }, [router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await portalApi("/portal/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          phone,
          marketing_opt_in_email: emailOpt,
          marketing_opt_in_sms: smsOpt,
          marketing_opt_in_whatsapp: waOpt,
        }),
      });
      setMessage("Preferences saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-bold text-heading">Preferences</h1>
      {message ? <p className="text-sm text-body">{message}</p> : null}

      <div className="rounded-xl border border-border bg-white p-6">
        <ProfilePicEditor
          url={picUrl}
          name={name}
          uploadPath="/portal/me/profile-pic"
          request={portalApi}
          urlFromResponse={(body) =>
            (body as { data?: PortalCustomer })?.data?.profile_pic_url
          }
          onChange={setPicUrl}
          label="Your photo"
        />
      </div>

      <form onSubmit={save} className="grid gap-3 rounded-xl border border-border bg-white p-6">
        <label className="text-sm font-medium text-heading">
          Name
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-sm font-medium text-heading">
          Phone
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={emailOpt} onChange={(e) => setEmailOpt(e.target.checked)} />
          Email marketing
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={smsOpt} onChange={(e) => setSmsOpt(e.target.checked)} />
          SMS marketing
        </label>
        <label className="flex items-center gap-2 text-sm text-body">
          <input type="checkbox" checked={waOpt} onChange={(e) => setWaOpt(e.target.checked)} />
          WhatsApp marketing
        </label>
        <Button type="submit" loading={busy}>
          Save
        </Button>
      </form>
    </div>
  );
}
