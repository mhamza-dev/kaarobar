# Fixtures

| File | Purpose |
|---|---|
| `kaarobar-test-app.kaarobar-backup` | Encrypted demo shop (1 Jan 2025 → today, 5–20 sales/day) for local restore testing |

Regenerate after schema or seed-data changes:

```bash
npm run generate:test-backup
```

Uses the fixed fixture secret `kaarobar-dev-backup-secret` (same as `DEV_BACKUP_SECRET` in `electron/backup/crypto.ts`). Restore tries this secret as a fallback when your env uses `KAAROBAR_LICENSE_SECRET` / `KAAROBAR_BACKUP_SECRET`.
