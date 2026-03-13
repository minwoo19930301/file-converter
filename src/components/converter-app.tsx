"use client";

import { Document, Packer, Paragraph, TextRun } from "docx";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { useId, useState } from "react";

import {
  formatBytes,
  getFileInsight,
  getInputKind,
  getInputLabel,
  getOutputHint,
  getOutputOptions,
  getSelectionMessage,
  IMAGE_PIXEL_LIMIT,
  INPUT_ACCEPT,
  normalizeTextContent,
  OUTPUT_EXTENSION,
  OUTPUT_LABELS,
  OUTPUT_MIME,
  PDF_PAGE_LIMIT,
  resolveNextFormat,
  stripExtension,
  TEXT_RENDER_LIMIT,
  type OutputFormat,
} from "@/lib/converter-config";

type StatusTone = "idle" | "error" | "success";

type StatusState = {
  message: string;
  tone: StatusTone;
};

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function ConverterApp() {
  const inputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("pdf");
  const [dragDepth, setDragDepth] = useState(0);
  const [isConverting, setIsConverting] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: "파일을 올리면 바로 변환할 수 있습니다.",
  });

  const inputKind = selectedFile ? getInputKind(selectedFile) : null;
  const outputOptions = getOutputOptions(inputKind);
  const fileInsight = selectedFile
    ? getFileInsight(selectedFile, inputKind, targetFormat)
    : null;
  const isDragging = dragDepth > 0;

  function handleSelection(file: File | null) {
    if (!file) {
      return;
    }

    const kind = getInputKind(file);

    if (!kind) {
      setSelectedFile(null);
      setStatus({
        tone: "error",
        message: "PDF, PNG, JPG, WEBP, TXT 파일만 지원합니다.",
      });
      return;
    }

    setSelectedFile(file);
    setTargetFormat(resolveNextFormat(kind, targetFormat));
    setStatus({
      tone: "idle",
      message: getSelectionMessage(file, kind),
    });
  }

  function handleClearSelection() {
    setSelectedFile(null);
    setTargetFormat("pdf");
    setDragDepth(0);
    setStatus({
      tone: "idle",
      message: "파일을 올리면 바로 변환할 수 있습니다.",
    });
  }

  async function handleConvert() {
    if (!selectedFile || !inputKind) {
      setStatus({
        tone: "error",
        message: "먼저 변환할 파일을 선택하세요.",
      });
      return;
    }

    setIsConverting(true);
    setStatus({
      tone: "idle",
      message: "변환 중입니다.",
    });

    try {
      let summary = "";

      if (inputKind === "text" && targetFormat === "docx") {
        summary = await convertTextToDocx(selectedFile);
      } else if (inputKind === "text") {
        summary = await convertTextToPdf(selectedFile);
      } else if (inputKind === "image" && targetFormat === "pdf") {
        summary = await convertImageToPdf(selectedFile);
      } else if (inputKind === "image") {
        summary = await convertImageToImage(selectedFile, targetFormat);
      } else {
        summary = await convertPdfToImages(selectedFile, targetFormat);
      }

      setStatus({
        tone: "success",
        message: summary,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "변환 중 알 수 없는 오류가 발생했습니다.";

      setStatus({
        tone: "error",
        message,
      });
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-10 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            파일 변환기
          </h1>
          <p className="text-sm leading-7 text-slate-400 sm:text-base">
            PDF, PNG, JPG, WEBP, TXT 파일을 브라우저 안에서 바로 변환합니다.
          </p>
        </div>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="space-y-4">
            <label
              htmlFor={inputId}
              onDragEnter={(event) => {
                if (!hasTransferFiles(event.dataTransfer)) {
                  return;
                }

                event.preventDefault();
                setDragDepth((current) => current + 1);
              }}
              onDragOver={(event) => {
                if (!hasTransferFiles(event.dataTransfer)) {
                  return;
                }

                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                if (!hasTransferFiles(event.dataTransfer)) {
                  return;
                }

                event.preventDefault();
                setDragDepth((current) => Math.max(current - 1, 0));
              }}
              onDrop={(event) => {
                if (!hasTransferFiles(event.dataTransfer)) {
                  return;
                }

                event.preventDefault();
                setDragDepth(0);
                handleSelection(event.dataTransfer.files.item(0));
              }}
              className={`flex min-h-48 cursor-pointer flex-col justify-center rounded-[1.25rem] border px-5 py-6 text-center transition ${
                isDragging
                  ? "border-cyan-400/60 bg-cyan-400/10"
                  : "border-dashed border-white/14 bg-black/20 hover:border-white/24 hover:bg-white/[0.03]"
              }`}
            >
              <p className="text-lg font-medium text-white">
                {selectedFile
                  ? selectedFile.name
                  : "파일을 드래그 앤 드롭하거나 클릭하세요"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                PDF, PNG, JPG, WEBP, TXT
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} · ${getInputLabel(
                      inputKind,
                    )}`
                  : "이미지, PDF, TXT를 감지해서 맞는 출력 포맷을 보여줍니다."}
              </p>
            </label>

            <input
              id={inputId}
              className="sr-only"
              type="file"
              accept={INPUT_ACCEPT}
              onChange={(event) => {
                handleSelection(event.target.files?.item(0) ?? null);
                event.currentTarget.value = "";
              }}
            />

            {selectedFile ? (
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                <p className="min-w-0 truncate">
                  현재 파일: <span className="text-white">{selectedFile.name}</span>
                </p>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="shrink-0 text-slate-400 transition hover:text-white"
                >
                  파일 해제
                </button>
              </div>
            ) : null}

            {fileInsight ? (
              <section className="rounded-[1rem] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-slate-300">
                <p className="font-medium text-white">
                  {fileInsight.detectedLabel}
                </p>
                <p className="mt-1 text-slate-400">
                  입력: {fileInsight.inputLabel} · 변환:{" "}
                  {fileInsight.availableOutputs}
                </p>
                <p className="mt-1 text-slate-500">
                  예상 결과 파일명: {fileInsight.outputPreview}
                </p>
                {fileInsight.caution ? (
                  <p className="mt-2 text-amber-200/80">{fileInsight.caution}</p>
                ) : null}
              </section>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              {outputOptions.map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => setTargetFormat(format)}
                  className={`rounded-[1rem] border px-4 py-3 text-left transition ${
                    targetFormat === format
                      ? "border-cyan-400/50 bg-cyan-400/10 text-white"
                      : "border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="block text-sm font-medium">
                    {OUTPUT_LABELS[format]}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {getOutputHint(format)}
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={!selectedFile || isConverting}
              onClick={handleConvert}
              className="w-full rounded-[1rem] bg-white px-4 py-3 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
            >
              {isConverting ? "변환 중..." : `${OUTPUT_LABELS[targetFormat]}로 변환`}
            </button>

            <section
              role="status"
              aria-live="polite"
              className={`rounded-[1rem] border px-4 py-3 text-sm leading-6 ${
                status.tone === "error"
                  ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                  : status.tone === "success"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-white/10 bg-black/20 text-slate-300"
              }`}
            >
              {status.message}
            </section>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 text-sm text-slate-500">
          <p className="rounded-full border border-white/10 px-3 py-1.5">
            이미지 to PDF
          </p>
          <p className="rounded-full border border-white/10 px-3 py-1.5">
            이미지 to PNG/JPG/WEBP
          </p>
          <p className="rounded-full border border-white/10 px-3 py-1.5">
            PDF to 페이지별 이미지
          </p>
          <p className="rounded-full border border-white/10 px-3 py-1.5">
            TXT to PDF/DOCX
          </p>
        </div>
      </div>
    </main>
  );
}

async function convertImageToImage(file: File, targetFormat: OutputFormat) {
  const canvas = await drawFileToCanvas(file, {
    backgroundColor: targetFormat === "jpg" ? "#ffffff" : null,
  });

  try {
    const blob = await canvasToBlob(
      canvas,
      OUTPUT_MIME[targetFormat],
      targetFormat === "jpg" || targetFormat === "webp" ? 0.92 : undefined,
    );
    const fileName = `${stripExtension(file.name)}.${OUTPUT_EXTENSION[targetFormat]}`;

    downloadBlob(blob, fileName);
    return `${file.name} 파일을 ${OUTPUT_LABELS[targetFormat]}로 변환했습니다.`;
  } finally {
    resetCanvas(canvas);
  }
}

async function convertImageToPdf(file: File) {
  const pdfDocument = await PDFDocument.create();
  const image = await embedImageForPdf(file, pdfDocument);
  const page = pdfDocument.addPage([image.width, image.height]);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  const pdfBytes = await pdfDocument.save();
  const fileName = `${stripExtension(file.name)}.pdf`;
  const pdfBlob = new Blob([typedArrayToArrayBuffer(pdfBytes)], {
    type: OUTPUT_MIME.pdf,
  });

  downloadBlob(pdfBlob, fileName);
  return `${file.name} 파일을 PDF로 저장했습니다.`;
}

async function convertTextToDocx(file: File) {
  const text = normalizeTextContent(await file.text());
  ensureTextWithinLimit(text);

  const paragraphs = text.split("\n").map((line) =>
    new Paragraph({
      children: [new TextRun(line.length > 0 ? line : " ")],
      spacing: { after: 180 },
    }),
  );

  const document = new Document({
    creator: "File Converter",
    description: `${file.name} TXT export`,
    title: stripExtension(file.name),
    sections: [
      {
        children: paragraphs.length > 0 ? paragraphs : [new Paragraph(" ")],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const fileName = `${stripExtension(file.name)}.docx`;

  downloadBlob(blob, fileName);
  return `${file.name} 파일을 Word 문서로 저장했습니다.`;
}

async function convertTextToPdf(file: File) {
  const text = normalizeTextContent(await file.text());
  ensureTextWithinLimit(text);

  const canvases = renderTextToCanvases(text);
  const pdfDocument = await PDFDocument.create();

  try {
    for (const canvas of canvases) {
      const pngBlob = await canvasToBlob(canvas, OUTPUT_MIME.png);
      const pngBytes = await blobToUint8Array(pngBlob);
      const image = await pdfDocument.embedPng(pngBytes);
      const page = pdfDocument.addPage([image.width, image.height]);

      page.drawImage(image, {
        x: 0,
        y: 0,
        width: image.width,
        height: image.height,
      });
    }
  } finally {
    for (const canvas of canvases) {
      resetCanvas(canvas);
    }
  }

  const pdfBytes = await pdfDocument.save();
  const fileName = `${stripExtension(file.name)}.pdf`;
  const pdfBlob = new Blob([typedArrayToArrayBuffer(pdfBytes)], {
    type: OUTPUT_MIME.pdf,
  });

  downloadBlob(pdfBlob, fileName);
  return `${file.name} 파일을 PDF로 저장했습니다.`;
}

async function convertPdfToImages(file: File, targetFormat: OutputFormat) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    useSystemFonts: true,
  }).promise;

  if (pdf.numPages > PDF_PAGE_LIMIT) {
    throw new Error(
      `PDF 페이지 수가 ${pdf.numPages}페이지입니다. 브라우저 안정성을 위해 ${PDF_PAGE_LIMIT}페이지 이하만 변환할 수 있습니다.`,
    );
  }

  const renderedPages: Array<{ blob: Blob; name: string }> = [];

  try {
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("브라우저 캔버스를 초기화하지 못했습니다.");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      if (targetFormat === "jpg") {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }

      await page.render({
        canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const blob = await canvasToBlob(
        canvas,
        OUTPUT_MIME[targetFormat],
        targetFormat === "jpg" || targetFormat === "webp" ? 0.92 : undefined,
      );

      renderedPages.push({
        blob,
        name: `${stripExtension(file.name)}-page-${String(pageIndex).padStart(2, "0")}.${OUTPUT_EXTENSION[targetFormat]}`,
      });

      page.cleanup();
      resetCanvas(canvas);
    }
  } finally {
    pdf.cleanup();
    pdf.destroy();
  }

  if (renderedPages.length === 1) {
    downloadBlob(renderedPages[0].blob, renderedPages[0].name);
    return `PDF 1페이지를 ${OUTPUT_LABELS[targetFormat]} 파일로 변환했습니다.`;
  }

  const zip = new JSZip();

  for (const page of renderedPages) {
    zip.file(page.name, await page.blob.arrayBuffer());
  }

  const archiveBlob = await zip.generateAsync({ type: "blob" });
  const archiveName = `${stripExtension(file.name)}-${targetFormat}-pages.zip`;

  downloadBlob(archiveBlob, archiveName);
  return `PDF ${renderedPages.length}페이지를 변환해 ZIP으로 저장했습니다.`;
}

async function drawFileToCanvas(
  file: File,
  options?: { backgroundColor?: string | null },
) {
  const image = await ensureImageWithinLimit(file);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("브라우저 캔버스를 초기화하지 못했습니다.");
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  if (options?.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  context.drawImage(image, 0, 0);
  return canvas;
}

async function embedImageForPdf(file: File, pdfDocument: PDFDocument) {
  await ensureImageWithinLimit(file);

  if (isJpegFile(file)) {
    return pdfDocument.embedJpg(await blobToUint8Array(file));
  }

  if (isPngFile(file)) {
    return pdfDocument.embedPng(await blobToUint8Array(file));
  }

  const canvas = await drawFileToCanvas(file);

  try {
    const pngBlob = await canvasToBlob(canvas, OUTPUT_MIME.png);
    const pngBytes = await blobToUint8Array(pngBlob);
    return pdfDocument.embedPng(pngBytes);
  } finally {
    resetCanvas(canvas);
  }
}

async function ensureImageWithinLimit(file: File) {
  const image = await loadImage(file);
  const pixelCount = image.naturalWidth * image.naturalHeight;

  if (pixelCount > IMAGE_PIXEL_LIMIT) {
    throw new Error(
      `이미지 해상도가 너무 큽니다. ${IMAGE_PIXEL_LIMIT.toLocaleString()} 픽셀 이하 파일로 다시 시도해 주세요.`,
    );
  }

  return image;
}

async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((module) => {
      module.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();

      return module;
    });
  }

  return pdfJsPromise;
}

function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지 파일을 읽지 못했습니다."));
    };

    image.src = objectUrl;
  });
}

