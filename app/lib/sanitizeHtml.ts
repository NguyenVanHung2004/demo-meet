/**
 * Loại bỏ các thẻ HTML nguy hiểm và event handlers để chống XSS.
 * Dùng trước khi render AI summary / minutes content dạng HTML.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*\s+on\w+\s*=\s*["'][^"']*["'][^>]*>/gi, (match) => match.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, ""))
    .replace(/<[^>]*\s+on\w+\s*=\s*[^\s>]+/gi, (match) => match.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, ""))
    .replace(/javascript\s*:/gi, "");
}
