#!/usr/bin/env node
/**
 * @rtrvr-ai/rover-mcp
 *
 * MCP server wrapping the Rover Agent Task Protocol (ATP).
 * Designed for use as an antigravity IDE sub-browser agent tool provider.
 *
 * Transport: stdio (default for IDE / agent integrations)
 *
 * Tools exposed:
 *   rover_discover       – Check whether a URL is Rover-enabled
 *   rover_create_task    – Launch a Rover task (prompt or shortcut)
 *   rover_get_task       – Poll / read a task's current state
 *   rover_stream_task    – Stream NDJSON events until the task is terminal
 *   rover_continue_task  – Supply input when a task is in input_required
 *   rover_cancel_task    – Cancel a running task
 *   rover_create_handoff – Delegate the current task to another Rover site
 *   rover_get_workflow   – Read aggregated workflow state
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATP_BASE = "https://agent.rtrvr.ai";
const TASKS_URL = `${ATP_BASE}/v1/tasks`;
const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "expired",
]);
const DEFAULT_POLL_INTERVAL_MS = 1500;
const MAX_STREAM_EVENTS = 500; // guard against infinite loops

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; body: JsonValue }> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(options.headers ?? {}),
    },
  });

  let body: JsonValue;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    body = (await res.json()) as JsonValue;
  } else {
    body = await res.text();
  }

  return { ok: res.ok, status: res.status, body };
}

function toText(body: JsonValue): string {
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

function errorText(status: number, body: JsonValue): string {
  return `HTTP ${status}: ${toText(body)}`;
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "rover-mcp",
  version: "3.0.0",
});

// ---------------------------------------------------------------------------
// Tool: rover_discover
// ---------------------------------------------------------------------------

server.tool(
  "rover_discover",
  "Fetch a page's HTML and check whether it contains the Rover discovery marker (<script type=\"application/agent+json\">). Returns the task endpoint URL if found.",
  {
    url: z
      .string()
      .url()
      .describe("The URL of the page to inspect for Rover support."),
  },
  async ({ url }) => {
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { accept: "text/html,application/xhtml+xml,*/*" },
        signal: AbortSignal.timeout(10_000),
      });
      html = await res.text();
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch ${url}: ${String(err)}`,
          },
        ],
        isError: true,
      };
    }

    // Match <script type="application/agent+json">…</script>
    const match = html.match(
      /<script[^>]+type=["']application\/agent\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );

    if (!match) {
      return {
        content: [
          {
            type: "text",
            text: `No Rover discovery marker found on ${url}. The site may not be Rover-enabled, or the marker may be injected dynamically.`,
          },
        ],
      };
    }

    let marker: JsonValue = null;
    try {
      marker = JSON.parse(match[1].trim()) as JsonValue;
    } catch {
      // non-JSON marker — still Rover-enabled
    }

    const taskEndpoint =
      marker !== null &&
      typeof marker === "object" &&
      !Array.isArray(marker) &&
      typeof (marker as Record<string, JsonValue>)["task"] === "string"
        ? (marker as Record<string, JsonValue>)["task"]
        : TASKS_URL;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              roverEnabled: true,
              taskEndpoint,
              marker,
              checkedUrl: url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_create_task
// ---------------------------------------------------------------------------

server.tool(
  "rover_create_task",
  "Create a new Rover task on a Rover-enabled website. Supply either a natural-language prompt or a shortcut ID. Returns the canonical task URL, optional workflow URL, and browser open links.",
  {
    url: z
      .string()
      .url()
      .describe("The target Rover-enabled website URL (e.g. https://example.com)."),
    prompt: z
      .string()
      .optional()
      .describe(
        "Natural-language instruction for the agent (e.g. 'get me the latest blog post'). Provide either prompt or shortcut, not both."
      ),
    shortcut: z
      .string()
      .optional()
      .describe(
        "Pre-defined shortcut ID configured by the site owner. Provide either prompt or shortcut, not both."
      ),
    execution: z
      .enum(["auto", "browser", "cloud"])
      .default("auto")
      .describe(
        "Execution preference. 'cloud' for guaranteed browserless execution; 'browser' for browser-attach only; 'auto' (default) tries browser first."
      ),
    wait: z
      .number()
      .int()
      .min(1)
      .max(60)
      .optional()
      .describe(
        "If set, wait up to this many seconds for a terminal result before returning. On success returns the final task payload directly."
      ),
  },
  async ({ url, prompt, shortcut, execution, wait }) => {
    if (!prompt && !shortcut) {
      return {
        content: [
          {
            type: "text",
            text: "You must provide either 'prompt' or 'shortcut'.",
          },
        ],
        isError: true,
      };
    }

    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };

    const prefer: string[] = [];
    if (execution !== "auto") prefer.push(`execution=${execution}`);
    if (wait !== undefined) prefer.push(`wait=${wait}`);
    if (prefer.length > 0) headers["prefer"] = prefer.join(", ");

    const body = prompt ? { url, prompt } : { url, shortcut };

    const result = await apiFetch(TASKS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_get_task
// ---------------------------------------------------------------------------

server.tool(
  "rover_get_task",
  "Fetch the current state of a Rover task (status, result, any input request). Poll this until status is one of: completed, failed, cancelled, expired.",
  {
    taskUrl: z
      .string()
      .url()
      .describe(
        "The canonical task URL returned by rover_create_task (e.g. https://agent.rtrvr.ai/v1/tasks/agt_123?access=...)."
      ),
  },
  async ({ taskUrl }) => {
    const result = await apiFetch(taskUrl);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_stream_task
// ---------------------------------------------------------------------------

server.tool(
  "rover_stream_task",
  "Stream NDJSON events from a Rover task until it reaches a terminal state (completed / failed / cancelled / expired). Returns all collected events as a JSON array. Use for real-time step visibility or to await a final result without manual polling.",
  {
    taskUrl: z
      .string()
      .url()
      .describe("The canonical task URL returned by rover_create_task."),
    pollIntervalMs: z
      .number()
      .int()
      .min(500)
      .max(10_000)
      .default(DEFAULT_POLL_INTERVAL_MS)
      .describe(
        "Milliseconds between poll attempts when NDJSON streaming is not available. Defaults to 1500."
      ),
    timeoutMs: z
      .number()
      .int()
      .min(5_000)
      .max(300_000)
      .default(120_000)
      .describe(
        "Hard timeout in milliseconds before giving up (default 120 000 ms / 2 min)."
      ),
  },
  async ({ taskUrl, pollIntervalMs, timeoutMs }) => {
    const events: JsonValue[] = [];
    const deadline = Date.now() + timeoutMs;

    try {
      const res = await fetch(taskUrl, {
        headers: {
          accept: "application/x-ndjson",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok || !res.body) {
        // Fall back to polling
        return await pollUntilTerminal(taskUrl, pollIntervalMs, timeoutMs);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let count = 0;

      outer: while (count < MAX_STREAM_EVENTS && Date.now() < deadline) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let parsed: JsonValue;
          try {
            parsed = JSON.parse(trimmed) as JsonValue;
          } catch {
            continue;
          }
          events.push(parsed);
          count++;

          const evType =
            parsed !== null &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
              ? (parsed as Record<string, JsonValue>)["type"]
              : undefined;

          if (evType === "done" || evType === "error") break outer;

          const status =
            parsed !== null &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
              ? (parsed as Record<string, JsonValue>)["status"]
              : undefined;

          if (typeof status === "string" && TERMINAL_STATUSES.has(status)) {
            break outer;
          }
        }
      }
    } catch {
      // Network/timeout — fall back to polling with remaining budget
      const remaining = deadline - Date.now();
      if (remaining > 0) {
        return await pollUntilTerminal(taskUrl, pollIntervalMs, remaining);
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ events }, null, 2),
        },
      ],
    };
  }
);

async function pollUntilTerminal(
  taskUrl: string,
  intervalMs: number,
  timeoutMs: number
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const deadline = Date.now() + timeoutMs;
  const snapshots: JsonValue[] = [];

  while (Date.now() < deadline) {
    const result = await apiFetch(taskUrl);
    if (!result.ok) {
      return {
        content: [
          { type: "text", text: errorText(result.status, result.body) },
        ],
        isError: true,
      };
    }

    snapshots.push(result.body);

    const status =
      result.body !== null &&
      typeof result.body === "object" &&
      !Array.isArray(result.body)
        ? (result.body as Record<string, JsonValue>)["status"]
        : undefined;

    if (typeof status === "string" && TERMINAL_STATUSES.has(status)) {
      break;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(intervalMs, remaining));
  }

  const final = snapshots[snapshots.length - 1] ?? null;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ polled: true, snapshots, final }, null, 2),
      },
    ],
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tool: rover_continue_task
// ---------------------------------------------------------------------------

server.tool(
  "rover_continue_task",
  "Provide user input to a Rover task that has entered the 'input_required' state. The task will resume processing after the input is received.",
  {
    taskUrl: z
      .string()
      .url()
      .describe("The canonical task URL (must be in input_required state)."),
    input: z
      .string()
      .min(1)
      .describe("The continuation input to send to the agent."),
  },
  async ({ taskUrl, input }) => {
    const result = await apiFetch(taskUrl, {
      method: "POST",
      body: JSON.stringify({ input }),
    });

    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_cancel_task
// ---------------------------------------------------------------------------

server.tool(
  "rover_cancel_task",
  "Cancel a running or pending Rover task. The task status will transition to 'cancelled'.",
  {
    taskUrl: z
      .string()
      .url()
      .describe("The canonical task URL to cancel."),
  },
  async ({ taskUrl }) => {
    const result = await apiFetch(taskUrl, { method: "DELETE" });
    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_create_handoff
// ---------------------------------------------------------------------------

server.tool(
  "rover_create_handoff",
  "Delegate the current task to another Rover-enabled site as a cross-site handoff. The child task inherits the parent workflow. The target site must have aiAccess.allowDelegatedHandoffs enabled.",
  {
    taskUrl: z
      .string()
      .url()
      .describe(
        "The canonical URL of the parent task that is creating the handoff (e.g. https://agent.rtrvr.ai/v1/tasks/agt_123?access=...)."
      ),
    url: z
      .string()
      .url()
      .describe("The target Rover-enabled site URL to hand off to."),
    prompt: z
      .string()
      .min(1)
      .describe(
        "High-level instruction for the delegated agent at the target site."
      ),
    instruction: z
      .string()
      .optional()
      .describe(
        "Detailed instruction for the delegated agent (what to do on the target site)."
      ),
    contextSummary: z
      .string()
      .optional()
      .describe(
        "Summary of context from the originating task to share with the delegated agent."
      ),
    expectedOutput: z
      .string()
      .optional()
      .describe("What the delegated agent should return."),
    execution: z
      .enum(["auto", "browser", "cloud"])
      .default("cloud")
      .describe(
        "Execution preference for the child task. Defaults to 'cloud' for headless handoffs."
      ),
  },
  async ({
    taskUrl,
    url,
    prompt,
    instruction,
    contextSummary,
    expectedOutput,
    execution,
  }) => {
    // Derive the handoffs URL from the task URL
    // e.g. https://agent.rtrvr.ai/v1/tasks/agt_123?access=... → .../agt_123/handoffs?access=...
    const taskUrlObj = new URL(taskUrl);
    const handoffsPath = taskUrlObj.pathname.replace(/\/?$/, "/handoffs");
    taskUrlObj.pathname = handoffsPath;
    const handoffsUrl = taskUrlObj.toString();

    const body: Record<string, string> = { url, prompt };
    if (instruction) body["instruction"] = instruction;
    if (contextSummary) body["contextSummary"] = contextSummary;
    if (expectedOutput) body["expectedOutput"] = expectedOutput;

    const result = await apiFetch(handoffsUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        prefer: `execution=${execution}`,
      },
      body: JSON.stringify(body),
    });

    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Tool: rover_get_workflow
// ---------------------------------------------------------------------------

server.tool(
  "rover_get_workflow",
  "Fetch the aggregated state of a Rover workflow, which may include the root task plus any delegated child tasks across multiple sites.",
  {
    workflowUrl: z
      .string()
      .url()
      .describe(
        "The canonical workflow URL returned by rover_create_task (e.g. https://agent.rtrvr.ai/v1/workflows/wrk_123?access=...)."
      ),
  },
  async ({ workflowUrl }) => {
    const result = await apiFetch(workflowUrl);
    if (!result.ok) {
      return {
        content: [{ type: "text", text: errorText(result.status, result.body) }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: toText(result.body) }],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
