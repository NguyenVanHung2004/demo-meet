# TEST_PLAN.md — Kế hoạch test cho AI Meeting Notes

> **Tài liệu này tóm tắt:**
> - Tại sao cần test (sau 2 chu kỳ refactor)
> - Stack test được chọn
> - Plan 4 phase
> - Trạng thái Phase T1 + T2 (đã xong)
> - Phase T3 + T4 (chưa làm)
> - 4 bug thật được phát hiện nhờ test

---

## 🎯 Tại sao cần test?

Dự án đã trải qua **2 chu kỳ refactor lớn** được document trong `docs/`:

- `docs/refactor-code/PHASE_3-6.md` — Structure, Type Safety, Performance, Routing
- `docs/ui-redesign/PHASE_0-7.md` — Design System, AppShell, Dashboard Redesign, Auth

Trong quá trình refactor đã fix **9 bug Critical + 14 Major** (xem `docs/refactor-code/REFACTOR_PLAN.md`), bao gồm:

| Mức độ | Ví dụ |
|---|---|
| 🔴 Critical | Mất dữ liệu upload→summarize, XSS trong transcript, SSRF proxy, Email spam relay, File lưu local |
| 🟡 Major | Polling treo vô hạn, race condition reprocess, OAuth thiếu state, webhook không verify |

**Trước Phase T1:** Dự án không có test framework nào. Mọi kiểm thử đều manual qua Vercel preview — rủi ro regression rất cao khi code được chạm vào lần tiếp theo.

**Mục tiêu của plan này:**
1. Khoá lại các bug Critical đã fix, không cho regression
2. Bắt các bug mới phát sinh khi refactor tiếp
3. Cho dev tự tin sửa code mà không sợ vỡ flow cũ

---

## 🛠️ Stack được chọn

| Lựa chọn | Lý do |
|---|---|
| **Vitest** | Setup tốt nhất cho Next.js 16 + ESM, nhanh, mock API dễ, TS native |
| **MSW (Mock Service Worker)** | Mock `fetch` cho API routes test (proxy-file, gemini, email, webhook) |
| **fake-indexeddb** | Hỗ trợ test code dùng IndexedDB (live recording flow) |
| **`vi.useFakeTimers()`** + `vi.advanceTimersByTimeAsync()` | Test PollingManager timeout mà không đợi 30 phút thật |
| **`vi.mock()`** + dynamic `import()` | Mock Firebase, Nodemailer, ffmpeg cho từng test |
| **GitHub Actions** | Chạy trên push `main`, `refactor`, `ui-redesign` + PR; block merge nếu fail |
| **Playwright** (Phase T4) | Modern browser test, auto-wait, trace viewer, faster than Selenium |

### So sánh đã cân nhắc (loại Selenium)

Selenium bị loại vì: tốc độ chậm (WebDriver protocol), setup phức tạp (cần ChromeDriver), auto-wait yếu, network intercept khó. Playwright được chọn vì: tốc độ nhanh hơn 2-3x, tự động cài browser, `page.route()` native cho mock network, auto-wait element, trace viewer mạnh.

---

## 📅 4 Phase

### ✅ Phase T1: Foundation (0.5 ngày) — DONE

```
✓ Cài: vitest, @vitest/ui, happy-dom, @testing-library/react,
       @testing-library/jest-dom, @testing-library/user-event,
       msw, fake-indexeddb, @vitest/coverage-v8
✓ vitest.config.mts (jsdom env, alias @/* → ./*, setupFiles)
✓ tests/setup.ts (MSW server lifecycle, fake-indexeddb)
✓ tests/helpers/ (mock-env, mock-firebase, msw handlers, fixtures)
✓ .github/workflows/test.yml (chạy trên push/PR)
✓ package.json scripts: test, test:watch, test:coverage, test:ui
```

### ✅ Phase T2: 8 file test critical flow (2–3 ngày) — DONE

Đây là phần quan trọng nhất, mapping trực tiếp với 9 bug Critical đã fix trong `REFACTOR_PLAN.md`:

| Test file | Tests | Bug / issue covered | Status |
|---|---|---|---|
| `tests/lib/sanitizeHtml.test.ts` | 14 | 5.5 XSS | ✅ |
| `tests/lib/rate-limit.test.ts` | 7 | 6.2 Rate limit | ✅ |
| `tests/api/proxy-file.test.ts` | 8 | 3.6 SSRF | ✅ |
| `tests/api/email.test.ts` | 10 | 6.1 Auth + 6.2 Rate + 6.3 Bounce + 6.4 Unsubscribe | ✅ |
| `tests/api/webhooks/meetingbaas.test.ts` | 5 | 3.7 HMAC | ✅ |
| `tests/api/gemini.test.ts` | 6 | Retry logic + input validate | ✅ |
| `tests/api/bots/join.test.ts` | 6 | 3.5 Validate URL + rate limit | ✅ |
| `tests/components/PollingManager.test.tsx` | 6 | 1.4 Timeout 30 phút + 1.6 Status flow + 4.4 Skip poll khi không có job | ✅ |
| **Tổng** | **62** | | ✅ |

