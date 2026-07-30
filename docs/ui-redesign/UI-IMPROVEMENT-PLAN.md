# KẾ HOẠCH CẢI THIỆN UI TOÀN DIỆN

> **Dự án**: Smart Meeting Assistant (Next.js 16 + Tailwind 4 + TypeScript)
> **Phạm vi**: Toàn bộ ứng dụng
> **Palette**: Giữ nguyên **indigo + slate**
> **Dark mode**: Chưa triển khai (tập trung light mode)
> **Ngày tạo**: 2026-07-30

---

## 📋 Tổng quan codebase hiện tại

| Khu vực | Vấn đề chính |
|---|---|
| `app/(dashboard)/layout.tsx` (Sidebar) | Màu tối (`bg-slate-900`) đứt gãy với content sáng, dùng inline style |
| `app/components/Dashboard/*` | Card "Tải file" / "Ghi âm" dùng border-dashed trông "demo", buttons rời rạc |
| `app/components/MeetingListView.tsx` | Có 2 phiên bản table (md) + card (mobile) lặp lại logic; hover action trên row khó bấm |
| `app/components/MeetingDetailState.tsx` | 904 dòng, lẫn logic + UI, dùng `prose` Tailwind + raw `dangerouslySetInnerHTML` |
| `app/components/EditorState.tsx` | 643 dòng, audio player bị duplicate với `Editor/AudioPlayer.tsx` |
| `app/components/TranscriptRow.tsx` | 302 dòng, dùng `dangerouslySetInnerHTML` raw HTML escape, button `group-hover` khó dùng trên mobile |
| `app/components/TemplateManagerModal.tsx`, `BotJoinModal.tsx`, `DriveImportModal.tsx` | 3 modal dùng 3 phong cách khác nhau (gradient, flat, ring) |
| `app/components/Dashboard/Sidebar.tsx` | **Được tạo nhưng KHÔNG ĐƯỢC SỬ DỤNG** (DashboardState có inline tab riêng) |
| `app/components/ui/*` | Chỉ có 4 component: Button, Badge, Card, LoadingSkeleton — hầu hết page KHÔNG dùng |
| `app/globals.css` | Chỉ 154 dòng, toàn bộ custom cho tour driver, không có design token |
| `app/(dashboard)/page.tsx` | Dùng 2 hệ tab song song (inline + đáng lẽ có trong Sidebar) |

---

## 🎨 PHASE 0 — Design System Foundation

> **Đây là nền tảng, các phase sau phụ thuộc vào đây.**

### 0.1. Khai báo Design Tokens trong `app/globals.css`

Thay vì hardcode `indigo-600`, `slate-50`, etc. trong từng component → dùng **CSS variables** với `@theme` của Tailwind 4:

- **Brand**: `--color-primary-50…900` (indigo)
- **Neutral**: `--color-surface`, `--color-surface-muted`, `--color-border`, `--color-foreground`, `--color-foreground-muted`
- **Semantic**: `--color-success`, `--color-warning`, `--color-danger`, `--color-info`
- **Spacing scale**: thống nhất 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- **Radius**: `--radius-sm/md/lg/xl/2xl` (8 / 12 / 16 / 20 / 24 px)
- **Shadow**: `--shadow-card`, `--shadow-popover`, `--shadow-modal` (giảm bớt, dùng 1 hệ)
- **Typography**: scale `xs/sm/base/lg/xl/2xl/3xl` với line-height mặc định
- **Z-index scale**: `--z-base/dropdown/sticky/fixed/modal/popover/toast`

**Kết quả**: 1 chỗ thay đổi → cả app cập nhật theo.

### 0.2. Mở rộng Component Library `app/components/ui/`

Hiện tại chỉ có 4 component. Cần thêm:

- `Input.tsx` — label, hint, error state
- `Modal.tsx` — wrapper thống nhất, không mỗi modal tự code
- `Select.tsx` — dùng chung cho tất cả dropdown ngôn ngữ
- `Tabs.tsx` — thay cho inline tab buttons
- `Tooltip.tsx`
- `Toast.tsx` — chuyển logic từ `GlobalUIProvider` ra đây
- `EmptyState.tsx` — icon + title + description + CTA (gộp từ 4 chỗ lặp lại)
- `StatCard.tsx` — cho dashboard metrics
- `Avatar.tsx` — cho speakers, members
- `PageHeader.tsx` — gộp pattern Header có title + actions
- `Dropdown.tsx` — cho menu export, speaker picker, etc.
- `ProgressBar.tsx`
- `SegmentedControl.tsx` — cho toggle trạng thái
- `ConfirmDialog.tsx` — UI chuẩn cho confirm flow
- `Spinner.tsx` + `FullPageLoader.tsx` — thay thế `<Loader2>` lẻ tẻ
- `MarkdownContent.tsx` — render markdown an toàn (thay thế `prose prose-sm`)

