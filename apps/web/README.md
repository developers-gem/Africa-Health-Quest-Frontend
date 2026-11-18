# @ahq/web

The Africa Health Quest website: public site, player game, clinician review console and administration console.
React 19 + Vite + TypeScript + Tailwind CSS 4 + shadcn/ui (Radix) + Zustand + TanStack Query + React Router.

```bash
npm run dev -w @ahq/web        # http://localhost:5173 (backend URL from VITE_API_BASE_URL, default :4000)
npm run test:unit -w @ahq/web  # Vitest + Testing Library (API mocked at fetch)
npm run test:e2e -w @ahq/web   # Playwright: real backend + MongoDB, desktop and mobile projects
npm run build -w @ahq/web      # static output in apps/web/dist (each area is a separate chunk)
```

## Areas and routes

| Area      | Routes                                                                                                                                                                                                                                                                                 | Access                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Public    | `/`, `/about`, `/how-to-play`, `/learn`, `/countries[/:code]`, `/status`, `/login`, `/register`, `/check-email`, `/verify-email`, `/forgot-password`, `/reset-password`                                                                                                                | Everyone                       |
| Player    | `/play` (dashboard), `/play/story`, `/play/challenge`, `/play/missions[/:key]`, `/play/attempts/:id` (gameplay, reasoning, result, AI debrief), `/play/commander`, `/play/countries`, `/play/profile`, `/play/achievements`, `/play/history`, `/play/settings`                         | Signed in or guest (one click) |
| Clinician | `/review`, `/review/assignments`, `/review/queue`, `/review/versions/:id` (scenario, treatment, changes, history, decision), `/review/references`, `/review/history`, `/review/missions/:key`, `/review/ai-flags`; `/review/profile` (apply — any registered user)                     | `review:read` + MFA            |
| Admin     | `/admin` (overview), `/admin/users[/:id]`, `/admin/clinicians[/:id]`, `/admin/countries[/:code]`, `/admin/missions[/new\|/:key]`, `/admin/versions/:id` (draft editor), `/admin/publishing`, `/admin/analytics`, `/admin/reports`, `/admin/ai`, `/admin/configuration`, `/admin/audit` | Admin permissions + MFA        |

Route guards only shape the UI; every request is authorised again by the API.

## Structure

- `src/components/ui` — shadcn/ui primitives restyled to the prototype identity (2px outline, offset "pop" shadow,
  rounded cards). Tokens live in `src/styles/index.css` (cream background, deep orange, green, gold, kente strip).
- `src/components/common` — page header, stat cards, pagination, loading/empty/error states (`QueryState`),
  confirmation dialogs with audited reasons, form fields, single-series charts with table views.
- `src/lib/api` — fetch client (in-memory access token, httpOnly refresh cookie, single-flight refresh, MFA error
  handling, `Idempotency-Key` on reward/AI requests) and typed endpoint modules; types are inferred from
  `@ahq/api-contracts`. Forms validate with the same contract schemas.
- `src/lib/step-up.tsx` — sensitive admin actions ask for the password again when the API returns
  `STEP_UP_REQUIRED`, then retry.
- `src/features/*` — one folder per area.

## Rules

- Never import `@ahq/game-content` here (ESLint enforces it) and never put secrets in `VITE_*` variables. Answer
  keys only reach the browser for answered steps (players) or for staff who review and author content.
- E2E runs use their own database, the `file` mail transport (to follow emailed links) and the deterministic
  `fake` AI provider; they never call the Anthropic API. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to reuse a local
  Chromium. `SHOTS_DIR=/some/dir` saves review screenshots from the journey spec.
