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
          : "border-hairline bg-white hover:border-sea-200 hover:bg-sea-50/30"
      }`}
      aria-pressed={isSelected}
    >
      {/* subject — primary label */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-gray-700 leading-snug line-clamp-2 flex-1">
          {fact.subject}
        </span>
        {/* badge is quieter — smaller text, no bold */}
        <FactTypeBadge type={fact.fact_type} />
      </div>

      {/* value — loudest element */}
      {fact.value && (
        <div className="mb-1">
          <span className="font-mono text-sm font-bold text-sea-700">
            {fact.value}
          </span>
          {fact.unit && (
            <span className="font-mono text-xs text-gray-400 ml-1">{fact.unit}</span>
          )}
          {fact.period_normalized && (
            <span className="font-mono text-xs text-gray-400 ml-2">{fact.period_normalized}</span>
          )}
          {fact.scope && (
            <span className="text-xs text-gray-400 italic ml-2">{fact.scope}</span>
          )}
        </div>
      )}

      {/* source */}
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span className="truncate max-w-[180px]" title={fact.source_doc}>
          {fact.source_doc?.replace(/\.pdf$/i, "")}
        </span>
        {fact.page != null && <span>p.{fact.page}</span>}
      </div>
    </button>
  );
}