### 0.3. Tạo `app/lib/cn.ts`

Utility gộp `clsx` + `tailwind-merge` để tránh conflict class khi extend component.

### 0.4. Cài thêm dev dependencies

- `clsx`
- `tailwind-merge`
- `class-variance-authority` — cho variants

Không thêm UI lib nặng (Radix chỉ thêm khi cần Dropdown/Tooltip phức tạp ở phase sau).

---

## 🏗 PHASE 1 — Layout Shell (Sidebar + Topbar thống nhất)

> Fix vấn đề layout đứt gãy giữa dark sidebar và light content.

### 1.1. Thiết kế AppShell mới (`app/components/AppShell.tsx`)

**Layout 2 cột**: Sidebar trái (rộng 260px, **light surface** — KHÔNG dùng slate-900 nữa) + Main content.

**Sidebar light style**:

- Background trắng / xám rất nhạt, border phải 1px
- Logo "Smart Meeting" ở top + search box dưới
- Nav group: "Quản lý" (Dashboard, Minutes, Tasks) / "Hệ thống" (Team, Training)
- Active state dùng `bg-primary-50` + `text-primary-700` thay vì `bg-indigo-600 text-white` (gây nặng mắt)
- Trạng thái collapsed/expanded lưu `localStorage`
- Nút "Thu gọn" → chỉ hiện icon (cho người dùng thích gọn)

**Topbar mới** (`app/components/Topbar.tsx`):

- Breadcrumb tự động (dùng route) — thay cho `Breadcrumb` component đang tự truyền items
- Search global (Cmd+K) — placeholder, có thể wire sau
- Notification bell
- User avatar + dropdown (Profile, Settings, Logout)

**Mobile**: Sidebar ẩn → drawer trượt từ trái (dùng `useState` + transition).

### 1.2. Refactor `app/(dashboard)/layout.tsx`

- Xóa hardcoded sidebar → dùng `<AppShell>`
- Xóa `PollingManager` ra khỏi main, đặt trong AppShell

### 1.3. Xóa dead code

- **Xóa `app/components/Dashboard/Sidebar.tsx`** (không dùng)
- Gộp inline tabs `Tất cả / Thùng rác` từ `DashboardState.tsx` → chuyển thành 2 route hoặc query param `?tab=all|trash` để Sidebar quản lý

---

## 📊 PHASE 2 — Dashboard Redesign

### 2.1. `Dashboard/Header.tsx` → dùng `PageHeader`

- Title lớn, subtitle mô tả, action group bên phải (Import Drive, Mời Bot, Ghi âm mới)
- Mobile: action nhóm thu gọn vào dropdown `⋯`

### 2.2. `Dashboard/StatsCards.tsx` → redesign

- Bỏ 2 card dashed (trông "đang chờ upload" thay vì "hành động chính")
- Thay bằng:
  - **1 Hero card** gradient (indigo-50 → white) nổi bật, có 2 CTA: "Tải file lên" / "Bắt đầu ghi âm". Có stepper nhỏ "Bước 1/3"
  - **4 Stat card** dạng KPI: Tổng cuộc họp, Tổng thời lượng, Đang xử lý, Thùng rác — mỗi card có icon, label, value, mini-trend (tăng/giảm)
- Dùng `<StatCard>` từ ui library

### 2.3. `Dashboard/MeetingListView.tsx` → redesign

- Bỏ 2 phiên bản (table + card) song song phức tạp
- **Dùng 1 component Card-based** hiển thị tốt cả desktop + mobile (responsive với `grid-cols-1 lg:grid-cols-2`)
- Mỗi card có:
  - Avatar (chữ cái đầu hoặc icon status)
  - Title (1 dòng, truncate), subtitle (date + duration)
  - Status badge
  - Action bar LUÔN HIỂN THỊ (đừng ẩn sau hover — khó bấm trên touch)
  - Click toàn card → mở meeting
- Filter bar phía trên: Tabs "Tất cả / Thùng rác" + search + sort dropdown + filter theo status
- Bulk action bar nổi (đã có pattern trong `MinutesState` → rút ra thành `<BulkActionBar>`)

### 2.4. `Dashboard/UploadModal.tsx` & `LiveSetupModal.tsx`