function renderTextToCanvases(text: string) {
  const pageWidth = 1240;
  const pageHeight = 1754;
  const margin = 96;
  const fontSize = 28;
  const lineHeight = 46;
  const maxWidth = pageWidth - margin * 2;
  const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight);
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");

  if (!measureContext) {
    throw new Error("텍스트 PDF 생성을 위한 캔버스를 준비하지 못했습니다.");
  }

  measureContext.font = `${fontSize}px "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  const wrappedLines = text
    .split("\n")
    .flatMap((line) => wrapTextLine(line, measureContext, maxWidth));

  const pages: HTMLCanvasElement[] = [];

  for (
    let start = 0;
    start < wrappedLines.length || start === 0;
    start += maxLinesPerPage
  ) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("텍스트 PDF 생성을 위한 캔버스를 준비하지 못했습니다.");
    }

    canvas.width = pageWidth;
    canvas.height = pageHeight;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, pageWidth, pageHeight);
    context.fillStyle = "#111827";
    context.font = `${fontSize}px "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    context.textBaseline = "top";

    const pageLines = wrappedLines.slice(start, start + maxLinesPerPage);

    pageLines.forEach((line, index) => {
      if (line.length > 0) {
        context.fillText(line, margin, margin + index * lineHeight);
      }
    });

    pages.push(canvas);
  }

  resetCanvas(measureCanvas);
  return pages;
}

function wrapTextLine(
  line: string,
  context: CanvasRenderingContext2D,
  maxWidth: number,
) {
  if (line.length === 0) {
    return [""];
  }

  const wrapped: string[] = [];
  let current = "";

  for (const character of line) {
    const next = current + character;

    if (context.measureText(next).width > maxWidth && current.length > 0) {
      wrapped.push(current);
      current = character;
    } else {
      current = next;
    }
  }

  wrapped.push(current);
  return wrapped;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("출력 파일을 생성하지 못했습니다."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

async function blobToUint8Array(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function typedArrayToArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function ensureTextWithinLimit(text: string) {
  if (text.length > TEXT_RENDER_LIMIT) {
    throw new Error(
      `TXT 길이가 너무 깁니다. 안정적인 변환을 위해 ${TEXT_RENDER_LIMIT.toLocaleString()}자 이하 파일만 지원합니다.`,
    );
  }
}

function resetCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function hasTransferFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes("Files");
}

function isJpegFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/jpeg" || name.endsWith(".jpg") || name.endsWith(".jpeg");
}

function isPngFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/png" || name.endsWith(".png");
}
