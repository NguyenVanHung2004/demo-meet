import { describe, it, expect, beforeAll } from "vitest";
import JSZip from "jszip";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { fillDocx, extractPlaceholders, fillDocxMarkers } from "@/app/lib/docx/filler";

const readXmlFromBlob = async (blob: Blob): Promise<string> => {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Missing document.xml");
  return docFile.async("string");
};

const xmlToVisibleText = (xml: string): string =>
  xml
    .replace(/<w:t[^>]*>/g, "")
    .replace(/<\/w:t>/g, "")
    .replace(/<w:tab\/>/g, " ")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "");

const buildDocxWithSplitRuns = async (): Promise<File> => {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          children: [
            new TextRun("Ten: "),
            new TextRun("{{TEN_KHACH_HANG}}"),
            new TextRun(" | Ngay: "),
            new TextRun("{{NGAY_KY}}"),
          ],
        }),
        new Paragraph({ children: [new TextRun("Ghi chu: ______ ket thuc")] }),
      ],
    }],
  });
  const buf = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(buf);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("Missing document.xml");
  let xml = await docFile.async("string");

  // Mô phỏng Word tách placeholder thành nhiều runs
  xml = xml.replace(
    "<w:t>{{TEN_KHACH_HANG}}</w:t>",
    "<w:t>{{TE</w:t></w:r><w:r><w:t>N_KHACH_HANG}}</w:t>"
  );
  xml = xml.replace(
    "<w:t>{{NGAY_KY}}</w:t>",
    "<w:t>{{NG</w:t></w:r><w:r><w:t>AY_KY}}</w:t>"
  );
  xml = xml.replace(
    "<w:t>______</w:t>",
    "<w:t>__</w:t></w:r><w:r><w:t>____</w:t>"
  );
  zip.file("word/document.xml", xml);
  const out = await zip.generateAsync({ type: "blob" });
  return new File([out], "template.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
};

describe("docx filler with split runs", () => {
  let file: File;

  beforeAll(async () => {
    file = await buildDocxWithSplitRuns();
  });

  it("extractPlaceholders tìm được placeholder bị tách runs", async () => {
    const found = await extractPlaceholders(file);
    const names = found.map((p) => p.name).sort();
    expect(names).toEqual(["NGAY_KY", "TEN_KHACH_HANG"]);
  });

  it("fillDocx thay placeholder bị tách runs", async () => {
    const blob = await fillDocx(file, {
      TEN_KHACH_HANG: "Nguyen Van A",
      NGAY_KY: "15/03/2026",
    });
    const xml = await readXmlFromBlob(blob);
    const text = xmlToVisibleText(xml);
    expect(text).toContain("Ten: Nguyen Van A");
    expect(text).toContain("Ngay: 15/03/2026");
    expect(text).not.toContain("{{");
  });

  it("fillDocxMarkers thay marker gạch chân bị tách runs", async () => {
    const blob = await fillDocxMarkers(file, [
      { marker: "______", value: "da dien" },
    ]);
    const xml = await readXmlFromBlob(blob);
    const text = xmlToVisibleText(xml);
    expect(text).toContain("Ghi chu: da dien ket thuc");
    expect(text).not.toContain("______");
  });
});