- 2 modal gần giống nhau 90% → **gộp thành `<RecordSetupModal mode="upload|live">`**
- Dùng `<Modal>` từ ui library thay vì code tay
- Dùng `<Input>`, `<Select>` từ ui library
- Bố cục: 2 cột (metadata trái, options phải) trên desktop; 1 cột mobile

### 2.5. `BotJoinModal.tsx` & `DriveImportModal.tsx`

- Cùng chuẩn hóa với `<Modal>`, header có icon + title, body scrollable, footer cố định
- Bỏ gradient header → dùng icon block màu `primary-50`

### 2.6. `app/(dashboard)/page.tsx`

- Bỏ inline upload progress card → dùng `<Toast variant="loading">` hoặc `<ProgressOverlay>`
- Component gọn hơn (tách upload logic ra hook `useUpload`)

---

## 🎬 PHASE 3 — Editor & Meeting Detail Redesign

### 3.1. `Editor/Header.tsx` → redesign

- Topbar compact, dùng `PageHeader` variant "compact"
- Action group: "Mẫu tóm tắt" (dropdown inline thay vì modal), "Tóm tắt lại", "Lưu" (primary)
- Title inline-edit đẹp hơn với hover state rõ ràng

### 3.2. `Editor/SegmentList.tsx` & `TranscriptRow.tsx`

- **Bỏ `dangerouslySetInnerHTML`** → dùng React rendering an toàn
- Card row có:
  - Avatar người nói (màu theo `speaker.color`) — chuyển từ badge text sang avatar tròn
  - Timestamp (clickable → seek)
  - Play button nhỏ (always visible, không hover-only)
  - Text content (click để edit, double-click vào dòng)
  - Action mini-bar: "Sửa / Chèn / Gộp" — visible on focus hoặc mobile long-press
- Word karaoke highlight: dùng `<span>` có `data-` attributes, không inline style từ JSX
- Keyboard shortcuts: hiển thị ở góc phải dưới (popover) — thay vì modal intro to chỉ hiện 1 lần

### 3.3. `Editor/AudioPlayer.tsx` (bị duplicate)

- **Xóa file duplicate logic** trong `EditorState.tsx` (đoạn 535-586) → dùng `<Editor/AudioPlayer>`
- Redesign player:
  - Waveform mini-view (dùng `<canvas>` hoặc lib nhẹ như `wavesurfer.js` — optional)
  - Progress bar dùng `<input type="range">` styled (đã có ở `Meeting/AudioPlayer`)
  - Nhóm control: Play/Pause, Skip 5s, Skip 10s, Speed, Volume
  - Hiển thị "đang nghe đến câu X / Y" ở góc

### 3.4. `Editor/SpeakerSidebar.tsx`

- Width 280px, drag-to-resize (optional, advanced)
- Mỗi speaker: avatar + tên + thời lượng nói (% của tổng meeting)
- Nút "Thêm" ở cuối list, kéo để reorder
- Nút "Xem toàn văn" → mở `<FullTranscriptModal>` toàn màn hình

### 3.5. `MeetingDetailState.tsx` (904 dòng — quá lớn)

**Tách thành nhiều hook + component**:

- `useMeetingDetail.ts` — load, save, share logic
- `useAudioPlayer.ts` — play, seek, rate
- `useExport.ts` — xuất txt/docx/pdf
- Tách UI: `<MeetingHeader>`, `<MeetingTranscript>`, `<MeetingSummaryPanel>`, `<MeetingExportMenu>`

**Mục tiêu**: file `<400 dòng`, mỗi component riêng biệt dễ test.

Bỏ `prose prose-sm` Tailwind (gây style đè khó control) → tự style markdown content bằng `<MarkdownContent>`.

### 3.6. `Meeting/SummaryPanel.tsx`

Redesign card "AI Tóm tắt":

- Header có chip "Tóm tắt tự động" + nút "Tạo lại"
- Body render markdown đẹp, có thể collapse/expand các section dài
- Action "Copy", "Phát biểu thành slide" (nếu có)

Card "Mục tiêu cuộc họp" — gọn hơn, inline edit, có placeholder đẹp.

Card "Metadata" — dạng 2 cột, icon cho mỗi dòng.

### 3.7. `Meeting/Header.tsx`

- Dùng `PageHeader` thống nhất
- Export menu chuyển thành `<Dropdown>` thay vì tự code `showExportMenu`

### 3.8. `Meeting/SpeakerFilter.tsx`

