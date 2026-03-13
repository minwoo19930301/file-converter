import { describe, expect, it } from "vitest";

import {
  formatBytes,
  getFileInsight,
  getInputKind,
  getOutputOptions,
  getSelectionMessage,
  normalizeTextContent,
  resolveNextFormat,
} from "./converter-config";

describe("converter-config", () => {
  it("detects input kinds from mime type and filename", () => {
    expect(
      getInputKind({ name: "report.PDF", type: "application/octet-stream" }),
    ).toBe("pdf");
    expect(getInputKind({ name: "notes.txt", type: "text/plain" })).toBe("text");
    expect(getInputKind({ name: "photo.webp", type: "" })).toBe("image");
    expect(getInputKind({ name: "archive.zip", type: "application/zip" })).toBe(
      null,
    );
  });

  it("returns output options by input kind", () => {
    expect(getOutputOptions("image")).toEqual(["pdf", "png", "jpg", "webp"]);
    expect(getOutputOptions("pdf")).toEqual(["png", "jpg", "webp"]);
    expect(getOutputOptions("text")).toEqual(["pdf", "docx"]);
  });

  it("resolves a compatible next format", () => {
    expect(resolveNextFormat("text", "jpg")).toBe("pdf");
    expect(resolveNextFormat("pdf", "pdf")).toBe("png");
    expect(resolveNextFormat("image", "webp")).toBe("webp");
  });

  it("builds text-specific selection messages", () => {
    expect(
      getSelectionMessage({ name: "draft.txt", type: "text/plain" }, "text"),
    ).toContain("DOCX");
  });

  it("builds file insight with a caution for large files", () => {
    const insight = getFileInsight(
      { name: "scan.pdf", type: "application/pdf", size: 25 * 1024 * 1024 },
      "pdf",
      "png",
    );

    expect(insight.detectedLabel).toBe("PDF 확장자로 감지됨");
    expect(insight.outputPreview).toContain("scan-page-01.png");
    expect(insight.caution).toContain("브라우저 메모리");
  });

  it("normalizes text for text exports", () => {
    expect(normalizeTextContent("a\r\nb\rc\td")).toBe("a\nb\nc    d");
  });

  it("formats bytes for UI labels", () => {
    expect(formatBytes(950)).toBe("950 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });
});
