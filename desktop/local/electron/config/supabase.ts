/**
 * How this app talks to Supabase.
 *
 * Everything goes through PostgREST's RPC endpoint with the anon key. There is
 * no supabase-js client in the main process on purpose: the only calls made are
 * a handful of `security definer` functions, and a REST POST is the whole of
 * it — the client would be a megabyte of dependency for a `fetch`.
 */

export type SupabaseConfig = { url: string; anonKey: string }

/**
 * Null when this build has no license server configured — development, or a
 * self-hosted install. Callers treat that as "cannot check", never as "not
 * licensed": a missing env var is our problem, not the shop's.
 */
export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.KAAROBAR_SUPABASE_URL?.trim()
  const anonKey = process.env.KAAROBAR_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url: url.replace(/\/+$/, ''), anonKey }
}

/**
 * Did we get an answer, and what was it?
 *
 * The distinction this type draws is the whole safety story of the licensing
 * heartbeat. `reached: false` means the question never got asked — no internet,
 * DNS down, Supabase having an outage, the RPC not deployed yet, a 500. None of
 * those say anything about whether a shop is licensed, and none of them may
 * ever lock a till.
 *
 * Only `reached: true` carries a verdict, and the verdict lives in the RPC's
 * own JSON body (`{ ok: false, error: 'revoked' }`), not in the HTTP status.
 * That is deliberate: a 404 because someone forgot to run the SQL would
 * otherwise brick every customer at once.
 */
export type RpcResult<T> =
  | { reached: true; data: T }
  | { reached: false; message: string }

/** Long enough for a slow shop connection, short enough that a wedged socket does not pin the job. */
const DEFAULT_TIMEOUT_MS = 20_000

export async function callSupabaseRpc<T>(
  fn: string,
  body: Record<string, unknown>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<RpcResult<T>> {
  const config = getSupabaseConfig()
  if (!config) {
    return { reached: false, message: 'Supabase is not configured on this build.' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return {
        reached: false,
        message: `${fn} returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ''}`,
      }
    }

    return { reached: true, data: (await response.json()) as T }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      reached: false,
      message: controller.signal.aborted ? `${fn} timed out after ${timeoutMs / 1000}s` : message,
    }
  } finally {
    clearTimeout(timer)
  }
}
