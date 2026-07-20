# POS & inventory stock core

Status against KRB-SRS-001 Must items (POS-FR + INV stock core):

| ID | Status | Notes |
|----|--------|-------|
| POS-FR-001 | Done | Cart / line items with server-side branch pricing |
| POS-FR-002 | Done | Tax from product `tax_rate`; cart totals |
| POS-FR-003 | Done | Split tender (`cash` / `card` / `wallet`); sum must match total |
| POS-FR-004 | Done | Atomic stock decrement (`UPDATE … WHERE qty >= n`) |
| POS-FR-005 | Done | Per-branch sequential `INV-######` via `invoice_sequences` |
| POS-FR-006 | Done | Sale list/show APIs; invoice on create response |
| POS-FR-007 | Done | Returns with qty caps + return window (`return_window_days`) |
| POS-FR-008 | Done | Auto-approve vs pending via `refund_auto_approve_limit` |
| POS-FR-009 | Done | Discount capped by `discount_auto_approve_limit` |
| POS-FR-010 | Done | Till open/close with expected cash + `over_short` |
| POS-FR-011 | Done | Required `client_txn_id` UUID; idempotent create |
| INV-FR-001 | Done | Product catalog (existing) + branch prices API |
| INV-FR-002 | Done | `GET /inventory` on-hand listing |
| INV-FR-003 | Done | Stock transfers create + confirm with stock check |
| INV-FR-004 | Done | Purchase orders |
| INV-FR-005 | Done | GRN receive + avg cost; enqueue purchase journal |
| INV-FR-006 | Done | Adjustments with reason allowlist + audit |
| INV-FR-009 | Done | Supplier list/create |

## Product catalog (multi-industry)

Products support retail, restaurant, salon, pharmacy, supermarket, wholesale, and general shops:

| Field | Notes |
|-------|--------|
| `barcode` | Unique per business; `GET /products/by-barcode/:code` |
| `product_kind` | `goods` \| `service` \| `combo` |
| `unit` | pcs/kg/ml/hour/session/… |
| `duration_minutes` | Salon/services |
| `variants` / `modifier_groups` | Size options & add-ons |
| `batches` | Pharmacy FEFO lots |
| `images` | Local `/uploads` or S3-compatible (R2/MinIO) |

### Media storage

| Env | Default |
|-----|---------|
| `STORAGE_BACKEND` | `local` (dev) / `s3` when `S3_BUCKET` set in prod |
| `PUBLIC_BASE_URL` | Base URL for local upload links |
| `S3_BUCKET` | Bucket name |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Credentials |
| `S3_ENDPOINT` | e.g. Cloudflare R2 endpoint |
| `S3_PUBLIC_URL` | CDN/public base for object URLs |
| `S3_REGION` | e.g. `auto` for R2 |

Local files land in `priv/static/uploads` and are served at `/uploads/...`.

### Key APIs

- `GET|POST /products`, `PATCH /products/:id`, `GET /products/by-barcode/:code`
- `POST /products/:id/images`, `DELETE /products/:id/images/:image_id`
- `GET|POST /categories`, `GET|POST /modifier-groups`
- `POST /products/:id/variants`, `GET|POST /products/:id/batches`
- Sales lines accept `variant_id`, `modifier_ids[]`, `notes`
