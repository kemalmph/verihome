"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { compressImage, formatFileSize } from "@/lib/compression";
import type { PhotoCategory } from "@/types/property";

interface PhotoUploadProps {
  propertyId: string;
  category: PhotoCategory;
  existingPhotos: string[];
  onUpdate: (photos: string[]) => void;
  minPhotos?: number;
  maxPhotos?: number;
}

type FileStatus = "pending" | "compressing" | "uploading" | "done" | "error";

interface FileItem {
  id: string;
  file: File;
  status: FileStatus;
  progress: number;
  originalSize: number;
  compressedSize?: number;
  url?: string;
  error?: string;
}

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic"];
const MAX_BYTES = 20 * 1024 * 1024;

export function PhotoUpload({
  propertyId,
  category,
  existingPhotos,
  onUpdate,
  minPhotos = 0,
  maxPhotos = 25,
}: PhotoUploadProps) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [queue, setQueue] = useState<FileItem[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isProcessing = queue.some((f) => f.status === "compressing" || f.status === "uploading");

  function updateItem(id: string, patch: Partial<FileItem>) {
    setQueue((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function handleFiles(files: FileList) {
    setGlobalError(null);
    setSuccessMsg(null);

    const valid: FileItem[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) {
        setGlobalError(`"${file.name}" is not a supported image type.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setGlobalError(`"${file.name}" exceeds the 20 MB limit.`);
        continue;
      }
      if (photos.length + valid.length >= maxPhotos) {
        setGlobalError(`Maximum ${maxPhotos} photos per category.`);
        break;
      }
      valid.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        status: "pending",
        progress: 0,
        originalSize: file.size,
      });
    }

    if (!valid.length) return;
    setQueue((prev) => [...prev, ...valid]);

    // Process sequentially
    const uploaded: string[] = [];
    for (const item of valid) {
      // Compress
      updateItem(item.id, { status: "compressing" });
      let compressed: File;
      try {
        compressed = await compressImage(item.file);
        updateItem(item.id, { compressedSize: compressed.size });
      } catch {
        updateItem(item.id, { status: "error", error: "Compression failed" });
        continue;
      }

      // Upload with XHR for progress
      updateItem(item.id, { status: "uploading", progress: 0 });
      try {
        const url = await uploadWithProgress(compressed, item.file.name, propertyId, category, (pct) =>
          updateItem(item.id, { progress: pct })
        );
        updateItem(item.id, { status: "done", url, progress: 100 });
        uploaded.push(url);
        setPhotos((prev) => {
          const next = [...prev, url];
          onUpdate(next);
          return next;
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        updateItem(item.id, { status: "error", error: msg });
      }
    }

    if (uploaded.length > 0) {
      setSuccessMsg(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
    // Clear completed items after a delay
    setTimeout(() => setQueue((prev) => prev.filter((f) => f.status === "error")), 3000);
  }

  async function handleDelete(url: string) {
    try {
      await fetch("/api/admin/upload/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, propertyId, category }),
      });
      setPhotos((prev) => {
        const next = prev.filter((u) => u !== url);
        onUpdate(next);
        return next;
      });
    } catch {
      setGlobalError("Failed to delete photo.");
    }
  }

  const processing = queue.filter((f) => f.status === "compressing" || f.status === "uploading");
  const totalInQueue = queue.filter((f) => f.status !== "pending").length;
  const doneInQueue = queue.filter((f) => f.status === "done").length;
  const errorsInQueue = queue.filter((f) => f.status === "error");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#3e4944]">
          <span className={photos.length >= minPhotos ? "text-[#1a7a5e] font-bold" : "text-amber-600 font-bold"}>
            {photos.length}
          </span>
          {" / "}
          <span className="font-medium">{maxPhotos} photos</span>
          {minPhotos > 0 && (
            <span className="text-[#6e7a74] ml-1">(min {minPhotos})</span>
          )}
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={isProcessing || photos.length >= maxPhotos}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a7a5e] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          <span className="material-symbols-outlined text-base">add_photo_alternate</span>
          Add Photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Errors */}
      {globalError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {globalError}
        </div>
      )}
      {successMsg && (
        <div className="p-3 bg-[#e8f5f0] border border-[#9cf4d1] text-[#1a7a5e] text-sm rounded-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {successMsg}
        </div>
      )}

      {/* Processing queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {processing.length > 0 && (
            <p className="text-xs text-[#6e7a74]">
              Processing {doneInQueue + 1} of {totalInQueue} photos…
            </p>
          )}
          {queue.map((item) => (
            <QueueItem key={item.id} item={item} onRetry={() => handleFiles(makeFileList([item.file]))} />
          ))}
        </div>
      )}

      {/* Retry failed */}
      {errorsInQueue.length > 0 && (
        <button
          onClick={() => handleFiles(makeFileList(errorsInQueue.map((f) => f.file)))}
          className="text-xs text-[#1a7a5e] underline"
        >
          Retry {errorsInQueue.length} failed photo{errorsInQueue.length > 1 ? "s" : ""}
        </button>
      )}

      {/* Photo grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {photos.map((url, i) => (
            <div key={url} className="relative rounded-lg overflow-hidden aspect-video bg-[#e4e2e1] group">
              <Image
                src={url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 33vw, 200px"
              />
              <button
                onClick={() => handleDelete(url)}
                className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Remove photo"
              >
                <span className="material-symbols-outlined text-xs">close</span>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-[#cccccc] rounded-xl p-10 text-center cursor-pointer hover:border-[#1a7a5e] transition-colors"
        >
          <span className="material-symbols-outlined text-4xl text-[#bec9c2] block mb-2">add_photo_alternate</span>
          <p className="text-sm text-[#6e7a74]">Click to add photos</p>
          <p className="text-xs text-[#bec9c2] mt-1">JPEG, PNG, WEBP, HEIC · max 20 MB each</p>
        </div>
      )}
    </div>
  );
}

// ── Queue item row ─────────────────────────────────────────────────────────────

function QueueItem({ item, onRetry }: { item: FileItem; onRetry: () => void }) {
  return (
    <div className="bg-[#f6f3f2] rounded-lg p-3 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#1b1c1c] font-medium truncate max-w-[60%]">{item.file.name}</span>
        <span className="text-[#6e7a74]">
          {item.status === "compressing" && "Compressing…"}
          {item.status === "uploading" && `Uploading… ${item.progress}%`}
          {item.status === "done" && "✓ Done"}
          {item.status === "error" && (
            <button onClick={onRetry} className="text-red-600 underline">Retry</button>
          )}
        </span>
      </div>
      {item.compressedSize && item.status !== "pending" && (
        <p className="text-[10px] text-[#6e7a74]">
          {formatFileSize(item.originalSize)} → {formatFileSize(item.compressedSize)}
        </p>
      )}
      {(item.status === "uploading") && (
        <div className="w-full bg-[#e4e2e1] h-1 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#1a7a5e] transition-all"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      )}
      {item.error && <p className="text-[10px] text-red-600">{item.error}</p>}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeFileList(files: File[]): FileList {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return dt.files;
}

async function uploadWithProgress(
  file: File,
  originalName: string,
  propertyId: string,
  category: PhotoCategory,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file, originalName);
    fd.append("propertyId", propertyId);
    fd.append("category", category);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.url) resolve(res.url);
          else reject(new Error(res.error ?? "Upload failed"));
        } catch {
          reject(new Error("Invalid server response"));
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          reject(new Error(res.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(fd);
  });
}
