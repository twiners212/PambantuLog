/**
 * File Compression & Attachment Validation Utility for Client-Side Uploads
 * PambantuLog Helpdesk System
 *
 * Provides:
 * 1. Strict whitelist validation & executable blocking.
 * 2. Canvas-based adaptive image compression (Max width 1920px, WebP/JPEG, quality 0.7-0.8, target 300-600 KB).
 * 3. Safe passthrough for supported document types (.pdf, .log).
 */

export interface AttachmentValidationOptions {
  maxFiles?: number;
  maxRawSizeMb?: number;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  initialQuality?: number;
  minQuality?: number;
  targetMaxSizeKb?: number;
  targetMinSizeKb?: number;
  outputFormat?: "image/webp" | "image/jpeg";
}

export const ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
  ".log",
] as const;

export const BLOCKED_EXECUTABLE_EXTENSIONS = [
  ".exe",
  ".bat",
  ".sh",
  ".cmd",
  ".ps1",
  ".msi",
  ".vbs",
  ".bin",
  ".scr",
  ".dll",
  ".com",
  ".app",
  ".jar",
] as const;

export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
  "text/plain",
] as const;

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  files: File[];
}

/**
 * Validates a list of files against count, size, extension, and executable restrictions.
 */
export function validateAttachments(
  files: File[],
  options?: AttachmentValidationOptions
): ValidationResult {
  const maxFiles = options?.maxFiles ?? 5;
  const maxRawSizeMb = options?.maxRawSizeMb ?? 10;
  const maxRawSizeBytes = maxRawSizeMb * 1024 * 1024;

  if (files.length === 0) {
    return { isValid: true, files: [] };
  }

  if (files.length > maxFiles) {
    return {
      isValid: false,
      error: `Jumlah berkas melebihi batas maksimal (${maxFiles} berkas per tiket).`,
      files: [],
    };
  }

  for (const file of files) {
    const fileNameLower = file.name.toLowerCase();
    const fileExt = fileNameLower.includes(".")
      ? "." + fileNameLower.split(".").pop()!
      : "";

    // 1. Explicitly reject executables
    if (BLOCKED_EXECUTABLE_EXTENSIONS.some((ext) => fileExt === ext || fileNameLower.endsWith(ext))) {
      return {
        isValid: false,
        error: `Berkas "${file.name}" ditolak. Format berkas executable/skrip dilarang demi keamanan.`,
        files: [],
      };
    }

    // 2. Validate against whitelist extensions
    const isExtensionAllowed = ALLOWED_EXTENSIONS.some((ext) => fileExt === ext);
    if (!isExtensionAllowed) {
      return {
        isValid: false,
        error: `Format berkas "${file.name}" tidak diizinkan. Hanya menerima: ${ALLOWED_EXTENSIONS.join(", ")}.`,
        files: [],
      };
    }

    // 3. Check raw file size limit before compression
    if (file.size > maxRawSizeBytes) {
      return {
        isValid: false,
        error: `Berkas "${file.name}" terlalu besar (${(file.size / (1024 * 1024)).toFixed(1)} MB). Batas maksimum sebelum kompresi adalah ${maxRawSizeMb} MB.`,
        files: [],
      };
    }
  }

  return { isValid: true, files };
}

/**
 * Compresses an image File using HTML5 Canvas.
 * Passthrough if the file is PDF or text log.
 */
export async function compressImage(
  file: File,
  options?: CompressionOptions
): Promise<File> {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    return file;
  }

  const fileNameLower = file.name.toLowerCase();
  const isImage =
    file.type.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".webp"].some((ext) => fileNameLower.endsWith(ext));

  // Non-images (e.g. .pdf, .log) bypass compression
  if (!isImage) {
    return file;
  }

  const maxWidth = options?.maxWidth ?? 1920;
  const maxHeight = options?.maxHeight ?? 1920;
  const initialQuality = options?.initialQuality ?? 0.8;
  const minQuality = options?.minQuality ?? 0.65;
  const targetMaxSizeKb = options?.targetMaxSizeKb ?? 600;
  const outputFormat = options?.outputFormat ?? "image/webp";

  return new Promise<File>((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(objectUrl);

      try {
        let width = img.width;
        let height = img.height;

        // Calculate proportional scale if dimensions exceed max
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return resolve(file); // fallback to raw file if canvas context unavailable
        }

        // Draw with smooth interpolation
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Helper to convert canvas to blob with given quality and format
        let effectiveFormat = outputFormat;
        const getBlob = (quality: number, format = effectiveFormat): Promise<Blob | null> => {
          return new Promise((res) => {
            canvas.toBlob((blob) => res(blob), format, quality);
          });
        };

        let currentQuality = initialQuality;
        let blob = await getBlob(currentQuality, effectiveFormat);

        // If WebP is not supported or failed, fallback to JPEG
        if (!blob && effectiveFormat !== "image/jpeg") {
          effectiveFormat = "image/jpeg";
          blob = await getBlob(currentQuality, effectiveFormat);
        }

        if (!blob) {
          return resolve(file);
        }

        // Adaptive step-down: if blob is larger than targetMaxSizeKb, reduce quality
        const maxSizeBytes = targetMaxSizeKb * 1024;
        while (blob.size > maxSizeBytes && currentQuality > minQuality) {
          currentQuality = Math.max(minQuality, currentQuality - 0.05);
          const nextBlob = await getBlob(currentQuality, effectiveFormat);
          if (nextBlob) {
            blob = nextBlob;
          } else {
            break;
          }
        }

        // Generate compressed filename
        const ext = effectiveFormat === "image/webp" ? ".webp" : ".jpg";
        const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        const compressedFileName = `${baseName}-compressed${ext}`;

        const compressedFile = new File([blob], compressedFileName, {
          type: effectiveFormat,
          lastModified: Date.now(),
        });

        resolve(compressedFile);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback on image decode error
    };

    img.src = objectUrl;
  });
}

/**
 * Validates and compresses an array of files.
 */
export async function processAttachments(
  files: File[],
  validationOptions?: AttachmentValidationOptions,
  compressionOptions?: CompressionOptions
): Promise<File[]> {
  const validation = validateAttachments(files, validationOptions);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  const processed = await Promise.all(
    validation.files.map((f) => compressImage(f, compressionOptions))
  );

  return processed;
}
