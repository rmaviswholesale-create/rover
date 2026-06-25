# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Setup
pnpm install
pnpm build          # Build all packages (tsc + esbuild bundle)

# Development
pnpm dev            # Start demo app at http://localhost:5174

# Quality
pnpm lint           # ESLint across all packages
pnpm type-check     # TypeScript type check (no emit)

# Tests (per-package)
node --test tests/**/*.test.mjs

# Versioning
pnpm version:bump 1.2.3   # Update version in all package.json files
```

**Requirements:** Node.js 20+, pnpm 9.12+

## Architecture

Rover is a DOM-native web agent SDK. The browser runtime uses a strict layered design:

```
User Input → @rover/ui (Shadow DOM widget)
           → @rover/sdk (boot/init/send/registerTool)
           → MessageChannel RPC (@rover/bridge)
           → Web Worker (@rover/worker — agent loop)
           → Backend https://agent.rtrvr.ai/v2/rover/*
           → Gemini LLM
           → Tool execution via Bridge → DOM actions (@rover/dom)
```

### Package Graph

```
@rtrvr-ai/rover / @rover/sdk
  ├── @rover/ui
  ├── @rover/bridge
  │   ├── @rover/dom
  │   │   ├── @rover/a11y-tree
  │   │   ├── @rover/instrumentation
  │   │   └── @rover/shared
  │   ├── @rover/instrumentation
  │   ├── @rover/a11y-tree
  │   └── @rover/shared
  └── @rover/shared

@rover/worker          (Web Worker side — no main-thread dependencies)
  └── @rover/shared

@rover/roverbook       (analytics, memory, reviews — integrates via public SDK events)
```

### Package Responsibilities

| Package | Role |
|---|---|
| `sdk` | Browser entry point; boots Worker + Bridge + UI; public API (`init`, `send`, `registerTool`) |
| `worker` | Web Worker running the agent loop and backend command orchestration |
| `bridge` | MessageChannel RPC server on the main thread; owns DOM snapshots and tool execution dispatch |
| `dom` | DOM capture (a11y-tree snapshots) and in-page tool execution (click, type, scroll, etc.) |
| `a11y-tree` | Accessibility tree generation — converts live DOM to model-friendly semantic tree |
| `instrumentation` | Event listener capture and closed-shadow-root signal providers for the snapshot layer |
| `ui` | Shadow DOM chat widget (launcher button + panel); isolated from host page styles |
| `shared` | Types, constants, Gemini SDK client, system tool definitions |
| `roverbook` | Visit/run/event tracking, memory injection, reviews, interviews, signed RoverBook writes |

### Build Outputs

The SDK build runs `tsc → copy-worker → esbuild`:

```
packages/sdk/dist/
├── index.js           — Unbundled (for Vite/webpack consumers)
├── index.d.ts         — TypeScript declarations
├── rover.js           — Standalone bundled SDK (CDN / <script> tag)
├── embed.js           — Queue-based embed loader
└── worker/
    ├── rover-worker.js — Bundled worker (npm export @rtrvr-ai/rover/worker)
    └── worker.js       — Unbundled worker
```

Use `rover.js` + `worker/rover-worker.js` for standalone/CDN usage. Use `index.js` + `worker/worker.js` for bundler (Vite, webpack, Next.js) consumers.

## Key Design Decisions

- **Web Worker isolation** — the agent loop runs entirely off the main thread via MessageChannel RPC. `@rover/worker` has no direct main-thread imports by design.
- **Shadow DOM encapsulation** — `@rover/ui` renders inside a closed Shadow DOM attached to `<html>` (`#rover-widget-root`), so host page styles never affect the widget.
- **Accessibility-first targeting** — DOM actions reference semantic tree labels, not CSS selectors, making them resilient to markup changes.
- **Server-authoritative runtime** — session/run/task state is resolved on `rtrvr-cloud-backend`, not inferred from the browser. The browser exchanges a bootstrap site key (`pk_site_*`) for a short-lived session token (`rvrsess_*`).
- **Separated owner/runtime auth** — Owners manage settings via Firebase auth; embeds write analytics using Rover session token claims. These two auth planes must stay separate.

## Demo App for Manual Testing

Edit `apps/demo/src/main.ts` to supply a valid `publicKey` (`pk_site_...`) and optionally override `apiBase` (defaults to `https://agent.rtrvr.ai`). The demo requires a real site key to mint a session token; without it, Rover emits `auth_required`.

For a fully local stack, run the Firebase emulator from `rtrvr-cloud-backend` and set `apiBase: 'http://127.0.0.1:5002/rtrvr-extension-functions/us-central1'`.

## Release

Prefer the GitHub Actions workflow ("Release & Publish to npm" → Run workflow → enter version). For local releases: create a `release/vX.Y.Z` branch, run `pnpm version:bump X.Y.Z`, commit, push, and push a matching `vX.Y.Z` tag to trigger the publish CI job.

Only `@rtrvr-ai/rover` (packages/sdk) is published to npm. All other packages are workspace-internal.
