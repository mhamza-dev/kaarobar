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

export const env = {
  apiUrl: required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
};
