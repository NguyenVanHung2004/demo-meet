import { describe, it, expect } from "vitest";
import { stripCjk, stripThinking } from "@/app/lib/text";

describe("stripCjk", () => {
  it("input rỗng trả về rỗng", () => {
    expect(stripCjk("")).toBe("");
  });

  it("giữ nguyên text tiếng Việt có dấu", () => {
    expect(stripCjk("Xin chào các bạn")).toBe("Xin chào các bạn");
    expect(stripCjk("Mục đích: rà soát dự án K2")).toBe("Mục đích: rà soát dự án K2");
  });

  it("giữ nguyên từ tiếng Anh / thuật ngữ kỹ thuật", () => {
    expect(stripCjk("API endpoints")).toBe("API endpoints");
    expect(stripCjk("CDN cluster")).toBe("CDN cluster");
  });

  it("giữ nguyên emoji và ký tự đặc biệt", () => {
    expect(stripCjk("Bước 1 ✓ tiếp tục")).toBe("Bước 1 ✓ tiếp tục");
    expect(stripCjk("→ Bước tiếp theo")).toBe("→ Bước tiếp theo");
  });

  it("strip ký tự Trung giữa từ tiếng Việt", () => {
    expect(stripCjk("video tự拍摄")).toBe("video tự");
    expect(stripCjk("Đẩy mạnh video tự拍摄 (nhằm tăng CTR)")).toBe(
      "Đẩy mạnh video tự (nhằm tăng CTR)"
    );
  });

  it("strip ký tự Nhật (Hiragana + Katakana)", () => {
    expect(stripCjk("日本語ひらがなカタカナ")).toBe("");
    expect(stripCjk("Hôm nay こんにちは")).toBe("Hôm nay");
  });

  it("strip ký tự Hàn (Hangul)", () => {
    expect(stripCjk("한국어")).toBe("");
    expect(stripCjk("Tiếng Hàn 한국어")).toBe("Tiếng Hàn");
  });

  it("strip toàn bộ khi text chỉ có CJK", () => {
    expect(stripCjk("中文测试")).toBe("");
    expect(stripCjk("测试")).toBe("");
  });

  it("collapse nhiều space thành 1 space", () => {
    expect(stripCjk("a  b  c")).toBe("a b c");
    expect(stripCjk("Mục  đích  :  rà soát")).toBe("Mục đích : rà soát");
  });

  it("không xóa newline", () => {
    expect(stripCjk("Dòng 1\nDòng 2")).toBe("Dòng 1\nDòng 2");
  });

  it("strip leading whitespace trên mỗi dòng", () => {
    expect(stripCjk("  Dòng 1\n  Dòng 2")).toBe("Dòng 1\nDòng 2");
  });

  it("trim đầu cuối", () => {
    expect(stripCjk("  hello  ")).toBe("hello");
  });

  it("giữ nguyên text không có CJK", () => {
    expect(stripCjk("Báo cáo tiến độ dự án")).toBe("Báo cáo tiến độ dự án");
  });

  it("strip CJK Compatibility Ideographs (U+F900-FAFF)", () => {
    expect(stripCjk("富")).toBe("");
    expect(stripCjk("Văn bản 富")).toBe("Văn bản");
  });

  it("giữ nguyên số và dấu câu", () => {
    expect(stripCjk("Tăng 10-15%")).toBe("Tăng 10-15%");
    expect(stripCjk("Trước dự án tiếp theo.")).toBe("Trước dự án tiếp theo.");
  });

  it("output đã strip CJK + collapse space", () => {
    expect(stripCjk("Đẩy mạnh video   tự拍摄  (nhằm  tăng  CTR)")).toBe(
      "Đẩy mạnh video tự (nhằm tăng CTR)"
    );
  });
});

describe("stripThinking", () => {
  it("input rỗng trả về rỗng", () => {
    expect(stripThinking("")).toBe("");
  });

  it("strip block thường gặp ở đầu response model hay leak", () => {
    const input = "\u003c!--Mô hình suy luận nội bộ ở đây--\u003e# BIÊN BẢN TÓM TẮT";
    const out = stripThinking(input);
    expect(out).toBe("# BIÊN BẢN TÓM TẮT");
    expect(out).not.toMatch(/<!--/);
  });

  it("strip block chiếm phần lớn content", () => {
    const input =
      "\u003c!--Đoạn reasoning rất dài ở đây (nhiều dòng)\n--\u003e\n# BIÊN BẢN TÓM TẮT\n\nNội dung...";
    const out = stripThinking(input);
    expect(out.startsWith("# BIÊN BẢN")).toBe(true);
    expect(out).not.toMatch(/<!--/);
    expect(out).not.toContain("Đoạn reasoning");
  });

  it("strip block ở giữa content", () => {
    const input =
      "Đoạn đầu.\u003cthinking\u003egặp nhiễu ở đây\u003c/thinking\u003eĐoạn sau.";
    expect(stripThinking(input)).toBe("Đoạn đầu.Đoạn sau.");
  });

  it("giữ nguyên khi text không có think tag", () => {
    const input = "Chỉ là văn bản thường, không có reasoning.";
    expect(stripThinking(input)).toBe(input);
  });

  it("trim whitespace đầu cuối", () => {
    expect(stripThinking("   summary thường   ")).toBe("summary thường");
  });
});
