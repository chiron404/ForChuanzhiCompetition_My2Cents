import type { ParsedDoc, Paragraph, SourceRef } from "@/types";

/** 保留原始字符偏移，按空行分段；超长段落再分片，禁止重写原文。 */
export function parseText(
  text: string,
  name: string,
  type: ParsedDoc["type"] = "md",
  pageStarts?: number[],
): ParsedDoc {
  if (!text.trim()) throw new Error("文档没有可读取的文字，请检查文件内容。");
  const paragraphs: Paragraph[] = [];
  const regex = /\S[\s\S]*?(?=\r?\n\s*\r?\n|$)/g;
  for (const match of text.matchAll(regex)) {
    const content = match[0].trimEnd();
    for (let pos = 0; pos < content.length; pos += 3000) {
      const start = match.index + pos;
      const slice = content.slice(pos, pos + 3000);
      const heading = slice.match(/^(#{1,6})\s/);
      const page = pageStarts
        ? pageStarts.filter((offset) => offset <= start).length
        : undefined;
      paragraphs.push({
        id: `p-${paragraphs.length + 1}`,
        text: slice,
        start,
        end: start + slice.length,
        page,
        heading: heading?.[1].length,
      });
    }
  }
  return {
    id: `doc-${fingerprint(text)}`,
    fingerprint: fingerprint(text),
    name,
    type,
    text,
    paragraphs,
    pages: pageStarts?.length ?? 1,
  };
}

/** 非加密内容指纹仅用于本地缓存，不用于安全判断。 */
export function fingerprint(text: string): string {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 2654435761);
    h2 = Math.imul(h2 ^ text.charCodeAt(i), 1597334677);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}-${text.length}`;
}

export function sourceFor(
  doc: ParsedDoc,
  paragraph: Paragraph,
  needle?: string,
): SourceRef {
  const local = needle ? paragraph.text.indexOf(needle) : 0;
  const start = paragraph.start + Math.max(0, local);
  const quote = doc.text.slice(
    start,
    Math.min(paragraph.end, start + Math.min(needle?.length ?? 200, 200)),
  );
  return {
    docId: doc.id,
    docName: doc.name,
    locator: {
      kind: paragraph.page ? "page" : "paragraph",
      index: paragraph.page ?? doc.paragraphs.indexOf(paragraph) + 1,
    },
    quote,
    offset: { start, end: start + quote.length },
  };
}

/** AI 引用必须在原文中实际存在，且字符区间与摘录相等。 */
export function validSource(source: SourceRef, doc: ParsedDoc): boolean {
  return (
    source.docId === doc.id &&
    source.offset.start >= 0 &&
    source.offset.end > source.offset.start &&
    source.offset.end <= doc.text.length &&
    doc.text.slice(source.offset.start, source.offset.end) === source.quote
  );
}

/** 每块不超过 4000 字，前后保留一个段落的上下文。 */
export function chunkDocument(doc: ParsedDoc): Paragraph[][] {
  const chunks: Paragraph[][] = [];
  let current: Paragraph[] = [],
    size = 0;
  for (const paragraph of doc.paragraphs) {
    if (size + paragraph.text.length > 4000 && current.length) {
      chunks.push(current);
      const previous = current.at(-1)!;
      current =
        previous.text.length + paragraph.text.length <= 4000 ? [previous] : [];
      size = current.reduce((sum, p) => sum + p.text.length, 0);
    }
    current.push(paragraph);
    size += paragraph.text.length;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** 解析只在浏览器执行；原始二进制文件不会发送到 API。 */
export async function parseFile(file: File): Promise<ParsedDoc> {
  if (file.size > 20 * 1024 * 1024)
    throw new Error("文件超过 20 MB，请压缩或拆分后重试。");
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  if (ext === "md" || ext === "markdown" || ext === "txt")
    return parseText(await file.text(), file.name);
  if (ext === "docx") {
    const mammoth = await import("mammoth/mammoth.browser");
    try {
      const result = await mammoth.extractRawText({
        arrayBuffer: await file.arrayBuffer(),
      });
      return parseText(result.value, file.name, "docx");
    } catch {
      throw new Error("DOCX 无法解析，文件可能已损坏或受到加密保护。");
    }
  }
  if (ext === "pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    let pdf:
      | Awaited<ReturnType<typeof pdfjs.getDocument>["promise"]>
      | undefined;
    try {
      pdf = await pdfjs.getDocument({
        data: await file.arrayBuffer(),
        useSystemFonts: true,
      }).promise;
      const pages: string[] = [],
        starts: number[] = [];
      let offset = 0;
      for (let i = 1; i <= pdf.numPages; i++) {
        const content = await (await pdf.getPage(i)).getTextContent();
        let pageText = "";
        for (const item of content.items)
          if ("str" in item) pageText += item.str + (item.hasEOL ? "\n" : " ");
        starts.push(offset);
        pages.push(pageText);
        offset += pageText.length + 2;
      }
      if (pages.every((page) => !page.trim()))
        throw new Error(
          "扫描版 PDF 没有文本层，请转为可复制文字的 PDF，或粘贴 OCR 后的 Markdown。",
        );
      return parseText(pages.join("\n\n"), file.name, "pdf", starts);
    } catch (error) {
      if (error instanceof Error && error.message.includes("文本层"))
        throw error;
      throw new Error(
        "PDF 无法解析，文件可能已损坏、受密码保护，或没有可读取的文本。",
      );
    } finally {
      await pdf?.destroy();
    }
  }
  throw new Error("暂不支持该格式，请选择 PDF、DOCX 或 Markdown 文件。");
}
