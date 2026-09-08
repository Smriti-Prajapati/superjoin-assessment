import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Document, DocProgress } from "../api/client";

const STAGE_LABEL: Record<string, string> = {
  queued:     "queued",
  extracting: "extracting",
  embedding:  "embedding",
  linking:    "linking",
  done:       "",
};

const STAGE_DOT: Record<string, string> = {
  queued:     "bg-gray-300",
  extracting: "bg-sea-400 animate-pulse",
  embedding:  "bg-lavender-400 animate-pulse",
  linking:    "bg-amber-400 animate-pulse",
  done:       "bg-sea-500",
};

interface Props { doc: Document; }

export default function DocProgressBar({ doc }: Props) {
  const [progress, setProgress] = useState<DocProgress | null>(null);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      while (!stopped) {
        try {
          const p = await api.getProgress(doc.id);
          setProgress(p);
          if (p.stage === "done") break;
        } catch { /* ignore */ }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    void poll();
    return () => { stopped = true; };
  }, [doc.id]);

  const stage = progress?.stage ?? "queued";
  const dot = STAGE_DOT[stage] ?? "bg-gray-300";
  const label = STAGE_LABEL[stage] ?? stage;

  if (stage === "done") return null;

  return (
    <div className="flex items-center gap-1 mt-0.5 pl-3">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-xs text-gray-400 italic">
        {label}
        {stage === "extracting" && progress && progress.batches_total > 0 &&
          ` ${progress.batches_done}/${progress.batches_total}`}
        {progress && progress.facts_found > 0 &&
          <span className="ml-1 not-italic text-gray-300">{progress.facts_found} facts</span>}
      </span>
    </div>
  );
}
