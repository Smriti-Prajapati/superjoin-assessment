import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Fact, Relationship } from "../api/client";
import FactTypeBadge from "./FactTypeBadge";

const REL_CFG = {
  corroborates:          { dot:"bg-sea-500",      label:"corroborates", text:"text-sea-700"      },
  contradicts:           { dot:"bg-terra-500",    label:"contradicts",  text:"text-terra-700"    },
  reconciled_by_context: { dot:"bg-lavender-500", label:"reconciled",   text:"text-lavender-700" },
  related:               { dot:"bg-gray-300",     label:"related",      text:"text-gray-500"     },
} as const;

export default function EvidencePanel({ factId, onClose }: { factId:number; onClose:()=>void }) {
  const [fact, setFact]       = useState<Fact|null>(null);
  const [rels, setRels]       = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    if(!factId) return;
    setFact(null); setRels([]); setLoading(true);
    Promise.all([api.getFact(factId), api.getFactRelationships(factId)])
      .then(([f,r])=>{ setFact(f); setRels(r); })
      .catch(console.error)
      .finally(()=>setLoading(false));
  },[factId]);

  return (
    <aside className="h-full flex flex-col bg-white" aria-label="evidence panel">
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800">Evidence</span>
        <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 text-lg">×</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <p className="text-xs text-gray-400 text-center py-10">loading…</p>}

        {!loading && fact && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-1.5">
              <FactTypeBadge type={fact.fact_type}/>
              {fact.estimate_or_actual && fact.estimate_or_actual!=="unknown" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs border bg-gray-50 text-gray-500 border-gray-200">{fact.estimate_or_actual}</span>
              )}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-900 leading-snug">{fact.subject}</h2>
              {fact.entity && fact.entity!==fact.subject && <p className="text-xs text-gray-400 mt-0.5">{fact.entity}</p>}
            </div>

            {fact.value && (
              <div className="rounded-xl border border-hairline bg-[#FAFAF8] px-4 py-3">
                <span className="text-2xl font-bold text-gray-900">{fact.value}</span>
                {fact.unit && <span className="text-base font-normal text-gray-400 ml-2">{fact.unit}</span>}
              </div>
            )}

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {(fact.period_normalized??fact.period) && (<><dt className="text-gray-400">Period</dt><dd className="font-mono text-gray-700">{fact.period_normalized??fact.period}</dd></>)}
              {fact.scope && (<><dt className="text-gray-400">Scope</dt><dd className="text-gray-700">{fact.scope}</dd></>)}
              {fact.as_of_date && (<><dt className="text-gray-400">As-of</dt><dd className="font-mono text-gray-700">{fact.as_of_date}</dd></>)}
              <dt className="text-gray-400">Source</dt>
              <dd className="text-gray-700 truncate" title={fact.source_doc}>{fact.source_doc?.replace(/\.pdf$/i,"")}</dd>
              {fact.page!=null && (<><dt className="text-gray-400">Page</dt><dd className="font-mono text-gray-700">{fact.page}</dd></>)}
            </dl>

            {fact.evidence_snippet && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Evidence snippet</p>
                <blockquote className="font-mono text-xs text-gray-700 bg-lavender-50 border-l-2 border-lavender-400 px-3 py-2.5 rounded-r leading-relaxed">
                  {fact.evidence_snippet}
                </blockquote>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Linked facts ({rels.length})</p>
              {rels.length===0 && <p className="text-xs text-gray-400 italic">no cross-document links yet</p>}
              <div className="space-y-2">
                {rels.map(rel=>{
                  const isA=rel.fact_id_a===fact.id;
                  const other={ subject:isA?rel.subject_b:rel.subject_a, value:isA?rel.value_b:rel.value_a, unit:isA?rel.unit_b:rel.unit_a, source:isA?rel.source_b:rel.source_a, page:isA?rel.page_b:rel.page_a };
                  const cfg=REL_CFG[rel.relationship_type as keyof typeof REL_CFG]??REL_CFG.related;
                  return (
                    <div key={rel.id} className="rounded-xl border border-hairline p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`}/>
                        <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.text}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-400 font-mono ml-auto">p.{other.page}</span>
                      </div>
                      {other.value && (
                        <p className="text-lg font-bold text-gray-900">
                          {other.value}{other.unit && <span className="text-sm font-normal text-gray-400 ml-1">{other.unit}</span>}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 leading-snug">{other.subject}</p>
                      <p className="text-xs text-sea-600 truncate">{other.source?.replace(/\.pdf$/i,"").replace(/^\d{2}[-_]/,"").replace(/[-_]/g," ")}</p>
                      {rel.explanation && <p className="text-xs text-gray-500 leading-relaxed border-t border-hairline pt-1.5">{rel.explanation}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
