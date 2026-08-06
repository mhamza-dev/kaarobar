# Client cache standards (Cloud apps)

Shared TanStack Query defaults for **Cloud** clients that talk to `kaarobar-BE` (`/api/v1`). Keep these values aligned across apps when changing cache behavior.

## Defaults

| Option | Value | Notes |
|--------|-------|-------|
| `staleTime` | `45_000` (45s) | Prefer shared freshness window |
| `gcTime` | `10 * 60_000` (10m) | Inactive query garbage collection |
| query `retry` | `1` | Avoid hammering a failing API |
| mutation `retry` | `1` | Same for writes |
| `networkMode` | `offlineFirst` | Use cache while offline / flaky network |
| `refetchOnReconnect` | `true` | Refresh after connectivity returns |
| `refetchOnWindowFocus` | platform-specific | Web/mobile: `true`; Cloud Desktop: `false` (less churn in Electron) |

## App coverage

| App | File |
|-----|------|
| Web | [`kaarobar-web/lib/queryClient.ts`](../../kaarobar-web/lib/queryClient.ts) |
| Cloud Desktop | [`kaarobar-desktop/renderer/src/lib/queryClient.ts`](../../kaarobar-desktop/renderer/src/lib/queryClient.ts) |
| Staff mobile | [`kaarobar-mobile/src/lib/queryClient.ts`](../../kaarobar-mobile/src/lib/queryClient.ts) |
| Customer mobile | [`kaarobar-customer/src/lib/queryClient.ts`](../../kaarobar-customer/src/lib/queryClient.ts) |

## Out of scope

**Offline Desktop Edition** ([`kaarobar-desktop-offline`](../../kaarobar-desktop-offline/)) is local-first (SQLite in the Electron main process). It does **not** use TanStack Query against Phoenix. Do not force these Cloud cache defaults onto that package unless Product explicitly asks for shared query UX.

## Related

- Cloud Desktop sync outbox: SRS `OFF-FR-*` · [`platform.md`](../platform.md)
- Offline Desktop SKU: SRS `ODE-FR-*` · [`offline-desktop.md`](../offline-desktop.md)
