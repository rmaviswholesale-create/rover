# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Rover is a DOM-native embeddable web agent (FSL-1.1-Apache-2.0). It runs in the page, reads the live DOM/a11y tree and executes actions in-browser. RoverBook is the analytics/memory/discussion layer on top of it. The pnpm workspace also contains two Node-side packages (`packages/sdk-node`, `packages/cli`) that are **separate from the browser runtime** — see below.

## Commands

Requires Node 20+ and pnpm 9.12 (`packageManager` is pinned). Note `.npmrc` references `${NPM_TOKEN}`; pnpm prints harmless warnings when it is unset.

```bash
pnpm install
pnpm build                      # pnpm -r build (all packages)
pnpm dev                        # demo app (Vite) at http://localhost:5174
pnpm lint                       # pnpm -r lint (eslint, per package)
pnpm type-check                 # pnpm -r type-check

pnpm --filter <name> build      # one package, e.g. @rtrvr-ai/rover, @rover/worker
pnpm --filter <name> test
node --test packages/sdk/tests/task-kernel.test.mjs   # single test file (build first: tests import dist/)
```

- Tests are plain `node:test` `.mjs` files in each package's `tests/` and import from the built `dist/`, so **run `pnpm build` (or the package's build) before testing** after source changes. Packages with tests: `sdk`, `worker`, `bridge`, `roverbook`, `sdk-node`, `cli`.
- `packages/sdk-node` and `packages/cli` define `test` as `build && node --test tests/*.test.mjs`; their tests mock `fetch` / use a temp `HOME`, no network needed. `cli` depends on `@rtrvr-ai/sdk` for compilation, so build `@rtrvr-ai/sdk` before `@rtrvr-ai/cli` (`pnpm -r build` orders this).
- No ESLint config file exists in the repo root, so `pnpm lint` may not work as the per-package scripts suggest; `pnpm type-check` is the reliable static check.
- Releases are driven by the GitHub "Release & Publish to npm" workflow (see `RELEASE.md`); `node scripts/bump-version.mjs` (`pnpm version:bump`) bumps versions across packages. Pushes to `main` build everything except the demo and open a PR in `rtrvr-ai/rtrvr-cloud-website` with the SDK artifacts (`packages/sdk/scripts/prepare-deploy.mjs`).

## Architecture

Package graph (details in `docs/ARCHITECTURE.md`):

```
@rtrvr-ai/rover (packages/sdk)  → @rover/ui, @rover/bridge, @rover/shared
@rover/bridge → @rover/dom → @rover/a11y-tree, @rover/instrumentation, @rover/shared
@rover/worker → @rover/shared            (bundled into the SDK as dist/worker/rover-worker.js)
@rover/roverbook                          (talks to the Rover instance via requestSigned / public run events)
```

Runtime flow: UI widget (Shadow DOM) → SDK (`init`/`send`/`registerTool`) → MessageChannel RPC (`bridge`) → **Web Worker** running the agent loop (`worker`) → backend `/v2/rover/*` (session/run/tab routers on `agent.rtrvr.ai`; backend lives in separate repos, not here) → tool calls come back through the bridge → `dom` executes them against the page using the `a11y-tree` snapshot.

Things that span multiple files:
- **`packages/sdk/src`** is mostly runtime-state logic (task kernel/state machine/orchestrator, session coordinator across tabs, cross-domain resume, cloud checkpoints, navigation scope/preflight guards, deep links/launch params). Each concern is a small module with a matching `tests/*.test.mjs`.
- **SDK build** is multi-step: `tsc -b` → copy the pre-bundled worker from `@rover/worker/dist/worker.bundle.js` → esbuild bundles `dist/rover.js` and the IIFE `dist/embed.js`. Build `@rover/worker` before `@rtrvr-ai/rover` (pnpm `-r` handles ordering via workspace deps).
- `@rover/shared` has a `postinstall` that runs `tsc -b`, so `pnpm install` compiles it.
- Agent execution safety (scope, navigation, action gates) is documented in `docs/EXECUTION_GUARDRAILS.md` and `docs/SECURITY_MODEL.md`; consult before changing bridge/tool-scope policy.

### Node-side packages (not part of the browser bundle)

- **`packages/sdk-node` → `@rtrvr-ai/sdk`**: Node ≥18 client using native `fetch`. `RoverClient` (`/v1/tasks`, `/v1/scrape`, `/v1/capabilities`, `/v1/doctor` on `agent.rtrvr.ai`; `run()` creates a task and polls, interval via `pollIntervalMs`) and `RoverBookClient` (the `roverbookRouter` cloud-function). Both go through the shared `requestJson()`/`RoverAPIError` in `src/http.ts`. Auth: `RTRVR_API_KEY` or constructor option; overrides `RTRVR_BASE_URL`, `RTRVR_ROVERBOOK_BASE_URL`.
- **`packages/cli` → `@rtrvr-ai/cli`** (`rtrvr` binary, commander): commands `auth`, `run`, `scrape`, `capabilities`, `doctor`, `mcp init --client claude|cursor|generic` (merges `mcpServers.rtrvr` into `~/.claude.json` / `~/.cursor/mcp.json`, preserving other keys), and `book …` (RoverBook notes/posts/score/analytics/experiments). Credentials live in `~/.config/rtrvr/config.json` or `RTRVR_API_KEY`; MCP base URL override is `RTRVR_MCP_BASE_URL`.
- Caveat: the `/v1/*` endpoints these clients call were written against the README's `POST /v1/tasks` description and have not been validated against the live API. The separate upstream repo `rtrvr-ai/rtrvr-cli` has its own, richer CLI/SDK (`@rtrvr-ai/cli`/`@rtrvr-ai/sdk` v0.2.x) — don't assume the two share code.
- These two packages use `tsc -b` with `NodeNext` modules and `types: ["node"]` (they do not extend `@rover/tsconfig`); relative imports need the `.js` extension.

## Conventions

- ESM everywhere (`"type": "module"`); browser packages extend `@rover/tsconfig` / `tsconfig.base.json` (strict, ES2022).
- Contribution flow: branch from `main`, PR against `main`, CI must pass, squash-merge (`CONTRIBUTING.md`).
