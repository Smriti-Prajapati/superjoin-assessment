import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Fact, Relationship } from "../api/client";
import RelationshipBadge from "./RelationshipBadge";
import FactTypeBadge from "./FactTypeBadge";

export default function EvidencePanel({ factId, onClose }: { factId: number; onClose: () => void }) {
  const [fact, setFact]     = useState<Fact | null>(null);
  const [rels, setRels]     = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);

  // Always fetch the canonical fact from the API — never trust partial data from the list
  useEffect(() => {
    if (!factId) return;
    setFact(null); setRels([]); setLoading(true);
    Promise.all([
      api.getFact(factId),
      api.getFactRelationships(factId),
    ])
      .then(([f, r]) => { setFact(f); setRels(r); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [factId]);

  return (
    <aside className="h-full flex flex-col border-l border-hairline bg-white" aria-label="evidence panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800">evidence</span>
        <button onClick={onClose} aria-label="close"
          className="text-gray-400 hover:text-gray-700 text-xl leading-none focus:outline-none rounded">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {loading && <p className="text-xs text-gray-400 text-center py-8">loading…</p>}

        {!loading && fact && (
          <>
            {/* identity */}
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <FactTypeBadge type={fact.fact_type} />
                {fact.estimate_or_actual && fact.estimate_or_actual !== "unknown" && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border bg-gray-50 text-gray-500 border-gray-200">
                    {fact.estimate_or_actual}
                  </span>
                )}
              </div>
              <h2 className="text-sm font-semibold text-gray-900 leading-snug">{fact.subject}</h2>
              {fact.entity && fact.entity !== fact.subject &&
                <p className="text-xs text-gray-500 mt-0.5">{fact.entity}</p>}
            </div>

            {/* value — visually loudest element */}
            {fact.value && (
              <div className="rounded border border-hairline bg-[#FAFAF8] px-3 py-2.5">
                <span className="font-mono text-base font-bold text-sea-700">
                  {fact.value}
                  {fact.unit && <span className="text-gray-400 font-normal text-sm ml-1">{fact.unit}</span>}
                </span>
              </div>
            )}

            {/* meta */}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {(fact.period_normalized ?? fact.period) && (
                <><dt className="text-gray-400">period</dt>
                  <dd className="font-mono text-gray-700">{fact.period_normalized ?? fact.period}</dd></>
              )}
              {fact.scope && (
                <><dt className="text-gray-400">scope</dt><dd className="text-gray-700">{fact.scope}</dd></>
              )}
              {fact.as_of_date && (
                <><dt className="text-gray-400">as-of</dt>
                  <dd className="font-mono text-gray-700">{fact.as_of_date}</dd></>
              )}
              <dt className="text-gray-400">source</dt>
              <dd className="text-gray-700 truncate" title={fact.source_doc}>
                {fact.source_doc?.replace(/\.pdf$/i, "")}
              </dd>
              {fact.page != null && (
                <><dt className="text-gray-400">page</dt>
                  <dd className="font-mono text-gray-700">{fact.page}</dd></>
              )}
            </dl>

            {/* evidence snippet — monospace to visually distinguish quoted text */}
            {fact.evidence_snippet && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">evidence snippet</p>
                <blockquote className="font-mono text-xs text-gray-700 bg-lavender-50 border-l-2 border-lavender-300 px-3 py-2 rounded-r leading-relaxed">
                  {fact.evidence_snippet}
                </blockquote>
              </div>
            )}

            {/* linked facts */}
            <div>
              <p className="text-xs text-gray-400 mb-2">linked facts ({rels.length})</p>
              {rels.length === 0 &&
                <p className="text-xs text-gray-400 italic">no linked facts yet</p>}
              <div className="space-y-2">
                {rels.map(rel => {
                  const isA = rel.fact_id_a === fact.id;
                  const other = {
                    subject: isA ? rel.subject_b : rel.subject_a,
                    value:   isA ? rel.value_b   : rel.value_a,
                    unit:    isA ? rel.unit_b     : rel.unit_a,
                    source:  isA ? rel.source_b   : rel.source_a,
                    page:    isA ? rel.page_b     : rel.page_a,
                  };
                  return (
                    <div key={rel.id} className="rounded border border-hairline p-3 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <RelationshipBadge type={rel.relationship_type} />
                        <span className="text-xs text-gray-400 font-mono">
                          {other.source?.replace(/\.pdf$/i, "")} p.{other.page}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-800 leading-snug">{other.subject}</p>
                      {other.value && (
                        <p className="font-mono text-xs text-sea-600">
                          {other.value}{other.unit ? ` ${other.unit}` : ""}
                        </p>
                      )}
                      {rel.explanation && (
                        <p className="text-xs text-gray-500 leading-relaxed border-t border-hairline pt-1.5 mt-1.5">
                          {rel.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
