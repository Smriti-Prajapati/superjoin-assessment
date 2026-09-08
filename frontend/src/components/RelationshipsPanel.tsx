import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Fact, Relationship } from "../api/client";

interface Counts { corroborates:number; contradicts:number; reconciled_by_context:number; related:number; }

const CFG = {
  corroborates:          { label:"Corroborates", short:"CORROBORATES", pill:"bg-sea-50 text-sea-700 border-sea-200",           dot:"bg-sea-500",      connector:"border-sea-300 text-sea-500",       sym:"≈" },
  contradicts:           { label:"Contradicts",  short:"CONTRADICTS",  pill:"bg-terra-50 text-terra-700 border-terra-200",     dot:"bg-terra-500",    connector:"border-terra-300 text-terra-500",   sym:"≠" },
  reconciled_by_context: { label:"Reconciled",   short:"RECONCILED",   pill:"bg-lavender-50 text-lavender-700 border-lavender-200", dot:"bg-lavender-500", connector:"border-lavender-300 text-lavender-500", sym:"~" },
  related:               { label:"Related",      short:"RELATED",      pill:"bg-gray-50 text-gray-500 border-gray-200",        dot:"bg-gray-300",     connector:"border-gray-200 text-gray-400",     sym:"·" },
} as const;
type RT = keyof typeof CFG;

const TABS = [
  { v:"",                       l:"All"        },
  { v:"corroborates",           l:"Corroborates"},
  { v:"contradicts",            l:"Contradicts" },
  { v:"reconciled_by_context",  l:"Reconciles"  },
  { v:"related",                l:"Related"     },
];

interface Props { onSelectFact?:(f:Partial<Fact>)=>void; externalFilter?:string; onFilterChange?:(f:string)=>void; }

function sd(s:string){ return s?.replace(/\.pdf$/i,"").replace(/^\d{2}[-_]/,"").replace(/[-_]/g," ").slice(0,32); }

function FactSide({ rel, side, onClick }: { rel:Relationship; side:"a"|"b"; onClick?:()=>void }) {
  const subject = side==="a" ? rel.subject_a : rel.subject_b;
  const value   = side==="a" ? rel.value_a   : rel.value_b;
  const unit    = side==="a" ? rel.unit_a    : rel.unit_b;
  const source  = side==="a" ? rel.source_a  : rel.source_b;
  const page    = side==="a" ? rel.page_a    : rel.page_b;
  const period  = side==="a" ? rel.period_a  : rel.period_b;

  return (
    <button onClick={onClick}
      className="flex-1 min-w-0 rounded-xl border border-hairline bg-[#FAFAF8] p-3 text-left hover:border-sea-200 hover:bg-sea-50/20 transition-colors focus:outline-none">
      {value && (
        <p className="text-xl font-bold text-gray-900 leading-tight mb-0.5">
          {value}{unit && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
        </p>
      )}
      {period && <p className="text-xs text-gray-400 mb-2">{period}</p>}
      <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">{subject}</p>
      <div className="flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x=".75" y=".75" width="8.5" height="8.5" rx="1.25" stroke="#9ca3af" strokeWidth="1" fill="none"/><line x1="2" y1="3.5" x2="8" y2="3.5" stroke="#9ca3af" strokeWidth=".9" strokeLinecap="round"/><line x1="2" y1="5.5" x2="6" y2="5.5" stroke="#9ca3af" strokeWidth=".9" strokeLinecap="round" opacity=".6"/></svg>
        <span className="text-xs text-sea-600 truncate">{sd(source??"")} · p.{page}</span>
      </div>
    </button>
  );
}

function RelCard({ rel, onSelectFact }: { rel:Relationship; onSelectFact?:Props["onSelectFact"] }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = CFG[rel.relationship_type as RT] ?? CFG.related;
  const selectA = () => onSelectFact?.({ id:rel.fact_id_a, subject:rel.subject_a, value:rel.value_a, unit:rel.unit_a, source_doc:rel.source_a, page:rel.page_a, period_normalized:rel.period_a, fact_type:rel.type_a, entity:rel.entity_a });
  const selectB = () => onSelectFact?.({ id:rel.fact_id_b, subject:rel.subject_b, value:rel.value_b, unit:rel.unit_b, source_doc:rel.source_b, page:rel.page_b, period_normalized:rel.period_b, fact_type:rel.type_b, entity:rel.entity_b });

  return (
    <article className="bg-white rounded-2xl border border-hairline shadow-sm overflow-hidden">
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${cfg.pill}`}>{cfg.short}</span>
          <span className="text-xs text-gray-400">{cfg.label === "Reconciled" ? "context explains it" : cfg.label === "Corroborates" ? "agreement" : cfg.label === "Contradicts" ? "conflict" : "see also"}</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900 leading-snug">{rel.subject_a}</h3>
        {rel.entity_a && rel.entity_a!==rel.subject_a && <p className="text-xs text-gray-400 mt-0.5">{rel.entity_a}</p>}
      </div>

      <div className="px-5 pb-3 flex gap-3 items-stretch">
        <FactSide rel={rel} side="a" onClick={selectA}/>
        <div className="flex-shrink-0 flex items-center justify-center w-7">
          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-sm font-bold ${cfg.connector}`}>
            {cfg.sym}
          </div>
        </div>
        <FactSide rel={rel} side="b" onClick={selectB}/>
      </div>

      {rel.explanation && (
        <div className="mx-5 mb-3 rounded-xl bg-gray-50 border border-hairline px-3 py-2.5">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide mr-2">Reasoning</span>
          <span className="text-xs text-gray-600 leading-relaxed">
            {expanded || rel.explanation.length<160 ? rel.explanation : rel.explanation.slice(0,160)+"…"}
          </span>
          {rel.explanation.length>=160 && (
            <button onClick={()=>setExpanded(v=>!v)} className="text-xs text-sea-600 hover:text-sea-700 ml-1 font-medium">
              {expanded?"less":"more"}
            </button>
          )}
        </div>
      )}

      <div className="border-t border-hairline px-5 py-2 flex items-center justify-between">
        <span className="text-xs text-gray-400">{rel.confidence!=null ? `${(rel.confidence*100).toFixed(0)}% confidence` : ""}</span>
        <button onClick={()=>{ setExpanded(v=>!v); }} className="text-xs text-sea-600 hover:text-sea-700 font-medium transition-colors">
          Inspect evidence & reasoning ↗
        </button>
      </div>
    </article>
  );
}

