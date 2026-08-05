import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeRequest } from "@/tests/helpers/fixtures";

vi.mock("@/app/lib/rate-limit", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/rate-limit")>(
    "@/app/lib/rate-limit"
  );
  return { ...actual };
});

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  process.env.OPEN_CODE_GO_API_KEY = "test-gemini-key";
});

describe("POST /api/gemini — retry + validate (bug unknown, test logic mới)", () => {
  let POST: typeof import("@/app/api/gemini/route").POST;

  beforeEach(async () => {
    POST = (await import("@/app/api/gemini/route")).POST;
  });

  it("trả 400 khi thiếu text", async () => {
    const req = makeRequest({ mode: "default" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("text");
  });

  it("retry 3 lần khi API trả 500, sau đó fail", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "Server down",
    });

    const req = makeRequest({ text: "Test transcript", mode: "default" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("retry thành công khi API fail 1 lần rồi OK", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: async () => "fail",
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Summary OK" } }] }),
      });

    const req = makeRequest({ text: "Test transcript", mode: "default" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = await res.json();
    expect(body.summary).toBe("Summary OK");
  });

  it("gọi API với model và max_tokens đúng", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "x" } }] }),
    });

    const req = makeRequest({ text: "T", mode: "default" });
    await POST(req);

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.model).toBe("mimo-v2.5");
    expect(body.max_tokens).toBe(16384);
    const headers = opts.headers;
    expect(headers.Authorization).toBe("Bearer test-gemini-key");
  });

  it("prompt chứa rule bắt buộc giữ bảng markdown trong template", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    const req = makeRequest({
      text: "T",
      mode: "default",
      templateStructure: "| STT | Hạng mục |\n|---|---|\n| 1 | Fix bug |",
    });
    await POST(req);

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    const prompt: string = body.messages[0].content;
    expect(prompt).toContain("BẮT BUỘC xuất bảng");
    expect(prompt).toContain("KHÔNG được thay bằng bullet");
    expect(prompt).toContain("| STT | Hạng mục |");
  });

  it("prompt chứa rule chống contamination ngôn ngữ (chỉ tiếng Việt)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    const req = makeRequest({ text: "T", mode: "default" });
    await POST(req);

    const [, opts] = fetchMock.mock.calls[0];
    const body = JSON.parse(opts.body);
    const prompt: string = body.messages[0].content;
    expect(prompt).toContain("CHỈ sử dụng tiếng Việt");
    expect(prompt).toContain("TUYỆT ĐỐI KHÔNG trộn từ ngữ tiếng Trung");
  });

  it("mode extract_json: trả về cleaned JSON (strip markdown code fences)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '```json\n[{"task":"X","assignee":"An","deadline":"Chưa rõ"}]\n```',
            },
          },
        ],
      }),
    });

    const req = makeRequest({
      text: "An sẽ làm X",
      mode: "extract_json",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toContain("[{");
    expect(body.summary).not.toContain("```");
  });

  it("trả 429 khi rate limit vượt (20 req / 60s)", async () => {
    const makeReq = () =>
      makeRequest({ text: "x", mode: "default" }, { ip: "88.88.88.88" });

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });

    for (let i = 0; i < 20; i++) {
      const res = await POST(makeReq());
      expect(res.status).not.toBe(429);
    }
    const blocked = await POST(makeReq());
    expect(blocked.status).toBe(429);
  });
});
