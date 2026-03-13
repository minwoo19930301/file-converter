"use client";

import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { useId, useState } from "react";

type InputKind = "image" | "pdf";
type OutputFormat = "pdf" | "png" | "jpg" | "webp";
type StatusTone = "idle" | "error" | "success";

type StatusState = {
  message: string;
  tone: StatusTone;
};

const INPUT_ACCEPT = ".pdf,image/png,image/jpeg,image/webp";

const IMAGE_OUTPUTS: OutputFormat[] = ["pdf", "png", "jpg", "webp"];
const PDF_OUTPUTS: OutputFormat[] = ["png", "jpg", "webp"];

const OUTPUT_LABELS: Record<OutputFormat, string> = {
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  webp: "WEBP",
};

const OUTPUT_MIME: Record<OutputFormat, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const OUTPUT_EXTENSION: Record<OutputFormat, string> = {
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  webp: "webp",
};

let pdfJsPromise: Promise<typeof import("pdfjs-dist")> | null = null;

export function ConverterApp() {
  const inputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<OutputFormat>("pdf");
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [status, setStatus] = useState<StatusState>({
    tone: "idle",
    message: "파일을 올리면 바로 변환할 수 있습니다.",
  });

  const inputKind = selectedFile ? getInputKind(selectedFile) : null;
  const outputOptions = inputKind === "pdf" ? PDF_OUTPUTS : IMAGE_OUTPUTS;

  function handleSelection(file: File | null) {
    if (!file) {
      return;
    }

    const kind = getInputKind(file);

    if (!kind) {
      setSelectedFile(null);
      setStatus({
        tone: "error",
        message: "PDF, PNG, JPG, WEBP 파일만 지원합니다.",
      });
      return;
    }

    setSelectedFile(file);
    setTargetFormat(resolveNextFormat(kind, targetFormat));
    setStatus({
      tone: "idle",
      message:
        kind === "pdf"
          ? "PDF는 페이지별 이미지로 변환되며 여러 장이면 ZIP으로 저장됩니다."
          : "이미지는 PDF 또는 다른 이미지 포맷으로 변환할 수 있습니다.",
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

      if (inputKind === "image" && targetFormat === "pdf") {
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
            PDF, PNG, JPG, WEBP 파일을 브라우저 안에서 바로 변환합니다.
          </p>
        </div>

        <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="space-y-4">
            <label
              htmlFor={inputId}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                handleSelection(event.dataTransfer.files.item(0));
              }}
              className={`flex min-h-48 cursor-pointer flex-col justify-center rounded-[1.25rem] border px-5 py-6 text-center transition ${
                isDragging
                  ? "border-cyan-400/60 bg-cyan-400/10"
                  : "border-dashed border-white/14 bg-black/20 hover:border-white/24 hover:bg-white/[0.03]"
              }`}
            >
              <p className="text-lg font-medium text-white">
                {selectedFile ? selectedFile.name : "파일을 끌어오거나 클릭하세요"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                PDF, PNG, JPG, WEBP
              </p>
              <p className="mt-3 text-sm text-slate-500">
                {selectedFile
                  ? `${formatBytes(selectedFile.size)} · ${
                      inputKind === "pdf" ? "PDF 문서" : "이미지 파일"
                    }`
                  : "서버 업로드 없이 변환합니다."}
              </p>
            </label>

            <input
              id={inputId}
              className="sr-only"
              type="file"
              accept={INPUT_ACCEPT}
              onChange={(event) =>
                handleSelection(event.target.files?.item(0) ?? null)
              }
            />

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

        <div className="grid gap-2 text-sm text-slate-500 sm:grid-cols-3">
          <p>이미지 to PDF</p>
          <p>이미지 to PNG/JPG/WEBP</p>
          <p>PDF to 페이지별 이미지</p>
        </div>
      </div>
    </main>
  );
}

async function convertImageToImage(file: File, targetFormat: OutputFormat) {
  const canvas = await drawFileToCanvas(file);
  const blob = await canvasToBlob(canvas, OUTPUT_MIME[targetFormat], 0.92);
  const fileName = `${stripExtension(file.name)}.${OUTPUT_EXTENSION[targetFormat]}`;

  downloadBlob(blob, fileName);
  return `${file.name} 파일을 ${OUTPUT_LABELS[targetFormat]}로 변환했습니다.`;
}

async function convertImageToPdf(file: File) {
  const canvas = await drawFileToCanvas(file);
  const pngBlob = await canvasToBlob(canvas, OUTPUT_MIME.png);
  const pngBytes = await blobToUint8Array(pngBlob);
  const pdfDocument = await PDFDocument.create();
  const image = await pdfDocument.embedPng(pngBytes);
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

async function convertPdfToImages(file: File, targetFormat: OutputFormat) {
  const pdfjs = await loadPdfJs();
  const pdf = await pdfjs.getDocument({
    data: await file.arrayBuffer(),
    useSystemFonts: true,
  }).promise;

  const renderedPages: Array<{ blob: Blob; name: string }> = [];

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

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    const blob = await canvasToBlob(canvas, OUTPUT_MIME[targetFormat], 0.92);
    renderedPages.push({
      blob,
      name: `${stripExtension(file.name)}-page-${String(pageIndex).padStart(2, "0")}.${OUTPUT_EXTENSION[targetFormat]}`,
    });
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

async function drawFileToCanvas(file: File) {
  const image = await loadImage(file);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("브라우저 캔버스를 초기화하지 못했습니다.");
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);
  return canvas;
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
  return Uint8Array.from(bytes).buffer;
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = objectUrl;
  link.download = fileName;
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1000);
}

function getInputKind(file: File): InputKind | null {
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return "image";
  }

  return null;
}

function resolveNextFormat(kind: InputKind, currentFormat: OutputFormat) {
  const outputs = kind === "pdf" ? PDF_OUTPUTS : IMAGE_OUTPUTS;

  if (outputs.includes(currentFormat)) {
    return currentFormat;
  }

  return kind === "pdf" ? "png" : "pdf";
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function formatBytes(size: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getOutputHint(format: OutputFormat) {
  if (format === "pdf") {
    return "document";
  }

  return "image export";
}
