# Client Cache Standards

Applied standards for TanStack Query clients:

- `staleTime`: `45s`
- `gcTime`: `10m`
- query retry: `1`
- mutation retry: `1`
- `networkMode`: `offlineFirst` for queries and mutations
- `refetchOnReconnect`: `true`

## App coverage

- `kaarobar-web/lib/queryClient.ts`
- `kaarobar-desktop/renderer/src/lib/queryClient.ts`
- `kaarobar-mobile/src/lib/queryClient.ts`
- `kaarobar-customer/src/lib/queryClient.ts`

`kaarobar-desktop-offline` remains functionally untouched as requested; no cache-library changes were introduced there.
