# AGENTS.md — SAM (Sales Assistant Management)

> Generated 2026-07-28. Update as the repo grows.

## What is SAM

An AI-powered **LINE sales assistant management system** with a **hybrid cloud + USB hardware vault** architecture:

- **LINE OMO** — AI conversation takeover, OCR business card scanning, personalized scheduled broadcast, friend CRM scoring
- **Taiwan MoE Router** — PII anonymization, sensitive data classification, intelligent model routing (local small model ↔ cheap CN token API ↔ premium API)
- **USB Hardware Vault** — AES-256 encrypted USB storing all private keys, SeaweedFS document storage, SQLite-vec vector database; cloud has zero data retention

Full spec: [`docs/SAM_System_Specification.md`](docs/SAM_System_Specification.md)

## Architecture summary

```
LINE client → LINE Gateway → MoE Router → LLM Aggregator (CN cheap / official API)
                                    ↕
                             USB Hardware Vault (keys, CRM, SeaweedFS)
```

## Monorepo structure (pnpm workspace)

```
sam/
├── client/         Expo (React Native) — all front-end code
│   ├── app/        Expo Router routing config only (screen names match files)
│   ├── screens/    Actual page implementations (one dir per screen)
│   ├── components/ Shared components (Screen, USBStatusBadge, ScoreBadge, ConfirmDialog)
│   ├── heroui/     HeroUI component library (custom build, do NOT modify)
│   ├── hooks/      Custom hooks (useSafeRouter, etc.)
│   ├── contexts/   React Context (AuthContext)
│   ├── utils/      Utility functions
│   └── assets/     Static assets (images, fonts)
├── server/         Express.js backend
│   └── src/
│       ├── index.ts          Entrypoint
│       ├── data/mock.ts      Mock data (contacts, messages, broadcasts, greeting templates, news)
│       └── routes/           API routes (chats, contacts, broadcasts, workspace)
├── docs/           Specification files
├── .docs/          Working notes, chat transcripts
├── eslint-plugins/ Custom ESLint rules (expo, fontawesome, forbid-emoji, react-native, reanimated)
├── patches/        expo@54.0.33 patch
├── .cozeproj/      Coze scaffold scripts (DO NOT MODIFY)
├── .coze           Coze config (DO NOT MODIFY)
```

## Dev commands

| Command | Where | What |
|---------|-------|------|
| `pnpm -w lint:all` | root | TypeScript check + ESLint for client AND server |
| `pnpm -w lint:client` | root | Lint client only |
| `pnpm -w lint:server` | root | Lint server only |
| `pnpm -w validate` | root | Concurrent lint (client + server) |
| `npm run start` | client/ | `expo start --web --clear` |
| `npx tsx src/index.ts` | server/ | Start mock API server |

## CRITICAL routing convention

- `app/(tabs)/*.tsx` = tab screens. **`app/index.tsx` must NOT exist** when `(tabs)/index.tsx` exists
- `app/*.tsx` = stack/detail screens (chat-detail, friend-detail, broadcast-create, etc.)
- Route files ONLY re-export from `screens/`. Example: `app/chat-detail.tsx` → `export { default } from '@/screens/chat-detail'`
- NEVER put page implementation in `app/` — only in `screens/`

## Styling

- **Uniwind** (TailwindCSS for React Native). Use `className` prop with TW classes
- Neumorphic design style: soft cards with dual shadow, no borders
- Color system defined in `DESIGN.md` (emerald #059669 primary, amber accent, slate text)
- All card containers: `backgroundColor: '#F0F2F5'`, shadow via `shadowColor/shadowOffset/shadowOpacity`

## Import alias

`@/` maps to `client/`. Always use it: `import { Screen } from '@/components/Screen'`

## Dependency management

| Scope | Command |
|-------|---------|
| client | `cd client && npx expo install <pkg>` (preferred) or `pnpm add <pkg>` (fallback) |
| server | `cd server && pnpm add <pkg>` |
| root | `pnpm -w add <pkg>` |

## Mock API

- Server runs independently. `EXPO_PUBLIC_BACKEND_BASE_URL` env var must point to it
- Mock data lives in `server/src/data/mock.ts` (6 contacts, chat messages, 3 broadcasts, 6 greeting templates, 4 news articles)
- Routes: `GET /api/v1/chats`, `GET /api/v1/chats/:id`, `POST /api/v1/chats/:id/messages`, `GET /api/v1/contacts`, `GET /api/v1/contacts/:id`, `GET /api/v1/broadcasts`, `GET /api/v1/workspace/news`, `GET /api/v1/workspace/greetings`, `GET /api/v1/workspace/usb`

## Design system reference

See `DESIGN.md` for complete palette (emerald primary, warm neumorphic, no borders, no white card backgrounds, FontAwesome6 icons).