- Pill-style đẹp hơn, có counter `(5)` cho mỗi speaker
- Search input ngay trên filter bar (optional)

---

## 📁 PHASE 4 — Minutes (Kho biên bản)

### 4.1. `Minutes/Header.tsx` → `PageHeader` (đã có pattern)

- Bỏ search bar tách rời → đưa vào trong header, nút bên phải

### 4.2. `Minutes/FolderGrid.tsx`

- Card folder dùng `<EmptyState>` / `<StatCard>` style thống nhất
- Hover: lift + shadow mạnh hơn
- Right-click → context menu (Rename, Delete, Share)

### 4.3. `Minutes/MeetingList.tsx`

- Giống dashboard list, dùng chung `<MeetingCard>` component
- Có preview nội dung summary inline (snippet highlight khi search)

### 4.4. `AIChatModal.tsx`

- Header gradient → dùng surface trung tính, icon block màu primary
- Message bubble đẹp hơn (avatar + name + time)
- Input area có "đính kèm" (cite meeting) — dùng chip hiển thị các meeting đang context

### 4.5. `TemplateManagerModal.tsx`

- Chuẩn hóa với `<Modal>`
- List template dạng card (thay vì list dọc), mỗi card có preview cấu trúc collapse được

---

## 👥 PHASE 5 — Trang phụ (Tasks / Team / Training / Live)

### 5.1. `app/tasks/page.tsx`

534 dòng → tách:

- `useTaskExtraction.ts` (AI extract logic)
- `<TaskList>` component
- `<TaskItem>` component (với editable form)

Badge trạng thái dùng `<Badge>` từ ui lib. Loading state dùng `<MeetingListSkeleton>` đã có.

### 5.2. `app/team/page.tsx`

435 dòng → tách:

- `<MemberFormModal>` (tách từ inline form)
- `<DepartmentTree>` (gộp logic tree render)
- `<MemberCard>`

Modal form dùng `<Modal>` + `<Input>` + `<Select>` chuẩn.

### 5.3. `app/training/page.tsx` (nếu có) — áp design system.

### 5.4. `Live/Controls.tsx`, `Live/StatusBar.tsx`, `Live/TranscriptView.tsx`

- Áp dụng cùng design tokens, card style
- Transcript view: dùng chung `<TranscriptRow>` (đã refactor ở Phase 3)

---

## 🔐 PHASE 6 — Auth & Onboarding polish

### 6.1. `app/components/LoginState.tsx`

Đẹp rồi nhưng cần:

- Thêm testimonial/feature list ở panel phải (desktop)
- Card ngôn ngữ / theme toggle (optional)
- Animation lúc load (skeleton logo)

### 6.2. `app/components/OnboardingTour.tsx`

- Highlight element rõ hơn (ring 3px primary + offset)
- Có nút "Bỏ qua" floating luôn hiển thị
- Mini-tour cho từng trang (Editor, Minutes, Tasks)

---

## ⚙️ PHASE 7 — Micro-interactions & Polish

### 7.1. Loading states

- Tất cả chỗ dùng `<Loader2>` lẻ tẻ → tạo `<Spinner>` + `<FullPageLoader>`
- Skeleton chuẩn cho từng loại list

### 7.2. Empty states

`<EmptyState icon title description action>` — dùng cho:

- Không có meeting
- Không có kết quả search
- Thùng rác trống
- Folder trống

### 7.3. Toast system (`GlobalUIProvider`)

- Hiện đang inline. Refactor: dùng `sonner` hoặc `react-hot-toast` thay vì tự code → stack gọn, animation đẹp
- Có progress bar cho loading toast

### 7.4. Animations

- Page transition: fade-in 150ms khi navigate
- Modal: scale + fade 200ms
- Card hover: lift 2px
- List item: stagger animation khi load (tuỳ chọn)

### 7.5. Keyboard shortcuts

- `Cmd+K`: mở search/command palette
- `Esc`: đóng modal
- `Space`: play/pause audio (khi không focus vào input)
- Hiển thị cheat sheet ở `?` (nút help ở topbar)

### 7.6. Accessibility (a11y)

- Tất cả button có `aria-label` nếu chỉ có icon
- Focus ring rõ ràng (outline 2px primary-500)
- Color contrast đạt WCAG AA
- Modal trap focus

---

## 📂 PHASE 8 — File-level Cleanup

### Component cần XÓA

- `app/components/Dashboard/Sidebar.tsx` (dead code)

### Component cần GỘP

