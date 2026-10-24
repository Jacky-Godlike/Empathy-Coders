# SmartOrder Hub — frontend

React 19 + TypeScript + Vite + Tailwind CSS 4. The frontend talks to the FastAPI
backend through the `/api` proxy configured in `vite.config.ts`.

## Scripts

```bash
npm ci
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit
npm run build    # production bundle in dist/
```

Start the backend on port 8000 first. The Vite dev server proxies `/api` to it.
In production FastAPI serves `dist/` itself.

## Main screens

- **Order Desk** — AI/rules intake, clean order table and risk mix.
- **Inbox** — raw messages from every connected channel.
- **Channel Hub** — WhatsApp, Facebook Messenger, Instagram, Telegram, email and
  TikTok connectors with connection state, sync actions and webhook paths.
- **Orders & purchases** — approved records, purchase drafts and exports.
- **Activity log**, **Catalog & stock**, **Settings**.

## Languages

The UI is translated into English, Simplified Chinese and Bahasa Melayu:

- `src/i18n/translations.ts` — shared base keys;
- `src/i18n/v2Translations.ts` — v2 screen keys and overrides;
- `src/i18n/I18nContext.tsx` — provider, fallback order and persistence;
- `src/components/LanguageSwitcher.tsx` — top-bar selector.

Static UI text is translated. Imported customer messages and backend-generated
analysis/audit text remain in the language in which they were recorded.

## Channel collection

`src/components/ChannelHubView.tsx`, `EmailConnectModal.tsx` and
`src/services/channelsApi.ts` / `emailApi.ts` implement the Channel Hub. The five
social connectors are deterministic demo adapters; the Email connector is a real
read-only IMAP integration. See
[`../docs/CHANNEL-INTEGRATION.md`](../docs/CHANNEL-INTEGRATION.md) for the API,
OAuth/webhook requirements and security notes.

The project-wide architecture, API and demo script are documented in
[`../README.md`](../README.md).
