# `@rtrvr-ai/rover-mcp`

MCP server that wraps the [Rover Agent Task Protocol (ATP)](../../SKILLS.md) for use as an antigravity IDE sub-browser agent tool provider.

Connect any MCP-capable host (Claude Code, Cursor, VS Code Copilot, custom agents) to Rover-enabled websites with zero auth setup.

---

## Tools

| Tool | Description |
|------|-------------|
| `rover_discover` | Fetch a page and check for the Rover `application/agent+json` discovery marker |
| `rover_create_task` | Launch a task on a Rover-enabled site (prompt or shortcut) |
| `rover_get_task` | Poll a task's current status and result |
| `rover_stream_task` | Stream NDJSON events until a task reaches a terminal state |
| `rover_continue_task` | Provide input when a task enters `input_required` |
| `rover_cancel_task` | Cancel a running or pending task |
| `rover_create_handoff` | Delegate the current task to another Rover-enabled site (cross-site workflow) |
| `rover_get_workflow` | Read aggregated state of a root + delegated child task workflow |

---

## Quick start

### Install and build

```bash
pnpm install
pnpm build
```

### Run (stdio)

```bash
node dist/index.js
```

### Use in Claude Code (`claude_desktop_config.json` / `settings.json`)

```json
{
  "mcpServers": {
    "rover": {
      "command": "node",
      "args": ["/path/to/rover/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### Use in Cursor / VS Code

Add under `mcp > servers` in your workspace or user settings:

```json
{
  "mcp": {
    "servers": {
      "rover": {
        "command": "node",
        "args": ["/path/to/rover/packages/mcp-server/dist/index.js"]
      }
    }
  }
}
```

---

## Minimal agent workflow

```
1. rover_discover { url }           → check site is Rover-enabled
2. rover_create_task { url, prompt} → returns { task, workflow, open, … }
3. rover_stream_task { taskUrl }    → streams events, returns terminal result
   — OR —
   loop rover_get_task { taskUrl }  until status is terminal
4. if status == "input_required":
     rover_continue_task { taskUrl, input }
5. rover_create_handoff { taskUrl, url, prompt }   (optional cross-site)
6. rover_get_workflow { workflowUrl }               (optional aggregation)
```

---

## Execution modes

Pass `execution` to `rover_create_task`:

| Value | Behaviour |
|-------|-----------|
| `auto` (default) | Browser-attach first; cloud fallback planned |
| `browser` | Force browser attach only |
| `cloud` | Guaranteed browserless / headless execution |

---

## Event types (stream)

`ready` · `status` · `step` · `tool` · `message` · `observation` · `input` · `done` · `error`

Terminal events: `done`, `error`, or any payload with `status` in `{completed, failed, cancelled, expired}`.

---

## License

FSL-1.1-Apache-2.0 — see [LICENSE](../../LICENSE).
