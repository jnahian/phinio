# @phinio/mobile

Phinio mobile shell — Expo Router app targeting iOS 26 (Liquid Glass) and Android.

## Run (Phase 3A scaffold)

```bash
# from repo root
pnpm install
pnpm --filter @phinio/mobile dev
```

This starts the Expo dev server. Install a dev client on your device (see
`eas.json` → `development` profile) and scan the QR. The hello-world screen
should read "Phinio Mobile — Phase 3A".

Copy `.env.example` to `.env` and replace `<mac-lan-ip>` with the LAN IP
of the machine running `pnpm --filter @phinio/web dev` (port 3000) so the
device can reach the Better Auth origin.

## Scope

Phase 3A: scaffold + workspace integration + Metro monorepo config + EAS
profiles. No providers, glass primitives, or auth yet — those land in
Phases 3B / 3C / 3D respectively.
