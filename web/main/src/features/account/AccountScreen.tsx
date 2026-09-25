"use client";

import { Form, Formik } from "formik";
import { Download, Loader2, LogOut, ShieldCheck, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import * as Yup from "yup";

import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useConfirmMfa,
  useDevices,
  useDisableMfa,
  useEnrollMfa,
  useEraseMyData,
  useRevokeDevice,
  useUpdateEmail,
  useUpdatePassword,
  useUpdateProfile,
} from "@/hooks/queries/useMe";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDateTime, formatRelative } from "@/lib/format";
import { exportMyData, type Device } from "@/services/me";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Your own account, as distinct from the business's settings: who you are,
 * how you sign in, where you're signed in, and your personal data.
 * Every change that affects signing in asks for the current password.
 */
export function AccountScreen() {
  const user = useSessionStore((state) => state.scope?.user);
  if (!user) return null;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Section title="Profile" description="How you appear to the rest of the team.">
        <ProfileForm />
      </Section>
      <Section title="Email" description={`You sign in as ${user.email}.`}>
        <EmailForm />
      </Section>
      <Section title="Password" description="Changing it signs you out on every other device.">
        <PasswordForm />
      </Section>
      <Section
        title="Two-step sign-in"
        description="A code from an authenticator app, as well as your password."
      >
        <MfaPanel enabled={user.mfa_enabled} />
      </Section>
      <Section title="Where you're signed in" description="Sign out anywhere you don't recognise.">
        <DevicesTable />
      </Section>
      <Section title="Your data" description="Everything held about you personally.">
        <DataPanel />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ProfileForm() {
  const user = useSessionStore((state) => state.scope?.user);
  const update = useUpdateProfile();
  if (!user) return null;

  return (
    <Formik
      initialValues={{ name: user.name, phone: user.phone ?? "", timezone: user.timezone }}
      enableReinitialize
      validationSchema={Yup.object({ name: Yup.string().trim().required("Your name is required") })}
      onSubmit={async (values, helpers) => {
        try {
          await update.mutateAsync([
            { name: values.name, phone: values.phone || null, timezone: values.timezone },
          ]);
          toast.success("Profile saved");
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({ error, values, setErrors: helpers.setErrors });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting, dirty }) => (
        <Form className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormTextField name="name" label="Name" autoComplete="name" />
            <FormTextField name="phone" label="Phone" type="tel" autoComplete="tel" />
            <FormTextField name="timezone" label="Time zone" hint="e.g. Asia/Karachi" />
          </div>
          <div>
            <Button type="submit" disabled={isSubmitting || !dirty}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save profile
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

function EmailForm() {
  const update = useUpdateEmail();
  return (
    <Formik
      initialValues={{ email: "", current_password: "" }}
      validationSchema={Yup.object({
        email: Yup.string().email("Enter a valid email address").required("Enter the new address"),
        current_password: Yup.string().required("Confirm with your password"),
      })}
      onSubmit={async (values, helpers) => {
        try {
          await update.mutateAsync([values]);
          toast.success(`You now sign in as ${values.email}`);
          helpers.resetForm();
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({ error, values, setErrors: helpers.setErrors });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="grid gap-4 sm:grid-cols-2">
          <FormTextField name="email" label="New email" type="email" autoComplete="email" />
          <FormTextField
            name="current_password"
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
          <div>
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Change email
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

function PasswordForm() {
  const update = useUpdatePassword();
  return (
    <Formik
      initialValues={{ current_password: "", password: "", password_confirmation: "" }}
      validationSchema={Yup.object({
        current_password: Yup.string().required("Enter your current password"),
        password: Yup.string().min(10, "At least 10 characters").required("Choose a new password"),
        password_confirmation: Yup.string()
          .oneOf([Yup.ref("password")], "Doesn't match the new password")
          .required("Type it again"),
      })}
      onSubmit={async (values, helpers) => {
        try {
          await update.mutateAsync([values]);
          toast.success("Password changed. Other devices have been signed out.");
          helpers.resetForm();
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({ error, values, setErrors: helpers.setErrors });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting }) => (
        <Form className="grid gap-4 sm:grid-cols-3">
          <FormTextField
            name="current_password"
            label="Current password"
            type="password"
            autoComplete="current-password"
          />
          <FormTextField
            name="password"
            label="New password"
            type="password"
            autoComplete="new-password"
          />
          <FormTextField
            name="password_confirmation"
            label="New password again"
            type="password"
            autoComplete="new-password"
          />
          <div>
            <Button type="submit" variant="outline" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Change password
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

/** The secret, for typing into an app that can't scan. */
function secretOf(uri: string) {
  return new URL(uri.replace("otpauth://", "https://")).searchParams.get("secret") ?? "";
}

function MfaPanel({ enabled }: { enabled: boolean }) {
  const enroll = useEnrollMfa();
  const confirm = useConfirmMfa();
  const disable = useDisableMfa();
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    QRCode.toDataURL(uri, { margin: 1, width: 192 })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const close = () => {
    setUri(null);
    setQr(null);
    setCode("");
  };

  if (enabled) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-success" /> On — you&apos;re asked for a code at
          sign-in.
        </p>
        <Button variant="outline" onClick={() => setDisabling(true)}>
          <ShieldOff className="size-4" />
          Turn off
        </Button>
        <ReasonDialog
          open={disabling}
          onOpenChange={setDisabling}
          title="Turn off two-step sign-in?"
          description="Your password alone will be enough to sign in. Confirm with it."
          label="Current password"
          inputType="password"
          confirmLabel="Turn off"
          destructive
          onSubmit={async (password) => {
            await disable.mutateAsync([password]);
            toast.success("Two-step sign-in is off");
            setDisabling(false);
          }}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Off — a password alone signs you in.</p>
        <Button
          disabled={enroll.isPending}
          onClick={async () => {
            try {
              const result = await enroll.mutateAsync([]);
              setUri(result.provisioning_uri);
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          {enroll.isPending && <Loader2 className="size-4 animate-spin" />}
          Set up
        </Button>
      </div>

      <Dialog open={!!uri} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-step sign-in</DialogTitle>
            <DialogDescription>
              Scan this with an authenticator app (Google Authenticator, Microsoft Authenticator,
              1Password…), then enter the six-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {qr ? (
              // A data URL generated locally — the secret never leaves the browser.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR code for your authenticator app"
                className="size-48 rounded-lg border border-border"
              />
            ) : (
              <div className="size-48 animate-pulse rounded-lg bg-muted" />
            )}
            {uri && (
              <p className="text-center text-xs text-muted-foreground">
                Can&apos;t scan? Enter this key:{" "}
                <code className="font-mono break-all text-foreground" aria-label="Setup key">
                  {secretOf(uri)}
                </code>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mfa-code">Code from the app</Label>
            <Input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button
              disabled={code.length !== 6 || confirm.isPending}
              onClick={async () => {
                try {
                  await confirm.mutateAsync([code]);
                  toast.success("Two-step sign-in is on");
                  close();
                } catch {
                  // Toasted by the hook — usually a mistyped or expired code.
                }
              }}
            >
              {confirm.isPending && <Loader2 className="size-4 animate-spin" />}
              Turn on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DevicesTable() {
  const { data, isLoading, error, refetch } = useDevices();
  const revoke = useRevokeDevice();

  const columns: DataTableColumn<Device>[] = [
    {
      key: "device",
      header: "Device",
      render: (device) => (
        <div>
          <p className="flex items-center gap-2 font-medium">
            {device.device_name ?? describeAgent(device.user_agent)}
            {device.current && <Badge variant="secondary">This device</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">
            {device.ip_address ?? "Unknown address"} · signed in {formatDateTime(device.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: "used",
      header: "Last used",
      render: (device) => (device.last_used_at ? formatRelative(device.last_used_at) : "—"),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (device) =>
        device.current ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={revoke.isPending}
            onClick={async () => {
              try {
                await revoke.mutateAsync([device.id]);
                toast.success("Signed out of that device");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        ),
    },
  ];

  return (
    <DataTable
      embedded
      columns={columns}
      rows={data ?? []}
      rowKey={(device) => device.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      mobileCardTitle={(device) => device.device_name ?? describeAgent(device.user_agent)}
      mobileCardSubtitle={(device) => (device.current ? "This device" : (device.ip_address ?? ""))}
    />
  );
}

/** A readable name from a user-agent string: browser on OS, roughly. */
function describeAgent(agent: string | null): string {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Chrome\//.test(agent)
      ? "Chrome"
      : /Firefox\//.test(agent)
        ? "Firefox"
        : /Safari\//.test(agent)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(agent)
    ? "Windows"
    : /Android/.test(agent)
      ? "Android"
      : /iPhone|iPad/.test(agent)
        ? "iOS"
        : /Mac OS/.test(agent)
          ? "macOS"
          : /Linux/.test(agent)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function DataPanel() {
  const router = useRouter();
  const clear = useSessionStore((state) => state.clear);
  const erase = useEraseMyData();
  const [exporting, setExporting] = useState(false);
  const [erasing, setErasing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        disabled={exporting}
        onClick={async () => {
          setExporting(true);
          try {
            const data = await exportMyData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "kaarobar-my-data.json";
            link.click();
            URL.revokeObjectURL(url);
          } catch {
            toast.error("Couldn't export your data");
          } finally {
            setExporting(false);
          }
        }}
      >
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Download my data
      </Button>
      <Button variant="ghost" className="text-destructive" onClick={() => setConfirmed(true)}>
        Erase my account
      </Button>

      {/* Two steps on purpose: first what it means, then the password. */}
      <Dialog open={confirmed} onOpenChange={setConfirmed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erase your account?</DialogTitle>
            <DialogDescription>
              Your name, email, phone and sign-in are scrubbed and every device is signed out. The
              sales and records you made stay with the business, without your details. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmed(false)}>
              Keep my account
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmed(false);
                setErasing(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ReasonDialog
        open={erasing}
        onOpenChange={setErasing}
        title="Confirm with your password"
        label="Current password"
        inputType="password"
        confirmLabel="Erase my account"
        destructive
        onSubmit={async (password) => {
          await erase.mutateAsync([password]);
          clear();
          router.replace("/login");
        }}
      />
    </div>
  );
}
