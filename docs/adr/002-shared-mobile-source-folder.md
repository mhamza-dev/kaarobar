# ADR 002 — Shared source folder for the mobile clients

- **Status:** Accepted
- **Date:** 2026-08-13
- **Supersedes:** the "no shared code between clients" rule as it applies to the
  two React Native apps only. Web and desktop clients are unaffected.

## Context

`README.md` and `AGENTS.md` state:

> Clients are independently deployable (no shared npm packages). Theme tokens are
> duplicated per app so branding stays consistent without coupling releases.

That rule was written when the two mobile apps were React Native CLI projects
with a modest amount of duplicated code. Migrating both to Expo SDK 57 and
rebuilding them (`staff-mobile`, `consumer-mobile`) meant duplicating roughly 120
files a second time, including:

- `validations/*` — yup schemas encoding **business rules** on money paths
- `rbac.ts` — role and plan gating (`SEC-NFR-001`, `ADM-FR-002`)
- `decimal.ts` — money formatting
- `i18n/*` — seven locale catalogs (`en/ur/de/fr/es/pt-BR/ar`)
- the entire design system and form primitives

Two divergent copies of validation and RBAC logic is a correctness and security
liability, not merely a maintenance cost: a fix applied to one app silently
leaves the other wrong.

## Decision

Introduce `shared/mobile/` as a **source folder**, consumed by both mobile apps
via a `@shared/*` alias. It is deliberately *not* an npm package: no `package.json`,
no version, no publish step, no workspace.

Shared:

| Area | Contents |
|------|----------|
| `theme/` | tokens (light + dark), brand palette derivation, `makeStyles`, theme context |
| `ui/` | glass surfaces, cards, screen scaffold, motion, skeletons, state views, toast |
| `form/` | `CustomForm`, formik fields, switch, date picker, search select |
| `validations/` | all yup schemas |
| `i18n/` | translator + locale catalogs |
| `lib/` | `decimal`, `uuid`, `barcode`, `listingFilters`, `customers` |

Kept per-app:

| Area | Why |
|------|-----|
| `lib/api.ts` | staff and consumer hit genuinely different endpoints (staff vs portal) |
| `theme/theme-provider.tsx` | resolves the business brand colour through *that app's* API client; hands the result to the shared `ThemeValueProvider` |
| `lib/rbac.ts` | still app-side pending a shared `Session` contract — see Consequences |
| `lib/nav.ts`, routes, screens | route trees differ per app |

## Wiring

Each app declares the alias twice, because two different resolvers must agree:

- **Metro** — `metro.config.js` adds `shared/` to `watchFolders` and the app's
  `node_modules` to `resolver.nodeModulesPaths`.
- **TypeScript** — `tsconfig.json` maps `@shared/*` and falls back to
  `./node_modules/*` for bare specifiers.

Two traps worth recording:

1. **Metro reads `paths` from `tsconfig.json`.** Mapping `react` to
   `@types/react` there breaks the bundler, which then tries to import the
   declaration package at runtime. Those type-only mappings live in
   `tsconfig.typecheck.json`, used solely by `npm run typecheck`.
2. **Do not set `resolver.disableHierarchicalLookup`.** It is only correct in a
   hoisted monorepo; here it breaks packages that ship nested dependencies
   (`react-native-reanimated` bundles its own `semver`).

## Consequences

**Gained.** One edit to a validation schema, an RBAC rule, a locale string or a
UI primitive reaches both apps. Money formatting and role gating cannot drift.

**Given up.** The two mobile apps are no longer independently changeable at the
source level — a change to `shared/mobile/` requires re-testing both. They remain
independently *buildable and deployable*: there is no shared artefact, each app
still produces its own bundle, and CI needs no extra install step.

**Branding independence is preserved**, which was the stated reason for the
original rule: brand colour is resolved at runtime from the business
`primary_color`, and each app keeps its own provider, icons and app config.

**Follow-up.** `rbac.ts` should move into `shared/` once `Session` is expressed
as a shared structural type rather than being imported from each app's
`api.ts`. Until then it is duplicated, which is the drift risk this ADR exists
to remove.
