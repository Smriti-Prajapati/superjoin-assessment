import { useEffect, useState } from "react";
import { api } from "../api/client";
import RelationshipBadge from "./RelationshipBadge";

const FILTERS = [
  { value: "",                       label: "All" },
  { value: "corroborates",           label: "Corroborates" },
  { value: "contradicts",            label: "Contradicts" },
  { value: "reconciled_by_context",  label: "Reconciled" },
];

export default function RelationshipsPanel({ onSelectFact }) {
  const [relationships, setRelationships] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 300 };
    if (filter) params.relationship_type = filter;
    api
      .listRelationships(params)
      .then(setRelationships)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const counts = relationships.reduce((acc, r) => {
    acc[r.relationship_type] = (acc[r.relationship_type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col">
      {/* filter tabs */}
      <div className="flex gap-1.5 p-3 border-b border-hairline flex-wrap flex-shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 ${
              filter === f.value
                ? "bg-sea-600 text-white"
                : "bg-white border border-hairline text-gray-600 hover:border-sea-400 hover:text-sea-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* summary chips */}
      {!loading && relationships.length > 0 && !filter && (
        <div className="flex gap-2 px-3 py-2 border-b border-hairline flex-wrap flex-shrink-0">
          {Object.entries(counts).map(([type, n]) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className="text-xs text-gray-500 hover:text-gray-800 underline"
            >
              {n} {type.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-8">Loading…</p>
        )}
        {!loading && relationships.length === 0 && (
          <div className="text-center py-12 space-y-1">
            <p className="text-sm text-gray-500">No relationships found.</p>
            <p className="text-xs text-gray-400">Upload and process documents to see links.</p>
          </div>
        )}

        {relationships.map((rel) => (
          <article
            key={rel.id}
            className="rounded border border-hairline bg-white p-3 space-y-2"
          >
            {/* badge + confidence */}
            <div className="flex items-center gap-2">
              <RelationshipBadge type={rel.relationship_type} />
              {rel.confidence != null && (
                <span className="text-xs text-gray-400 font-mono">
                  {(rel.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>

            {/* fact pair */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <FactSummaryButton
                subject={rel.subject_a}
                value={rel.value_a}
                unit={rel.unit_a}
                source={rel.source_a}
                page={rel.page_a}
                onClick={() =>
                  onSelectFact?.({
                    id: rel.fact_id_a,
                    subject: rel.subject_a,
                    value: rel.value_a,
                    unit: rel.unit_a,
                    source_doc: rel.source_a,
                    page: rel.page_a,
                    period_normalized: rel.period_a,
                    fact_type: rel.type_a,
                    entity: rel.entity_a,
                  })
                }
              />
              <FactSummaryButton
                subject={rel.subject_b}
                value={rel.value_b}
                unit={rel.unit_b}
                source={rel.source_b}
                page={rel.page_b}
                onClick={() =>
                  onSelectFact?.({
                    id: rel.fact_id_b,
                    subject: rel.subject_b,
                    value: rel.value_b,
                    unit: rel.unit_b,
                    source_doc: rel.source_b,
                    page: rel.page_b,
                    period_normalized: rel.period_b,
                    fact_type: rel.type_b,
                    entity: rel.entity_b,
                  })
                }
              />
            </div>

            {/* explanation */}
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

function FactSummaryButton({ subject, value, unit, source, page, onClick }) {
  return (
    <button
      onClick={onClick}
      className="text-left rounded border border-hairline p-2 hover:border-sea-300 hover:bg-sea-50/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500"
    >
      <p className="font-medium text-gray-800 leading-snug line-clamp-2 mb-0.5">{subject}</p>
      {value && (
        <p className="font-mono text-sea-600 text-xs">
          {value}{unit ? ` ${unit}` : ""}
        </p>
      )}
      <p className="text-gray-400 text-xs truncate mt-0.5">
        {source?.replace(/\.pdf$/i, "")} p.{page}
      </p>
    </button>
  );
}
