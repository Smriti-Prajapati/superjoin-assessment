import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Document, DocProgress } from "../api/client";

const STAGE_LABEL: Record<string, string> = {
  queued:     "queued",
  extracting: "extracting facts",
  embedding:  "embedding",
  linking:    "linking",
  done:       "done",
};

const STAGE_COLOR: Record<string, string> = {
  queued:     "bg-gray-300",
  extracting: "bg-sea-500",
  embedding:  "bg-lavender-500",
  linking:    "bg-amber-400",
  done:       "bg-sea-600",
};

interface Props {
  doc: Document;
}

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

  if (!progress || progress.stage === "done") return null;

  const pct = progress.batches_total > 0
    ? Math.round((progress.batches_done / progress.batches_total) * 100)
    : 0;

  const barColor = STAGE_COLOR[progress.stage] ?? "bg-sea-500";
  const stageLabel = STAGE_LABEL[progress.stage] ?? progress.stage;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="italic">{stageLabel}</span>
        <span className="font-mono text-gray-400">
          {progress.facts_found > 0 && `${progress.facts_found} facts`}
          {progress.stage === "extracting" && progress.batches_total > 0 &&
            ` · ${progress.batches_done}/${progress.batches_total} batches`}
        </span>
      </div>
      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
    </div>
  );
}
