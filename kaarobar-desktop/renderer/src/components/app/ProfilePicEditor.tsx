import { useRef, useState } from "react";
import { api } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

type UploadFn = <T>(path: string, init?: RequestInit) => Promise<T>;

type Props = {
  url?: string | null;
  name?: string;
  /** Multipart field name accepted by the API (`file`, `image`, or `profile_pic`). */
  uploadPath: string;
  /** Response path to the updated URL, e.g. `user.profile_pic_url` or `data.profile_pic_url`. */
  urlFromResponse: (body: unknown) => string | null | undefined;
  onChange: (url: string | null) => void;
  request?: UploadFn;
  size?: "md" | "lg";
  label?: string;
};

function initialsFrom(name?: string) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function ProfilePicEditor({
  url,
  name,
  uploadPath,
  urlFromResponse,
  onChange,
  request = api,
  size = "lg",
  label = "Profile photo",
}: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const dim = size === "lg" ? "h-24 w-24" : "h-16 w-16";

  async function upload(file: File) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const body = await request<unknown>(uploadPath, { method: "POST", body: fd });
      const next = urlFromResponse(body) ?? null;
      onChange(next);
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const body = await request<unknown>(uploadPath, { method: "DELETE" });
      const next = urlFromResponse(body) ?? null;
      onChange(next);
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div
        className={`${dim} overflow-hidden rounded-xl border border-border bg-bg-tertiary shadow-sm`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-brand text-lg font-bold text-white">
            {initialsFrom(name)}
          </div>
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-xs text-muted">JPG, PNG, WebP, or GIF · max 2 MB</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            {url ? "Change photo" : "Upload photo"}
          </Button>
          {url ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              loading={busy}
              onClick={() => void remove()}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
    </div>
  );
}
