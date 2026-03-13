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
    message: "ready: 파일을 올리면 브라우저 안에서 즉시 변환합니다.",
  });

  const inputKind = selectedFile ? getInputKind(selectedFile) : null;
  const outputOptions = inputKind === "pdf" ? PDF_OUTPUTS : IMAGE_OUTPUTS;
  const modeLabel = inputKind === "pdf" ? "pdf-raster" : "image-transcode";
  const selectedSummary = selectedFile
    ? `${selectedFile.name} (${formatBytes(selectedFile.size)})`
    : "no file selected";
  const commandPreview = getCommandPreview(
    selectedFile,
    inputKind,
    targetFormat,
    isConverting,
  );

  function handleSelection(file: File | null) {
    if (!file) {
      return;
    }

    const kind = getInputKind(file);

    if (!kind) {
      setSelectedFile(null);
      setStatus({
        tone: "error",
        message: "error: PDF, PNG, JPG, WEBP 파일만 지원합니다.",
      });
      return;
    }

    setSelectedFile(file);
    setTargetFormat(resolveNextFormat(kind, targetFormat));
    setStatus({
      tone: "idle",
      message:
        kind === "pdf"
          ? "ready: PDF는 페이지별 이미지로 추출하며 여러 장이면 ZIP으로 저장합니다."
          : "ready: 이미지는 PDF 또는 다른 이미지 포맷으로 변환합니다.",
    });
  }

  async function handleConvert() {
    if (!selectedFile || !inputKind) {
      setStatus({
        tone: "error",
        message: "error: 먼저 변환할 파일을 선택하세요.",
      });
      return;
    }

    setIsConverting(true);
    setStatus({
      tone: "idle",
      message: "running: 변환 작업을 실행 중입니다.",
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
        message: `done: ${summary}`,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "변환 중 알 수 없는 오류가 발생했습니다.";

      setStatus({
        tone: "error",
        message: `error: ${message}`,
      });
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <main className="terminal-shell min-h-screen px-4 py-4 text-[#d6ffe5] sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="terminal-window overflow-hidden rounded-[1.6rem]">
          <div className="terminal-titlebar flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#8af7b6]">
                file-converter://terminal-ui
              </p>
            </div>
            <p className="hidden text-xs uppercase tracking-[0.28em] text-[#5cd48b] sm:block">
              session active
            </p>
          </div>

          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="border-b border-[#143127] p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <div className="space-y-5">
                <div className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.34em] text-[#5cd48b]">
                    terminal version / browser runtime / local processing
                  </p>
                  <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-[#eafff2] sm:text-5xl">
                    파일 변환기를
                    <br />
                    터미널 화면처럼
                    <br />
                    다시 꾸몄습니다
                  </h1>
                  <p className="max-w-3xl text-sm leading-7 text-[#8fbfa2] sm:text-base">
                    업로드, 포맷 선택, 실행 상태를 전부 CLI 감성으로 정리했습니다.
                    변환은 계속 브라우저 안에서만 처리하고 서버 업로드는 하지
                    않습니다.
                  </p>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                  <TerminalPanel title="runtime.info">
                    <DataRow label="input.accept" value="pdf png jpg webp" />
                    <DataRow label="engine.mode" value={modeLabel} />
                    <DataRow
                      label="output.target"
                      value={OUTPUT_LABELS[targetFormat].toLowerCase()}
                    />
                    <DataRow
                      label="storage"
                      value="browser-only / no upload"
                    />
                  </TerminalPanel>

                  <TerminalPanel title="queue.status">
                    <DataRow label="selected.file" value={selectedSummary} />
                    <DataRow
                      label="selected.kind"
                      value={inputKind ?? "unknown"}
                    />
                    <DataRow
                      label="convert.state"
                      value={isConverting ? "running" : "idle"}
                    />
                    <DataRow
                      label="package.mode"
                      value={
                        inputKind === "pdf" && targetFormat !== "pdf"
                          ? "single or zip"
                          : "single file"
                      }
                    />
                  </TerminalPanel>
                </div>

                <TerminalPanel title="workflow.map">
                  <div className="space-y-3 text-sm leading-7 text-[#b4f5ca]">
                    <WorkflowLine
                      label="01"
                      text="PNG / JPG / WEBP -> PDF 문서로 저장"
                    />
                    <WorkflowLine
                      label="02"
                      text="PNG / JPG / WEBP -> 다른 이미지 포맷으로 재인코딩"
                    />
                    <WorkflowLine
                      label="03"
                      text="PDF -> 페이지별 PNG / JPG / WEBP 추출"
                    />
                    <WorkflowLine
                      label="04"
                      text="멀티페이지 PDF는 ZIP으로 자동 묶음"
                    />
                  </div>
                </TerminalPanel>
              </div>
            </section>

            <section className="p-5 sm:p-7">
              <div className="space-y-4">
                <TerminalPanel title="command.preview">
                  <div className="rounded-xl border border-[#1d3d2e] bg-[#06110d] px-4 py-3 text-sm text-[#9ef3be]">
                    <span className="text-[#3dbb71]">$</span> {commandPreview}
                  </div>
                </TerminalPanel>

                <TerminalPanel title="source.input">
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
                    className={`flex min-h-56 cursor-pointer flex-col justify-between rounded-[1.2rem] border px-5 py-5 transition ${
                      isDragging
                        ? "border-[#6dff9d] bg-[#0b1e15] shadow-[0_0_32px_rgba(101,255,150,0.18)]"
                        : "border-[#1d3d2e] bg-[#08130f] hover:border-[#2c6a4c] hover:bg-[#0a1712]"
                    }`}
                  >
                    <div className="space-y-3">
                      <p className="text-xs uppercase tracking-[0.28em] text-[#54d987]">
                        {selectedFile ? "file.loaded" : "awaiting.input"}
                      </p>
                      <p className="text-xl font-semibold leading-8 text-[#ecfff4]">
                        {selectedFile
                          ? selectedFile.name
                          : "drag file here or click to load"}
                      </p>
                      <p className="text-sm leading-7 text-[#86ad95]">
                        지원 포맷: PDF, PNG, JPG, WEBP
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.22em] text-[#5fbc82]">
                      <span className="rounded-full border border-[#214734] px-3 py-1">
                        single source
                      </span>
                      <span className="rounded-full border border-[#214734] px-3 py-1">
                        local processing
                      </span>
                    </div>
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
                </TerminalPanel>

                <TerminalPanel title="target.format">
                  <div className="grid grid-cols-2 gap-3">
                    {outputOptions.map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => setTargetFormat(format)}
                        className={`rounded-[1.1rem] border px-4 py-4 text-left transition ${
                          targetFormat === format
                            ? "border-[#78ffac] bg-[#0d2519] text-[#ecfff4] shadow-[0_0_28px_rgba(101,255,150,0.12)]"
                            : "border-[#1d3d2e] bg-[#09120e] text-[#8fbfa2] hover:border-[#2c6a4c] hover:text-[#cbffe0]"
                        }`}
                      >
                        <span className="block text-base font-semibold">
                          {OUTPUT_LABELS[format]}
                        </span>
                        <span className="mt-2 block text-xs uppercase tracking-[0.22em] opacity-80">
                          {getOutputHint(format)}
                        </span>
                      </button>
                    ))}
                  </div>
                </TerminalPanel>

                <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
                  <TerminalPanel title="execute">
                    <button
                      type="button"
                      disabled={!selectedFile || isConverting}
                      onClick={handleConvert}
                      className="flex w-full items-center justify-center rounded-[1.2rem] border border-[#3eff7e] bg-[#0d2217] px-4 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#d7ffe7] transition hover:bg-[#123120] disabled:cursor-not-allowed disabled:border-[#234333] disabled:bg-[#09120e] disabled:text-[#4d7660]"
                    >
                      {isConverting
                        ? "processing..."
                        : `run ${OUTPUT_LABELS[targetFormat].toLowerCase()} export`}
                    </button>
                  </TerminalPanel>

                  <TerminalPanel title="output.mode">
                    <div className="space-y-2 text-sm leading-6 text-[#b4f5ca]">
                      <p>{inputKind === "pdf" ? "pages => raster" : "binary => transform"}</p>
                      <p className="text-[#6f9f81]">
                        {inputKind === "pdf"
                          ? "멀티페이지면 zip 생성"
                          : "단일 파일 직접 다운로드"}
                      </p>
                    </div>
                  </TerminalPanel>
                </div>

                <TerminalPanel title={`status.${status.tone}`}>
                  <div
                    className={`rounded-[1rem] border px-4 py-4 text-sm leading-7 ${
                      status.tone === "error"
                        ? "border-[#703338] bg-[#1a0b0e] text-[#ffafb9]"
                        : status.tone === "success"
                          ? "border-[#23543a] bg-[#09150f] text-[#a8ffca]"
                          : "border-[#1d3d2e] bg-[#09120e] text-[#b4f5ca]"
                    }`}
                  >
                    {status.message}
                  </div>
                </TerminalPanel>
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function TerminalPanel({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-[1.2rem] border border-[#143127] bg-[#07110d] p-4 shadow-[inset_0_1px_0_rgba(130,255,180,0.04)]">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-[#4fc97b]">
        {title}
      </p>
      {children}
    </section>
  );
}

function DataRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[#0f241b] py-2 text-sm first:border-t-0 first:pt-0 last:pb-0">
      <span className="min-w-0 text-[#5d9c75]">{label}</span>
      <span className="text-right text-[#ddffee]">{value}</span>
    </div>
  );
}

function WorkflowLine({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <span className="text-[#4fc97b]">{label}</span>
      <span>{text}</span>
    </div>
  );
}

async function convertImageToImage(file: File, targetFormat: OutputFormat) {
  const canvas = await drawFileToCanvas(file);
  const blob = await canvasToBlob(canvas, OUTPUT_MIME[targetFormat], 0.92);
  const fileName = `${stripExtension(file.name)}.${OUTPUT_EXTENSION[targetFormat]}`;

  downloadBlob(blob, fileName);
  return `${file.name} -> ${OUTPUT_LABELS[targetFormat]}`;
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
  return `${file.name} -> PDF`;
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
    return `PDF page 1 -> ${OUTPUT_LABELS[targetFormat]}`;
  }

  const zip = new JSZip();

  for (const page of renderedPages) {
    zip.file(page.name, await page.blob.arrayBuffer());
  }

  const archiveBlob = await zip.generateAsync({ type: "blob" });
  const archiveName = `${stripExtension(file.name)}-${targetFormat}-pages.zip`;

  downloadBlob(archiveBlob, archiveName);
  return `PDF ${renderedPages.length} pages -> ZIP`;
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
    return "document build";
  }

  return "raster export";
}

function getCommandPreview(
  file: File | null,
  inputKind: InputKind | null,
  targetFormat: OutputFormat,
  isConverting: boolean,
) {
  if (isConverting) {
    return "convert --run --watch-status";
  }

  if (!file || !inputKind) {
    return "convert --input <file> --output <format>";
  }

  return `convert --input "${file.name}" --from ${inputKind} --to ${targetFormat}`;
}
