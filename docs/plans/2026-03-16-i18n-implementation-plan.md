# I18n Implementation Plan

**Goal:** Add scalable internationalization across frontend and backend contracts using `i18next` and `react-i18next`, with Spanish fallback.

**Architecture:** Centralized i18n resources (`es`, `en`) with global provider, cookie + localStorage persistence, device locale detection, stable backend error/message codes, and frontend-owned rendering of localized user-facing text (including WhatsApp template composition).

**Tech Stack:** Next.js 15 App Router, React 19, i18next, react-i18next, Prisma, MySQL, Vitest, Playwright

---

## 1) Current-State Summary

- UI strings are hardcoded in Spanish across home, booking, cancellation, not-found, and metadata.
- Backend mostly returns stable error codes in `error` fields, but validation messages and WhatsApp template are still Spanish text in backend logic.
- No i18n bootstrap, no language selector, no persistence for language preference.

## 2) Implementation Strategy

### Phase 1: Backend and Contract Migration
- Standardize API errors as stable `errorCode` (keep legacy `error` in transition).
- Map Zod validation failures to stable non-localized codes.
- Replace backend WhatsApp text composition with structured payload for frontend interpolation.

### Phase 2: UI/UX Flow
- Add global i18n provider (`i18next` + `react-i18next`) in app layout.
- Add language selector on initial screen and globally accessible.
- Implement language resolution order: cookie -> localStorage -> device locale -> fallback `es`.
- Move booking/cancel/home/not-found/empty-state texts to translation keys.
- Localize date/month/day formatting by active language while preserving `America/Mexico_City`.

### Phase 3: Tests and Rollout
- Update unit/app/e2e tests that currently assert Spanish literals.
- Add tests for fallback behavior, language persistence, unsupported locale handling, and backend code-to-frontend translation mapping.

### Phase 4: Technical Cleanup
- Remove dead/legacy hardcoded text paths.
- Consolidate shared error code constants.
- Remove backend-owned localized text remnants.

## 3) Documentation Impact

- `docs/specification.md` must be updated.
- Add language resolution behavior and Spanish fallback rule.
- Add backend-to-frontend message-code contract rule.
- Update onboarding/initial screen flow with language selection.
- Update acceptance criteria for localized rendering and persistence.
- Align contradictions in same-day booking rule references.

## 4) Acceptance Criteria

- Spanish and English supported with Spanish fallback guaranteed.
- Language selector available on initial screen and globally.
- User language persists via cookie + localStorage.
- Unsupported device locales safely fallback to Spanish.
- Backend returns stable message codes (not localized final UI text).
- Frontend translates all user-facing messages and composes WhatsApp content.
- `docs/specification.md` aligned with actual flow and contracts.

## 5) Checks

Flow Contract Check:
- UI steps updated: Yes
- API contract updated: Yes
- Validation rules updated: Yes
- Acceptance criteria updated: Yes
- docs/specification.md aligned: Yes

Migration Compatibility Check:
- Schema changes required: No
- Data backfill required: No
- Legacy compatibility required: Yes
- Rollback strategy defined: Yes
- Cleanup phase defined: Yes
- Integrity protections defined: Yes
