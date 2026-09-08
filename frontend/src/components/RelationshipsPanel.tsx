import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Fact, Relationship } from "../api/client";
import RelationshipBadge from "./RelationshipBadge";

interface Counts {
  corroborates: number;
  contradicts: number;
  reconciled_by_context: number;
  related: number;
}

const TYPE_FILTERS = [
  { value: "",                       label: "All" },
  { value: "corroborates",           label: "Corroborates" },
  { value: "contradicts",            label: "Contradicts" },
  { value: "reconciled_by_context",  label: "Reconciled" },
  { value: "related",                label: "Related" },
];

const SUMMARY_ITEMS = [
  { type: "corroborates",          label: "Corroborated", dot: "bg-sea-500",      pill: "bg-sea-50 text-sea-700 border-sea-200"           },
  { type: "contradicts",           label: "Contradicted", dot: "bg-terra-500",    pill: "bg-terra-50 text-terra-700 border-terra-200"     },
  { type: "reconciled_by_context", label: "Reconciled",   dot: "bg-lavender-500", pill: "bg-lavender-50 text-lavender-700 border-lavender-200" },
  { type: "related",               label: "Related",      dot: "bg-gray-400",     pill: "bg-gray-50 text-gray-600 border-gray-200"        },
] as const;

interface Props {
  onSelectFact?: (f: Partial<Fact>) => void;
  externalFilter?: string;
  onFilterChange?: (f: string) => void;
}

export default function RelationshipsPanel({ onSelectFact, externalFilter, onFilterChange }: Props) {
  const [rels, setRels]         = useState<Relationship[]>([]);
  const [counts, setCounts]     = useState<Counts>({ corroborates: 0, contradicts: 0, reconciled_by_context: 0, related: 0 });
  const [filter, setFilter]     = useState(externalFilter ?? "");
  const [loading, setLoading]   = useState(true);

  // load total counts once (unfiltered)
  useEffect(() => {
    api.listRelationships({ limit: 2000 }).then(all => {
      const c: Counts = { corroborates: 0, contradicts: 0, reconciled_by_context: 0, related: 0 };
      for (const r of all) {
        const t = r.relationship_type as keyof Counts;
        if (t in c) c[t]++;
      }
      setCounts(c);
    }).catch(console.error);
  }, []);

  // sync external filter from case-summary click
  useEffect(() => {
    if (externalFilter !== undefined) setFilter(externalFilter);
  }, [externalFilter]);

  useEffect(() => {
    setLoading(true);
    api.listRelationships({ limit: 1000, ...(filter ? { relationship_type: filter } : {}) })
      .then(setRels).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  function handleFilter(v: string) {
    const next = filter === v ? "" : v;  // toggle off if already active
    setFilter(next);
    onFilterChange?.(next);
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div className="h-full flex flex-col">

      {/* ── case summary row ─────────────────────────────────────────── */}
      {total > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-hairline bg-white flex-shrink-0 flex-wrap">
          {SUMMARY_ITEMS.map(({ type, label, dot, pill }) => {
            const n = counts[type as keyof Counts];
            if (n === 0) return null;
            const active = filter === type;
            return (
              <button
                key={type}
                onClick={() => handleFilter(type)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all ${pill} ${
                  active ? "ring-1 ring-offset-1 ring-current shadow-sm" : "hover:opacity-80"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
                {n} {label}
              </button>
            );
          })}
          {filter && (
            <button onClick={() => handleFilter("")}
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-1">
              clear
            </button>
          )}
        </div>
      )}

      {/* ── type filter tabs ─────────────────────────────────────────── */}
      <div className="flex gap-1 px-3 py-2 border-b border-hairline bg-white flex-shrink-0 flex-wrap">
        {TYPE_FILTERS.map(f => (
          <button key={f.value} onClick={() => handleFilter(f.value)}
            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-colors focus:outline-none ${
              filter === f.value
                ? "bg-sea-600 text-white"
                : "bg-white border border-hairline text-gray-500 hover:border-sea-400 hover:text-sea-700"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* ── list ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-xs text-gray-400 text-center py-8">loading…</p>}
        {!loading && rels.length === 0 && (
          <div className="text-center py-12 space-y-1">
            <p className="text-sm text-gray-500">no relationships found</p>
            <p className="text-xs text-gray-400">process more documents to see cross-doc links</p>
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
                  <p className="text-gray-400 text-xs truncate mt-0.5">
                    {side.source?.replace(/\.pdf$/i, "")} p.{side.page}
                  </p>
                </button>
              ))}
            </div>
            {rel.explanation && (
              <p className="text-xs text-gray-500 leading-relaxed border-t border-hairline pt-2">
                {rel.explanation}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
