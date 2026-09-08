import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Counts {
  corroborates: number;
  contradicts: number;
  reconciled_by_context: number;
  related: number;
}

interface Props {
  activeFilter: string;
  onFilter: (type: string) => void;
}

export default function CaseSummary({ activeFilter, onFilter }: Props) {
  const [counts, setCounts] = useState<Counts>({ corroborates: 0, contradicts: 0, reconciled_by_context: 0, related: 0 });

  useEffect(() => {
    api.listRelationships({ limit: 2000 }).then(rels => {
      const c: Counts = { corroborates: 0, contradicts: 0, reconciled_by_context: 0, related: 0 };
      for (const r of rels) {
        const t = r.relationship_type as keyof Counts;
        if (t in c) c[t]++;
      }
      setCounts(c);
    }).catch(console.error);
  }, []);

  const items = [
    { type: "corroborates",          label: "Corroborated",  color: "text-sea-700   bg-sea-50   border-sea-200",   dot: "bg-sea-500"      },
    { type: "contradicts",           label: "Contradicted",  color: "text-terra-700 bg-terra-50  border-terra-200", dot: "bg-terra-500"    },
    { type: "reconciled_by_context", label: "Reconciled",    color: "text-lavender-700 bg-lavender-50 border-lavender-200", dot: "bg-lavender-500" },
    { type: "related",               label: "Related only",  color: "text-gray-600  bg-gray-50  border-gray-200",  dot: "bg-gray-400"     },
  ] as const;

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  if (total === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-hairline bg-[#FAFAF8] flex-shrink-0 flex-wrap">
      <span className="text-xs text-gray-400 mr-1">cases:</span>
      {items.map(({ type, label, color, dot }) => {
        const n = counts[type];
        if (n === 0) return null;
        const active = activeFilter === type;
        return (
          <button
            key={type}
            onClick={() => onFilter(active ? "" : type)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${color} ${
              active ? "ring-1 ring-offset-1 ring-current" : "hover:opacity-80"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dot} inline-block`} />
            {n} {label}
          </button>
        );
      })}
    </div>
  );
}
