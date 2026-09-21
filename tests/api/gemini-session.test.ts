import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "@/tests/helpers/fixtures";
import { POST } from "@/app/api/gemini/route";

vi.mock("@/app/lib/rate-limit", () => ({ checkRateLimit: () => ({ allowed: true }) }));
const fetchMock = vi.fn();
const modes = ["segment", "full", "qa", "fill_placeholders", "detect_fill", "extract_json"];
const success = () => new Response(JSON.stringify({ choices: [{ message: { content: "[]" } }] }));
const body = (mode: string, sessionId: unknown = "workflow-123") => ({
  mode, sessionId, text: "Transcript", question: "Question", placeholders: ["NAME"],
});

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("app conversation identity and DeepSeek transport", () => {
  it("reports missing server credentials without calling upstream", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", " ");
    try {
      const res = await POST(makeRequest(body("qa")));
      expect(res.status).toBe(500);
      expect((await res.json()).error).toContain("DEEPSEEK_API_KEY");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it.each([400, 401, 402, 403, 404, 422])("does not retry HTTP %s or expose upstream secrets", async status => {
    fetchMock.mockImplementation(() => new Response("PRIVATE_BODY", { status, statusText: "PRIVATE_STATUS" }));
    const res = await POST(makeRequest(body("qa")));
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await res.json())).not.toContain("PRIVATE_");
  });

  it.each([429, 500, 502, 503, 504])("caps HTTP %s retries at three attempts", async status => {
    fetchMock.mockImplementation(() => new Response("busy", { status }));
    const pending = POST(makeRequest(body("qa")));
    await vi.runAllTimersAsync();
    expect((await pending).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["headers", "body"])("bounds stalled %s to 93 seconds including retries", async stage => {
    fetchMock.mockImplementation((_url, { signal }) => {
      const stalled = () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("PRIVATE_TIMEOUT", "AbortError")), { once: true });
      });
      return stage === "headers" ? stalled() : { ok: true, status: 200, json: stalled };
    });
    const pending = POST(makeRequest(body("qa")));
    await vi.runAllTimersAsync();
    const res = await pending;
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("timed out");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(logs().at(-1).durationMs).toBe(93_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { message: { content: " ", reasoning_content: "PRIVATE_REASONING" } },
    { message: { reasoning_content: "PRIVATE_REASONING" } },
    { message: { content: { invalid: true } } },
    { message: { content: "partial" }, finish_reason: "length" },
  ])("rejects empty, non-string or truncated final output without retries: %j", async choice => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [choice] })));
    const res = await POST(makeRequest(body("qa")));
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await res.json())).not.toMatch(/PRIVATE_|partial/);
  });

  it("uses final content, never reasoning, and preserves object JSON contracts", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: {
      content: '{"NAME":"An"}', reasoning_content: "PRIVATE_REASONING",
    } }] })));
    const res = await POST(makeRequest(body("fill_placeholders")));
    expect(await res.json()).toEqual({ summary: '{"NAME":"An"}' });
  });

  it("sanitizes invalid JSON and does not retry parsing failures", async () => {
    fetchMock.mockResolvedValue(new Response("PRIVATE_INVALID_JSON"));
    const res = await POST(makeRequest(body("qa")));
    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(await res.json())).not.toContain("PRIVATE_");
  });

  it.each([...modes, "default"])("%s uses Flash with thinking disabled without forwarding ID", async mode => {
    fetchMock.mockImplementation(success);
    for (let turn = 0; turn < 2; turn++) {
      expect((await POST(makeRequest(body(mode)))).status).toBe(200);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(url).toBe("https://api.deepseek.com/chat/completions");
      expect(options.headers).not.toHaveProperty("x-opencode-session");
      expect(options.headers.Authorization).toBe("Bearer test-gemini-key");
      expect(options.signal).toBeInstanceOf(AbortSignal);
      const payload = JSON.parse(options.body);
      expect(payload).not.toHaveProperty("sessionId");
      expect(payload.model).toBe("deepseek-flash");
      expect(payload.max_tokens).toBe(16384);
      expect(payload.thinking).toEqual({ type: "disabled" });
      expect(payload.stream).toBe(false);
      expect(payload).not.toHaveProperty("reasoning");
      expect(payload).not.toHaveProperty("response_format");
    }
  });

  it.each(modes)("%s retries transient failures only on Flash", async mode => {
    fetchMock.mockImplementationOnce(() => new Response("busy", { status: 503 }))
      .mockImplementationOnce(() => new Response("busy", { status: 503 }));
    fetchMock.mockImplementationOnce(success);
    const pending = POST(makeRequest(body(mode)));
    await vi.runAllTimersAsync();
    expect((await pending).status).toBe(200);
    expect(fetchMock.mock.calls.map(([, options]) => JSON.parse(options.body).model)).toEqual([
      "deepseek-flash", "deepseek-flash", "deepseek-flash",
    ]);
    expect(fetchMock.mock.calls.every(([, options]) => JSON.parse(options.body).thinking.type === "disabled")).toBe(true);
    expect(logs().at(-1)).toMatchObject({ event: "pipeline_complete", outcome: "success", requestedModel: "deepseek-flash", durationMs: 3000 });
  });

  it("retries transient network errors", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("network"), { code: "ECONNRESET" }))
      .mockImplementationOnce(success);
    const pending = POST(makeRequest(body("qa")));
    await vi.runAllTimersAsync();
    expect((await pending).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, null, "", " ", 123, {}, [], "bad\r\nheader", "bad\n", "bad\r", "has space", "é", "x".repeat(129)])(
    "rejects invalid/missing ID %j without provider calls", async sessionId => {
      const res = await POST(makeRequest({ ...body("qa"), sessionId }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("sessionId");
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it.each(["a", "x".repeat(128), "chat-123_ABC"])("accepts header-safe boundary %s", async sessionId => {
    fetchMock.mockImplementation(success);
    expect((await POST(makeRequest(body("full", sessionId)))).status).toBe(200);
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty("x-opencode-session");
  });
});

const logs = () => vi.mocked(console.info).mock.calls.map(([, metadata]) => metadata);

describe("provider diagnostics", () => {
  it.each([
    { content: undefined, finish: "stop", before: 0, after: 0, hasContent: false },
    { content: "", finish: "stop", before: 0, after: 0, hasContent: true },
    { content: "   ", finish: null, before: 3, after: 0, hasContent: true },
    { content: "<think>PRIVATE_TEXT</think>", finish: "PRIVATE_FINISH", before: 27, after: 0, hasContent: true },
    { content: "PRIVATE_PARTIAL", finish: "length", before: 15, after: 15, hasContent: true },
  ])("logs safe metadata for empty/filtered/truncated output: $finish", async ({ content, finish, before, after, hasContent }) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content, reasoning_content: "PRIVATE_REASONING" }, finish_reason: finish }],
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, secret: "PRIVATE_USAGE" },
    })));
    expect((await POST(makeRequest(body("qa")))).status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logs().find(log => log.event === "body_complete")).toMatchObject({
      finish_reason: finish === "PRIVATE_FINISH" ? "unknown" : finish,
      hasContent, contentLengthBeforeFilter: before, contentLengthAfterFilter: after,
      usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
    });
    expect(JSON.stringify([...logs(), ...vi.mocked(console.error).mock.calls]))
      .not.toMatch(/PRIVATE_|Transcript|Question|test-gemini-key|Bearer/);
  });

  it.each(["qa", "detect_fill", "extract_json"])("%s logs correlated metadata on all dispatch paths", async mode => {
    fetchMock.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
      return {
        ok: true, status: 200,
        json: async () => {
          await new Promise(resolve => setTimeout(resolve, 60));
          return {
            model: "deepseek-flash", choices: [{ message: { content: "[]" } }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20,
              completion_tokens_details: { reasoning_tokens: 3 }, secret: "not-loggable" },
          };
        },
      };
    });
    for (let turn = 0; turn < 2; turn++) {
      const pending = POST(makeRequest(body(mode)));
      await vi.runAllTimersAsync();
      expect((await pending).status).toBe(200);
    }
    const starts = logs().filter(log => log.event === "pipeline_start");
    expect(starts[0].requestId).not.toBe(starts[1].requestId);
    for (const start of starts) {
      expect(start.requestId).not.toBe("workflow-123");
      const events = logs().filter(log => log.requestId === start.requestId);
      expect(events.every(log => log.mode === mode)).toBe(true);
      expect(events.map(log => log.event)).toEqual(["pipeline_start", "attempt_start", "headers", "body_complete", "attempt_success", "pipeline_complete"]);
      expect(events[2]).toMatchObject({ requestedModel: "deepseek-flash", attempt: 1, status: 200, headersMs: 40 });
      expect(events[3].durationMs).toBe(100);
      expect(events[4]).toMatchObject({ returnedModel: "deepseek-flash", usage: {
        prompt_tokens: 12, completion_tokens: 8, total_tokens: 20, reasoning_tokens: 3,
      } });
      expect(events[5]).toMatchObject({ outcome: "success", durationMs: 100 });
    }
    expect(JSON.stringify(logs())).not.toMatch(/Transcript|Question|workflow-123|not-loggable|Bearer/);
  });

  it("logs safe retry reasons, backoff and bounded total failure duration", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("PRIVATE_NETWORK_MESSAGE"), { code: "ECONNRESET" }))
      .mockImplementation(() => new Response("PRIVATE_BODY", { status: 503 }));
    const pending = POST(makeRequest(body("qa")));
    await vi.runAllTimersAsync();
    expect((await pending).status).toBe(500);
    expect(logs().filter(log => log.event === "retry").map(({ reason, backoffMs, status }) => ({ reason, backoffMs, status }))).toEqual([
      { reason: "network", backoffMs: 1000 }, { reason: "http", backoffMs: 2000, status: 503 },
    ]);
    expect(logs().filter(log => log.event === "fallback")).toEqual([]);
    expect(logs().at(-1)).toMatchObject({ event: "pipeline_complete", outcome: "failure", durationMs: 3000 });
    expect(new Set(logs().map(log => log.requestId)).size).toBe(1);
    expect(JSON.stringify([...logs(), ...vi.mocked(console.error).mock.calls])).not.toMatch(/PRIVATE_|Transcript|Bearer/);
  });

  it("omits missing/non-string model and unsafe token usage", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      model: { secret: "hidden" }, choices: [{ message: { content: "[]" } }],
      usage: { prompt_tokens: "12", completion_tokens: -1, total_tokens: 1.5, reasoning_tokens: 0 },
    })));
    await POST(makeRequest(body("qa")));
    const result = logs().find(log => log.event === "attempt_success");
    expect(result).not.toHaveProperty("returnedModel");
    expect(result.usage).toEqual({ reasoning_tokens: 0 });
  });
});