### ⏳ Phase T3: Test logic thuần (chưa làm, ~2 ngày)

| Test file | Tests | Mô tả | Ưu tiên | Status |
|---|---|---|---|---|
| `tests/lib/parser.test.ts` | 16 | Parse transcript format Python v3, assign speaker colors | Cao | ✅ |
| `tests/lib/utils.test.ts` | 18 | formatTranscriptText edge cases (null, empty, số, ký tự đặc biệt) | Cao | ✅ |
| `tests/lib/constants.test.ts` | 14 | isFinalStatus, isActiveStatus, MEETING_STATUS enum đầy đủ | Trung bình | ✅ |
| `tests/lib/db/meetingDb.test.ts` | 26 | saveMeeting fallback khi > 1MB; strip undefined; pagination cursor | Cao | ✅ |
| `tests/lib/converter.test.ts` | 12 | FFmpeg convert edge cases (mock FFmpeg) | Thấp | ✅ |
| `tests/api/drive/auth.test.ts` | 8 | State param được set cookie; thiếu CLIENT_ID → 500 | Trung bình | ✅ |
| `tests/hooks/useMeetingDetail.test.ts` | 11 | handleShare, handleSummarizeRequest | Trung bình | ✅ |
| **Tổng** | **105** | | | ✅ |

### ⏳ Phase T4: Playwright E2E (optional, ~1–2 ngày)

| Test file | Mô tả |
|---|---|
| `tests/e2e/routes.spec.ts` | Mở trực tiếp `/meeting/[id]`, `/edit/[id]`, `/live` không crash |
| `tests/e2e/auth-redirect.spec.ts` | Chưa login → redirect `/login` |
| `tests/e2e/polling-ui.spec.ts` | Upload → refresh giữa chừng → draft còn nguyên (Phase 1A.1) |

> Cần Firebase Emulator hoặc Firestore test project. Có thể skip nếu chỉ muốn CI đơn giản.

---

## 🐛 Bug thật được phát hiện nhờ test (4 cái)

Khi viết test cho Phase T2, tôi đã phát hiện **4 bug thật** trong code hiện tại. Tất cả đã được fix:

### Bug #1: `sanitizeHtml` không strip self-closing tag
- **File:** `app/lib/sanitizeHtml.ts`
- **Triệu chứng:** `<embed src="evil.swf" />` không bị strip → XSS bypass
- **Fix:** Thêm regex cho self-closing `<embed>`, `<meta>`, `<form>`, `<base>`; thêm filter cho `data:text/html`
- **Test phát hiện:** `tests/lib/sanitizeHtml.test.ts` > "loại bỏ thẻ <embed>"

### Bug #2: Webhook `req.json()` fail vì body đã consumed
- **File:** `app/api/webhooks/meetingbaas/route.ts`
- **Triệu chứng:** `verifySignature` đọc `req.text()` trước → sau đó `req.json()` throw `Body has already been used` → production webhook **không bao giờ nhận được COMPLETED event**
- **Ảnh hưởng:** Nghiêm trọng — toàn bộ MeetingBaas bot integration bị chết
- **Fix:** Đổi sang đọc `req.text()` 1 lần, parse JSON từ rawBody

### Bug #3: HMAC key import sai usage
- **File:** `app/api/webhooks/meetingbaas/route.ts`
- **Triệu chứng:** Import key với `['verify']` rồi dùng `crypto.subtle.sign()` → `InvalidAccessError: Unable to use this key to sign`
- **Ảnh hưởng:** Webhook signature verification throw exception → 500 (bị ăn vào catch chung) hoặc fail tùy env
- **Fix:** Đổi thành `['sign']` vì code này tự compute signature

### Bug #4: Signature comparison vulnerable timing attack
- **File:** `app/api/webhooks/meetingbaas/route.ts`
- **Triệu chứng:** So sánh `signature === expectedHex` dùng string equality → attacker đo thời gian response để đoán từng ký tự
- **Fix:** Constant-time compare với XOR loop

> Nếu không có test, cả 4 bug này sẽ chỉ phát hiện khi user report hoặc khi security audit.

---

## 📊 Coverage (chỉ file có test)

```
File                                          % Stmts  % Branch  % Funcs
─────────────────────────────────────────────────────────────────────
app/api/email/route.ts                          90.19    86.20    100.00
app/api/gemini/route.ts                         90.19    67.44     66.66
app/api/bots/join/route.ts                      81.81    67.85    100.00
app/api/webhooks/meetingbaas/route.ts           63.21    56.60     37.50
app/api/proxy-file/route.ts                     51.92    33.33     75.00
app/lib/converter.ts                            96.15   100.00     66.66
app/lib/parser.ts                               95.65    87.50    100.00
app/lib/db/meetingDb.ts                         85.98    68.75     91.30
app/lib/rate-limit.ts                           80.00    66.66     50.00
app/lib/constants.ts                            81.81     0.00      0.00
app/lib/sanitizeHtml.ts                         66.66   100.00     66.66
─────────────────────────────────────────────────────────────────────
```

