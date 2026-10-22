/**
 * Typed, validated access to the environment variables this app needs.
 *
 * Fails loudly at import time rather than letting a missing
 * `NEXT_PUBLIC_API_URL` surface later as a confusing "Network Error" from
 * axios on the first request.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and set it.`,
    );
  }
  return value;
}

/** Empty means "not published yet" — screens say so rather than link nowhere. */
function optional(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value : null;
}

export const env = {
  apiUrl: required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
  /** The marketing site (`web/landing`), for its download and help pages. */
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL),
  /** Where the Kaarobar desktop app is downloaded from. */
  desktopDownloadUrl: optional(process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL),
  /** The staff app's store listings. */
  iosAppUrl: optional(process.env.NEXT_PUBLIC_IOS_APP_URL),
  androidAppUrl: optional(process.env.NEXT_PUBLIC_ANDROID_APP_URL),
};
