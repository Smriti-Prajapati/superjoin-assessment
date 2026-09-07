import { useRef, useState } from "react";
import { api } from "../api/client";

export default function UploadZone({ onUploaded }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null); // {type: "success"|"error", text}

  async function handleFiles(files) {
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) {
      setMessage({ type: "error", text: "Only PDF files are supported." });
      return;
    }
    setUploading(true);
    setMessage(null);
    let uploaded = 0;
    for (const file of pdfs) {
      try {
        await api.uploadDocument(file);
        uploaded++;
      } catch (e) {
        setMessage({ type: "error", text: `Failed: ${file.name} — ${e.message}` });
      }
    }
    setUploading(false);
    if (uploaded > 0) {
      setMessage({
        type: "success",
        text: `${uploaded} file${uploaded > 1 ? "s" : ""} queued. Extraction runs in the background.`,
      });
      onUploaded?.();
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div
      role="region"
      aria-label="Upload PDF documents"
      className={`rounded border-2 border-dashed p-5 text-center transition-colors cursor-pointer ${
        dragging ? "border-sea-500 bg-sea-50" : "border-hairline hover:border-sea-300 bg-white"
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        multiple
        className="hidden"
        aria-label="Select PDF files"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="space-y-1.5 pointer-events-none">
        <div className="text-2xl">📄</div>
        <p className="text-sm text-gray-600">
          Drop PDFs here or <span className="text-sea-600 underline">browse</span>
        </p>
        <p className="text-xs text-gray-400">Extraction runs after upload</p>
      </div>
      {uploading && <p className="mt-3 text-sm text-sea-600">Uploading…</p>}
      {message && (
        <p
          className={`mt-3 text-xs ${
            message.type === "error" ? "text-terra-600" : "text-sea-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
