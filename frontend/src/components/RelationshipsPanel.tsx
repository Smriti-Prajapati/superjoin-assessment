import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Fact, Relationship } from "../api/client";
import RelationshipBadge from "./RelationshipBadge";

const FILTERS = [
  { value: "",                       label: "all" },
  { value: "corroborates",           label: "corroborates" },
  { value: "contradicts",            label: "contradicts" },
  { value: "reconciled_by_context",  label: "reconciled" },
  { value: "related",                label: "related" },
];

interface Props {
  onSelectFact?: (f: Partial<Fact>) => void;
  externalFilter?: string;
  onFilterChange?: (f: string) => void;
}

export default function RelationshipsPanel({ onSelectFact, externalFilter, onFilterChange }: Props) {
  const [rels, setRels]   = useState<Relationship[]>([]);
  const [filter, setFilter] = useState(externalFilter ?? "");
  const [loading, setLoading] = useState(true);

  // sync external filter
  useEffect(() => {
    if (externalFilter !== undefined) setFilter(externalFilter);
  }, [externalFilter]);

  useEffect(() => {
    setLoading(true);
    api.listRelationships({ limit: 300, ...(filter ? { relationship_type: filter } : {}) })
      .then(setRels).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  function handleFilter(v: string) {
    setFilter(v);
    onFilterChange?.(v);
  }

  return (
    <div className="h-full flex flex-col">
      {/* filter tabs */}
      <div className="flex gap-1.5 p-3 border-b border-hairline flex-wrap flex-shrink-0">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => handleFilter(f.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors focus:outline-none ${
              filter === f.value
                ? "bg-sea-600 text-white"
                : "bg-white border border-hairline text-gray-600 hover:border-sea-400"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-xs text-gray-400 text-center py-8">loading…</p>}
        {!loading && rels.length === 0 && (
          <div className="text-center py-12 space-y-1">
            <p className="text-sm text-gray-500">no relationships found</p>
            <p className="text-xs text-gray-400">upload and process documents to see links</p>
          </div>
        )}

        {rels.map(rel => (
          <article key={rel.id} className="rounded border border-hairline bg-white p-3 space-y-2">
            <div className="flex items-center gap-2">
              <RelationshipBadge type={rel.relationship_type} />
              {rel.confidence != null && (
                <span className="text-xs text-gray-400 font-mono">{(rel.confidence * 100).toFixed(0)}%</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {([
                { id: rel.fact_id_a, subject: rel.subject_a, value: rel.value_a, unit: rel.unit_a, source: rel.source_a, page: rel.page_a, period: rel.period_a, type: rel.type_a, entity: rel.entity_a },
                { id: rel.fact_id_b, subject: rel.subject_b, value: rel.value_b, unit: rel.unit_b, source: rel.source_b, page: rel.page_b, period: rel.period_b, type: rel.type_b, entity: rel.entity_b },
              ] as const).map((side, i) => (
                <button key={i}
                  onClick={() => onSelectFact?.({ id: side.id, subject: side.subject, value: side.value, unit: side.unit, source_doc: side.source, page: side.page, period_normalized: side.period, fact_type: side.type, entity: side.entity })}
                  className="text-left rounded border border-hairline p-2 hover:border-sea-300 hover:bg-sea-50/40 transition-colors focus:outline-none">
                  <p className="font-medium text-gray-800 leading-snug line-clamp-2 mb-0.5">{side.subject}</p>
                  {side.value && (
                    <p className="font-mono font-semibold text-sea-700 text-xs">
                      {side.value}{side.unit ? ` ${side.unit}` : ""}
                    </p>
                  )}
                  <p className="text-gray-400 text-xs truncate mt-0.5">{side.source?.replace(/\.pdf$/i, "")} p.{side.page}</p>
                </button>
              ))}
            </div>
            {rel.explanation && (
              <p className="text-xs text-gray-500 leading-relaxed border-t border-hairline pt-2">{rel.explanation}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
