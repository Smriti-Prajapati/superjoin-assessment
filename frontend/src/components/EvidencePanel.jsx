import { useEffect, useState } from "react";
import { api } from "../api/client";
import RelationshipBadge from "./RelationshipBadge";
import FactTypeBadge from "./FactTypeBadge";

export default function EvidencePanel({ fact, onClose }) {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fact?.id) return;
    setLoading(true);
    setRelationships([]);
    api
      .getFactRelationships(fact.id)
      .then(setRelationships)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [fact?.id]);

  if (!fact) return null;

  return (
    <aside
      className="h-full flex flex-col border-l border-hairline bg-white"
      aria-label="Evidence panel"
    >
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800">Evidence</span>
        <button
          onClick={onClose}
          aria-label="Close evidence panel"
          className="text-gray-400 hover:text-gray-700 text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 rounded"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* fact identity */}
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
          {fact.entity && fact.entity !== fact.subject && (
            <p className="text-xs text-gray-500 mt-0.5">{fact.entity}</p>
          )}
        </div>

        {/* value */}
        {fact.value && (
          <div className="rounded border border-hairline bg-gray-50 px-3 py-2.5">
            <span className="font-mono text-sm font-semibold text-sea-700">
              {fact.value}
              {fact.unit && <span className="text-gray-400 font-normal ml-1">{fact.unit}</span>}
            </span>
          </div>
        )}

        {/* meta */}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          {fact.period_normalized || fact.period ? (
            <>
              <dt className="text-gray-400">Period</dt>
              <dd className="font-mono text-gray-700">
                {fact.period_normalized || fact.period}
              </dd>
            </>
          ) : null}
          {fact.scope && (
            <>
              <dt className="text-gray-400">Scope</dt>
              <dd className="text-gray-700">{fact.scope}</dd>
            </>
          )}
          {fact.as_of_date && (
            <>
              <dt className="text-gray-400">As-of</dt>
              <dd className="font-mono text-gray-700">{fact.as_of_date}</dd>
            </>
          )}
          <dt className="text-gray-400">Source</dt>
          <dd className="text-gray-700 truncate" title={fact.source_doc}>
            {fact.source_doc?.replace(/\.pdf$/i, "")}
          </dd>
          {fact.page && (
            <>
              <dt className="text-gray-400">Page</dt>
              <dd className="font-mono text-gray-700">{fact.page}</dd>
            </>
          )}
        </dl>

        {/* evidence snippet */}
        {fact.evidence_snippet && (
          <div>
            <p className="text-xs text-gray-400 mb-1.5">Evidence snippet</p>
            <blockquote className="font-mono text-xs text-gray-700 bg-lavender-50 border-l-2 border-lavender-300 px-3 py-2 rounded-r leading-relaxed">
              {fact.evidence_snippet}
            </blockquote>
          </div>
        )}

        {/* linked facts */}
        <div>
          <p className="text-xs text-gray-400 mb-2">
            Linked facts{" "}
            {loading ? (
              <span className="text-gray-300">…</span>
            ) : (
              <span>({relationships.length})</span>
            )}
          </p>

          {!loading && relationships.length === 0 && (
            <p className="text-xs text-gray-400 italic">No linked facts yet.</p>
          )}

          <div className="space-y-2">
            {relationships.map((rel) => {
              const isA = rel.fact_id_a === fact.id;
              const other = {
                id:         isA ? rel.fact_id_b  : rel.fact_id_a,
                subject:    isA ? rel.subject_b   : rel.subject_a,
                value:      isA ? rel.value_b     : rel.value_a,
                unit:       isA ? rel.unit_b      : rel.unit_a,
                period:     isA ? rel.period_b    : rel.period_a,
                source_doc: isA ? rel.source_b    : rel.source_a,
                page:       isA ? rel.page_b      : rel.page_a,
              };
              return (
                <div
                  key={rel.id}
                  className="rounded border border-hairline p-3 space-y-1.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <RelationshipBadge type={rel.relationship_type} />
                    <span className="text-xs text-gray-400 font-mono">
                      {other.source_doc?.replace(/\.pdf$/i, "")} p.{other.page}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-800 leading-snug">
                    {other.subject}
                  </p>
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

      </div>
    </aside>
  );
}