export default function RelationshipsPanel({ onSelectFact, externalFilter, onFilterChange }: Props) {
  const [rels, setRels]       = useState<Relationship[]>([]);
  const [counts, setCounts]   = useState<Counts>({ corroborates:0, contradicts:0, reconciled_by_context:0, related:0 });
  const [filter, setFilter]   = useState(externalFilter??"");
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    api.listRelationships({ limit:2000 }).then(all=>{
      const c:Counts={ corroborates:0, contradicts:0, reconciled_by_context:0, related:0 };
      for(const r of all){ const t=r.relationship_type as keyof Counts; if(t in c) c[t]++; }
      setCounts(c);
    }).catch(console.error);
  },[]);

  useEffect(()=>{ if(externalFilter!==undefined) setFilter(externalFilter); },[externalFilter]);

  useEffect(()=>{
    setLoading(true);
    api.listRelationships({ limit:1000, ...(filter?{relationship_type:filter}:{}) })
      .then(setRels).catch(console.error).finally(()=>setLoading(false));
  },[filter]);

  function handleFilter(v:string){ const next=filter===v?"":v; setFilter(next); onFilterChange?.(next); }
  const total=Object.values(counts).reduce((s,n)=>s+n,0);

  return (
    <div className="h-full flex flex-col">
      {/* tab bar */}
      <div className="flex items-center gap-0 px-4 bg-white border-b border-hairline flex-shrink-0">
        {TABS.map(t=>{
          const isActive=filter===t.v;
          const count=t.v ? counts[t.v as keyof Counts] : total;
          return (
            <button key={t.v} onClick={()=>handleFilter(t.v)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none whitespace-nowrap ${isActive?"border-sea-600 text-sea-700":"border-transparent text-gray-500 hover:text-gray-800"}`}>
              {t.l}{count>0 && <span className={`ml-1.5 text-xs font-mono ${isActive?"text-sea-500":"text-gray-400"}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* summary pills — all tab only */}
      {!filter && total>0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-hairline flex-shrink-0 flex-wrap">
          {(Object.entries(counts) as [keyof Counts,number][]).map(([type,n])=>{
            if(n===0) return null;
            const cfg=CFG[type];
            return (
              <button key={type} onClick={()=>handleFilter(type)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all hover:opacity-80 ${cfg.pill}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`}/>
                {n} {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading && <p className="text-xs text-gray-400 text-center py-10">loading…</p>}
        {!loading && rels.length===0 && (
          <div className="text-center py-16 space-y-1">
            <p className="text-sm text-gray-500">no relationships found</p>
            <p className="text-xs text-gray-400">process more documents to see cross-doc links</p>
          </div>
        )}
        {rels.map(rel=><RelCard key={rel.id} rel={rel} onSelectFact={onSelectFact}/>)}
      </div>
    </div>
  );
}
