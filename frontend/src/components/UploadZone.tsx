import { useRef, useState } from "react";
import { api } from "../api/client";

interface Message { type: "success" | "error"; text: string; }

export default function UploadZone({ onUploaded }: { onUploaded?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const pdfs = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) { setMessage({ type: "error", text: "only pdf files supported" }); return; }
    setUploading(true); setMessage(null);
    let uploaded = 0;
    for (const file of pdfs) {
      try { await api.uploadDocument(file); uploaded++; }
      catch (e) { setMessage({ type: "error", text: `failed: ${file.name} — ${e instanceof Error ? e.message : e}` }); }
    }
    setUploading(false);
    if (uploaded > 0) {
      setMessage({ type: "success", text: `${uploaded} file${uploaded > 1 ? "s" : ""} queued. extraction runs in background.` });
      onUploaded?.();
    }
  }

  return (
    <div
      role="region" aria-label="upload pdfs"
      className={`rounded border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
        dragging ? "border-sea-500 bg-sea-50" : "border-hairline hover:border-sea-300 bg-white"
      }`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); void handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      onKeyDown={e => e.key === "Enter" && inputRef.current?.click()}
      tabIndex={0}
    >
      <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden"
        onChange={e => void handleFiles(e.target.files)} />
      <div className="space-y-1.5 pointer-events-none">
        <div className="text-2xl">📄</div>
        <p className="text-sm text-gray-600">drop pdfs here or <span className="text-sea-600 underline">browse</span></p>
        <p className="text-xs text-gray-400">extraction runs after upload</p>
      </div>
      {uploading && <p className="mt-3 text-sm text-sea-600">uploading…</p>}
      {message && (
        <p className={`mt-3 text-xs ${message.type === "error" ? "text-terra-600" : "text-sea-600"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