Overall: 10.03% (vẫn còn thấp vì toàn bộ `app/components/` (Dashboard, Editor, Live, Meeting...) chưa test — dành cho Phase T4 nếu sau này muốn).

---

## 🚀 Cách chạy

### Local

```bash
npm test                # CI mode (1 lần)
npm run test:watch      # watch mode cho dev
npm run test:coverage   # báo cáo coverage
npm run test:ui         # Vitest UI (mở browser xem chi tiết)
```

### CI (GitHub Actions)

File `.github/workflows/test.yml` chạy trên:
- Push lên branch `main`, `refactor`, `ui-redesign`
- Pull request vào 3 branch trên

```yaml
- npm ci
- npm test
- npm run lint || true  # lint không fail build
```

Coverage report lưu ở `coverage/` (gitignore) khi chạy local.

---

## 📁 Cấu trúc thư mục

```
demo-meet/
├── vitest.config.mts                      ← Config
├── .github/workflows/test.yml             ← CI
├── tests/
│   ├── setup.ts                           ← MSW + fake-indexeddb
│   ├── helpers/
│   │   ├── mock-env.ts                    ← Stub process.env
│   │   ├── mock-firebase.ts               ← Firestore mock factory
│   │   ├── fixtures.ts                    ← mockMeeting, mockSegment, ...
│   │   └── msw/
│   │       ├── handlers.ts                ← MSW handlers
│   │       └── server.ts                  ← MSW server
│   ├── lib/
│   │   ├── sanitizeHtml.test.ts           ← T2.1
│   │   └── rate-limit.test.ts             ← T2.7
│   ├── api/
│   │   ├── proxy-file.test.ts             ← T2.2
│   │   ├── email.test.ts                  ← T2.3
│   │   ├── webhooks/
│   │   │   └── meetingbaas.test.ts        ← T2.4
│   │   ├── gemini.test.ts                 ← T2.5
│   │   └── bots/
│   │       └── join.test.ts               ← T2.6
│   └── components/
│       └── PollingManager.test.tsx        ← T2.8
└── coverage/                              ← gitignored
```

---

## 📌 Convention cho test

### File naming
- Test file đặt cùng tên với file cần test + `.test.ts(x)`
- Vị trí: `tests/<mirror-of-source-path>/<name>.test.ts`
- Có thể dùng alias `@/tests/helpers/fixtures` thay vì relative path

### Cấu trúc 1 test file

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock các module cần thiết (đặt TRƯỚC import production code)
vi.mock("@/app/lib/firebase-admin", () => ({ ... }));

// Import production code SAU mock
import { POST } from "@/app/api/foo/route";

describe("POST /api/foo — mô tả luồng + bug được cover", () => {
  // Setup chung
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FOO = "test-value";
  });

  it("trả 401 khi thiếu token", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });
});
```

### Quy tắc quan trọng

- **Mỗi `expect` nên có message rõ ràng về luồng nghiệp vụ** (không chỉ test "function works")
- **Mock TẤT CẢ external service**: Firebase, Nodemailer, Gemini, FFmpeg, RunPod, Google OAuth
- **Dùng unique IP / unique userId cho mỗi test** tránh share rate-limit state
- **Tạo `Request` mới cho mỗi test** vì body chỉ đọc được 1 lần
- **Cập nhật test ngay khi fix bug** — test phải là tài liệu sống

---

## ❌ Những thứ KHÔNG nên test (tránh over-engineering)

- Component snapshot test (UI thay đổi liên tục qua UI redesign → test vỡ không có giá trị)
- Test Firestore rules (làm manual qua Firebase Console)
- Test FFmpeg conversion thật (chỉ mock)
- Test React hooks ngoài `useMeetingDetail` (quá nhiều mock, ROI thấp)
- Test trên browser thật trừ khi cần (Phase T4 mới làm)

---

## 💰 ROI tổng

| Phase | Effort | Bug đã/đang cover | Status |
|---|---|---|---|
| T1 | 0.5d | — | ✅ Done |
| T2 | 2–3d | 9 critical bug + 4 bug mới phát hiện | ✅ Done |
| T3 | 2d | Bug logic nhỏ, regression | ✅ Done (105 tests) |
| T4 | 1–2d | Routing, UI | ⏳ Optional |

**Hiện tại:** 167 tests đang chạy trong ~10s, cover 9 bug Critical đã fix trong refactor + logic thuần (parser, constants, utils, db, hook).

---

## 🔗 Files liên quan

- `docs/refactor-code/REFACTOR_PLAN.md` — Danh sách 9 bug Critical
- `docs/refactor-code/PHASE_*.md` — Chi tiết từng phase refactor
- `docs/ui-redesign/UI-IMPROVEMENT-PLAN.md` — Danh sách vấn đề UI
- `vitest.config.mts` — Cấu hình test
- `.github/workflows/test.yml` — CI pipeline
- `tests/` — Test source code