- `UploadModal.tsx` + `LiveSetupModal.tsx` → `RecordSetupModal`
- `EditorState.tsx` audio player block → dùng `Editor/AudioPlayer.tsx`
- 2 instances Header (Dashboard, Editor, Meeting, Minutes, Live) → `<PageHeader variant="...">`
- 2 instances AudioPlayer (Editor, Meeting) → `<AudioPlayer variant="...">`
- Inline `prose` markdown render → `<MarkdownContent>` component

### Constants/Typing cần thống nhất

- Tạo `app/lib/design-tokens.ts` — export type cho variants Button, Badge, Card, v.v.
- Tạo `app/lib/icons.ts` — tập trung icon mapping (nếu dùng 1 icon cho nhiều state)

### `tailwind.config` (vì dùng v4 → dùng `@theme` trong CSS)

- Khai báo 1 lần, xóa các hardcoded color trong JSX

---

## 📅 Lộ trình thực hiện

| Sprint | Nội dung | Output |
|---|---|---|
| **Sprint 1** (2-3 ngày) | Phase 0: Design tokens + UI library + cn utility | `globals.css` mới, `ui/*` mở rộng lên ~16 components, `cn.ts` |
| **Sprint 2** (2 ngày) | Phase 1: AppShell + Topbar + Sidebar mới + xóa dead code | Toàn bộ layout đồng nhất, sidebar light, topbar có user menu |
| **Sprint 3** (2-3 ngày) | Phase 2: Dashboard redesign | Dashboard đẹp, dùng tokens, modal gộp |
| **Sprint 4** (2-3 ngày) | Phase 3: Editor + Meeting Detail | Editor UX mượt hơn, transcript đẹp, audio player chuẩn |
| **Sprint 5** (1-2 ngày) | Phase 4: Minutes | Kho biên bản đẹp, AI chat polish |
| **Sprint 6** (1-2 ngày) | Phase 5: Tasks/Team/Training/Live | Áp design system cho các trang phụ |
| **Sprint 7** (1 ngày) | Phase 6: Auth & Onboarding polish | Login + tour đẹp hơn |
| **Sprint 8** (1 ngày) | Phase 7-8: Polish + cleanup | Animation, a11y, xóa dead code, lint sạch |

**Tổng cộng ước tính**: ~10-15 ngày làm việc (tùy tốc độ review).

---

## ⚠️ Rủi ro & Lưu ý

1. **Không phá vỡ logic**: Tất cả refactor chỉ đổi UI, KHÔNG đổi data layer / API calls
2. **Tailwind 4 + `@theme`**: syntax hơi khác v3, cần test kỹ PostCSS compile
3. **Component import paths**: dùng `@/` alias đã có sẵn (`@/app/lib/...`) — không cần đổi
4. **Driver.js tour**: Phase 6 cần test tour sau khi layout đổi, vì highlight dựa vào `id` có thể bị mất
5. **Dark mode sau**: khi cần, chỉ cần thêm 1 set CSS variables `[data-theme="dark"]` là chuyển được (đã design sẵn từ đầu)
6. **Test thủ công từng phase** trước khi qua phase tiếp theo
7. **Backup branch**: tạo branch `ui-redesign` riêng để dễ rollback nếu cần

---

## 💡 Quick wins (làm ngay trong 1-2 giờ nếu muốn thấy cải thiện tức thì)

Nếu bạn chưa muốn làm full redesign, 3 thay đổi nhỏ này sẽ giảm "rối mắt" ngay:

1. **Đổi màu Sidebar từ `bg-slate-900` → `bg-white border-r`** trong `app/(dashboard)/layout.tsx` (1 dòng)
2. **Xóa `app/components/Dashboard/Sidebar.tsx`** (dead code)
3. **Thống nhất button primary** trong `app/components/ui/Button.tsx` từ `blue-600` → `indigo-600` (đang lẫn lộn blue/indigo)

---

## 🎯 Bước tiếp theo

Bạn có thể chọn 1 trong các hướng:

- **[A]** Bắt đầu **Sprint 1 (Design System)** — làm nền tảng trước, các phase sau sẽ mượt hơn nhiều
- **[B]** Làm **Quick wins** trước để thấy cải thiện tức thì, rồi quyết định có làm tiếp không
- **[C]** Nhảy thẳng vào **Sprint 2 (AppShell)** nếu muốn thấy layout đổi ngay
- **[D]** Điều chỉnh plan (thêm/bớt phase, đổi thứ tự ưu tiên)

Gõ **[A]** / **[B]** / **[C]** / **[D]** để tôi tiếp tục.
