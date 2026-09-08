import type { Fact } from "../api/client";
import FactTypeBadge from "./FactTypeBadge";

interface Props { fact: Fact; isSelected: boolean; onClick: () => void; }

export default function FactCard({ fact, isSelected, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded border px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 ${
        isSelected
          ? "border-sea-500 bg-sea-50 ring-1 ring-sea-500/20"
          : "border-hairline bg-white hover:border-sea-300 hover:bg-sea-50/40"
      }`}
      aria-pressed={isSelected}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-sm font-medium text-gray-900 leading-snug line-clamp-2 flex-1">{fact.subject}</span>
        <FactTypeBadge type={fact.fact_type} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {fact.value && (
          <span className="font-mono text-sea-700 font-medium">
            {fact.value}{fact.unit && <span className="text-gray-400 ml-0.5">{fact.unit}</span>}
          </span>
        )}
        {fact.period_normalized && <span className="font-mono text-gray-500">{fact.period_normalized}</span>}
        {fact.scope && <span className="text-gray-400 italic">{fact.scope}</span>}
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
        <span className="truncate max-w-[160px]" title={fact.source_doc}>{fact.source_doc?.replace(/\.pdf$/i, "")}</span>
        {fact.page != null && <span>p.{fact.page}</span>}
      </div>
    </button>
  );
}
