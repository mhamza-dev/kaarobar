import { createHmac } from "node:crypto";

/**
 * RFC 6238 TOTP, for tests only — the e2e suite has to produce the same
 * 6-digit code an authenticator app would, to exercise the MFA challenge
 * against the real backend (whose own implementation lives in
 * backend/lib/backend/accounts/totp.ex and is checked against RFC 6238's
 * published vectors there).
 */
export function generateTotp(base32Secret: string, at: number = Date.now()): string {
  const key = base32Decode(base32Secret);
  const counter = Math.floor(at / 1000 / 30);

  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const value = hmac.readUInt32BE(offset) & 0x7fffffff;

  return String(value % 1_000_000).padStart(6, "0");
}

function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.replace(/=+$/, "").toUpperCase();

  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (const char of cleaned) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}
