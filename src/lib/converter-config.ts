export type InputKind = "image" | "pdf" | "text";
export type OutputFormat = "docx" | "pdf" | "png" | "jpg" | "webp";

type FileDescriptor = {
  name: string;
  type: string;
  size?: number;
};

type FileInsight = {
  availableOutputs: string;
  caution: string | null;
  detectedLabel: string;
  inputLabel: string;
  outputPreview: string;
};

const KB = 1024;
const MB = KB * 1024;

export const INPUT_ACCEPT = ".pdf,.txt,text/plain,image/png,image/jpeg,image/webp";

export const IMAGE_OUTPUTS: OutputFormat[] = ["pdf", "png", "jpg", "webp"];
export const PDF_OUTPUTS: OutputFormat[] = ["png", "jpg", "webp"];
export const TEXT_OUTPUTS: OutputFormat[] = ["pdf", "docx"];

export const OUTPUT_LABELS: Record<OutputFormat, string> = {
  docx: "WORD",
  pdf: "PDF",
  png: "PNG",
  jpg: "JPG",
  webp: "WEBP",
};

export const OUTPUT_MIME: Record<OutputFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

export const OUTPUT_EXTENSION: Record<OutputFormat, string> = {
  docx: "docx",
  pdf: "pdf",
  png: "png",
  jpg: "jpg",
  webp: "webp",
};

export const TEXT_RENDER_LIMIT = 200_000;
export const PDF_PAGE_LIMIT = 120;
export const IMAGE_PIXEL_LIMIT = 36_000_000;

export function getInputKind(file: FileDescriptor): InputKind | null {
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (file.type === "text/plain" || name.endsWith(".txt")) {
    return "text";
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

export function getOutputOptions(inputKind: InputKind | null) {
  if (inputKind === "pdf") {
    return PDF_OUTPUTS;
  }

  if (inputKind === "text") {
    return TEXT_OUTPUTS;
  }

  return IMAGE_OUTPUTS;
}

export function resolveNextFormat(
  kind: InputKind,
  currentFormat: OutputFormat,
): OutputFormat {
  const outputs = getOutputOptions(kind);

  if (outputs.includes(currentFormat)) {
    return currentFormat;
  }

  if (kind === "pdf") {
    return "png";
  }

  return "pdf";
}

export function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

export function formatBytes(size: number) {
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= KB && unitIndex < units.length - 1) {
    value /= KB;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getOutputHint(format: OutputFormat) {
  if (format === "pdf") {
    return "document";
  }

  if (format === "docx") {
    return "word document";
  }

  return "image export";
}

export function getSelectionMessage(file: FileDescriptor, kind: InputKind) {
  if (kind === "text") {
    return `${file.name} 파일명을 기준으로 텍스트 파일로 인식했습니다. 현재 TXT는 PDF와 Word(.docx) 출력만 지원합니다.`;
  }

  const detectedAs = kind === "pdf" ? "PDF 문서" : "이미지 파일";
  return `${file.name} 파일명을 기준으로 ${detectedAs}로 인식했습니다.`;
}

export function getFileInsight(
  file: FileDescriptor,
  inputKind: InputKind | null,
  targetFormat: OutputFormat,
): FileInsight {
  const extension = getFileExtension(file.name);

  return {
    availableOutputs:
      inputKind === "pdf"
        ? "PNG, JPG, WEBP"
        : inputKind === "text"
          ? "PDF, WORD(.docx)"
          : "PDF, PNG, JPG, WEBP",
    caution: getFileCaution(file, inputKind),
    detectedLabel: extension
      ? `${extension.toUpperCase()} 확장자로 감지됨`
      : "파일 형식 감지됨",
    inputLabel: getInputLabel(inputKind),
    outputPreview: getOutputPreview(file, inputKind, targetFormat),
  };
}

export function getInputLabel(inputKind: InputKind | null) {
  if (inputKind === "pdf") {
    return "PDF 문서";
  }

  if (inputKind === "text") {
    return "텍스트 파일";
  }

  return "이미지 파일";
}

export function getOutputPreview(
  file: FileDescriptor,
  inputKind: InputKind | null,
  targetFormat: OutputFormat,
) {
  if (inputKind === "pdf") {
    return `${stripExtension(file.name)}-page-01.${OUTPUT_EXTENSION[targetFormat]} · 여러 페이지면 zip`;
  }

  return `${stripExtension(file.name)}.${OUTPUT_EXTENSION[targetFormat]}`;
}

export function normalizeTextContent(text: string) {
  return text.replace(/\r\n?/g, "\n").replace(/\t/g, "    ");
}

function getFileExtension(name: string) {
  const match = name.toLowerCase().match(/\.([^.]+)$/);
  return match?.[1] ?? "";
}

function getFileCaution(file: FileDescriptor, inputKind: InputKind | null) {
  if (typeof file.size !== "number") {
    return null;
  }

  if (inputKind === "pdf" && file.size >= 20 * MB) {
    return "용량이 큰 PDF는 페이지 수에 따라 브라우저 메모리를 많이 사용할 수 있습니다.";
  }

  if (inputKind === "image" && file.size >= 15 * MB) {
    return "고해상도 이미지는 변환 중 메모리 사용량이 커질 수 있습니다.";
  }

  if (inputKind === "text" && file.size >= 1 * MB) {
    return "긴 TXT 파일은 PDF 변환 시 페이지 수가 많아질 수 있습니다.";
  }

  return null;
}
