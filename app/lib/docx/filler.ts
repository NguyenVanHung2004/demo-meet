import JSZip from "jszip";

export const MAX_DOCX_SIZE = 5 * 1024 * 1024;

export interface PlaceholderInfo {
  name: string;
  count: number;
}

export interface DocxParseResult {
  placeholders: PlaceholderInfo[];
  documentXml: string;
}

const PLACEHOLDER_REGEX = /\{\{([^{}]+)\}\}/g;

const escapeXml = (s: string): string =>
  s.replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const validateFile = (file: File): void => {
  if (file.size > MAX_DOCX_SIZE) {
    throw new Error("File quá lớn. Giới hạn 5MB.");
  }
  const isDocx =
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.toLowerCase().endsWith(".docx");
  if (!isDocx) {
    throw new Error("Chỉ hỗ trợ file .docx");
  }
};

const readDocumentXml = async (file: File): Promise<string> => {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const doc = zip.file("word/document.xml");
  if (!doc) {
    throw new Error("File .docx không hợp lệ (thiếu word/document.xml)");
  }
  return doc.async("string");
};

export async function extractPlaceholders(file: File): Promise<PlaceholderInfo[]> {
  validateFile(file);
  const documentXml = await readDocumentXml(file);
  const counts = new Map<string, number>();
  for (const match of documentXml.matchAll(PLACEHOLDER_REGEX)) {
    const name = match[1].trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
}

export async function fillDocx(file: File, values: Record<string, string>): Promise<Blob> {
  validateFile(file);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXml = await readDocumentXml(file);

  const newXml = documentXml.replace(PLACEHOLDER_REGEX, (match, rawName: string) => {
    const name = rawName.trim();
    const value = values[name];
    return value === undefined || value === null ? match : escapeXml(value);
  });

  zip.file("word/document.xml", newXml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

export async function parseDocx(file: File): Promise<DocxParseResult> {
  const documentXml = await readDocumentXml(file);
  const placeholders = await extractPlaceholders(file);
  return { placeholders, documentXml };
}

export async function extractPlainText(file: File): Promise<string> {
  validateFile(file);
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value;
}

export interface DocxMarker {
  marker: string;
  value: string;
}

export async function fillDocxMarkers(file: File, markers: DocxMarker[]): Promise<Blob> {
  validateFile(file);
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let documentXml = await readDocumentXml(file);

  for (const { marker, value } of markers) {
    if (!marker || !marker.trim()) continue;
    const escapedMarker = escapeXml(marker);
    const escapedValue = escapeXml(value ?? "");
    const idx = documentXml.indexOf(escapedMarker);
    if (idx !== -1) {
      documentXml = documentXml.slice(0, idx) + escapedValue + documentXml.slice(idx + escapedMarker.length);
    }
  }

  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}
