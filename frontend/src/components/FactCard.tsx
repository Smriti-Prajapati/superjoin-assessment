import type { Fact } from "../api/client";
import FactTypeBadge from "./FactTypeBadge";

interface Props { fact:Fact; isSelected:boolean; onClick:()=>void; }

export default function FactCard({ fact, isSelected, onClick }: Props) {
  return (
    <button onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-all focus:outline-none ${
        isSelected
          ? "border-sea-400 bg-white shadow-sm ring-1 ring-sea-400/20"
          : "border-hairline bg-white hover:border-sea-200 hover:shadow-sm"
      }`}
      aria-pressed={isSelected}>

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {fact.value && (
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-xl font-bold text-gray-900">{fact.value}</span>
              {fact.unit && <span className="text-sm text-gray-400">{fact.unit}</span>}
              {fact.period_normalized && <span className="text-xs font-mono text-gray-400 ml-1">{fact.period_normalized}</span>}
            </div>
          )}
          <p className="text-xs text-gray-600 leading-snug line-clamp-2">{fact.subject}</p>
          {fact.scope && <p className="text-xs text-gray-400 italic mt-0.5">{fact.scope}</p>}
        </div>
        <FactTypeBadge type={fact.fact_type}/>
      </div>

      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x=".75" y=".75" width="8.5" height="8.5" rx="1.25" stroke="#9ca3af" strokeWidth="1" fill="none"/><line x1="2" y1="3.5" x2="8" y2="3.5" stroke="#9ca3af" strokeWidth=".9" strokeLinecap="round"/><line x1="2" y1="5.5" x2="6" y2="5.5" stroke="#9ca3af" strokeWidth=".9" strokeLinecap="round" opacity=".6"/></svg>
        <span className="truncate max-w-[180px]" title={fact.source_doc}>
          {fact.source_doc?.replace(/\.pdf$/i,"").replace(/^\d{2}[-_]/,"").replace(/[-_]/g," ")}
        </span>
        {fact.page!=null && <span className="flex-shrink-0">· p.{fact.page}</span>}
      </div>
    </button>
  );
}
