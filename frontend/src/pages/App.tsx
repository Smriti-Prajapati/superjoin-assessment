import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Document, Fact, FactFilter, QueueStatus } from "../api/client";
import UploadZone from "../components/UploadZone";
import FactCard from "../components/FactCard";
import EvidencePanel from "../components/EvidencePanel";
import RelationshipsPanel from "../components/RelationshipsPanel";
import DocProgressBar from "../components/DocProgressBar";

type TabId = "relationships" | "facts" | "documents";

function shortName(s: string) {
  return s.replace(/\.pdf$/i,"").replace(/^\d{2}[-_]/,"").replace(/[-_]/g," ").replace(/\bexcerpt\b/gi,"").trim().slice(0,28);
}

function Logo({ size=24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="8" stroke="#0F6B5C" strokeWidth="2.2" fill="#E8F5F2"/>
      <line x1="8.5" y1="10.5" x2="15.5" y2="10.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8.5" y1="13.5" x2="14"   y2="13.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="#0F6B5C" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

export default function AppPage() {
  const navigate = useNavigate();
  const [documents, setDocuments]           = useState<Document[]>([]);
  const [facts, setFacts]                   = useState<Fact[]>([]);
  const [selectedFactId, setSelectedFactId] = useState<number | null>(null);
  const [activeTab, setActiveTab]           = useState<TabId>("relationships");
  const [loading, setLoading]               = useState(false);
  const [filter, setFilter]                 = useState<FactFilter>({ fact_type:"", source_doc:"", period:"" });
  const [queue, setQueue]                   = useState<QueueStatus>({ queued:0, current:null });
  const [relFilter, setRelFilter]           = useState("");
  const [showUpload, setShowUpload]         = useState(false);
  const [stats, setStats]                   = useState({ corroborations:0, reconciled:0, contradictions:0, total:0 });

  const loadDocuments = useCallback(() => { api.listDocuments().then(setDocuments).catch(console.error); }, []);
  const loadQueue     = useCallback(() => { api.getQueueStatus().then(setQueue).catch(console.error); }, []);
  const loadFacts     = useCallback(() => {
    setLoading(true);
    const p: FactFilter = { limit:1000, ...Object.fromEntries(Object.entries(filter).filter(([,v])=>v)) };
    api.listFacts(p).then(setFacts).catch(console.error).finally(()=>setLoading(false));
  }, [filter]);
  const loadStats = useCallback(() => {
    api.listRelationships({ limit:2000 }).then(rels => {
      const c = { corroborations:0, reconciled:0, contradictions:0, total:rels.length };
      for (const r of rels) {
        if (r.relationship_type==="corroborates") c.corroborations++;
        else if (r.relationship_type==="reconciled_by_context") c.reconciled++;
        else if (r.relationship_type==="contradicts") c.contradictions++;
      }
      setStats(c);
    }).catch(console.error);
  }, []);

  useEffect(()=>{ loadDocuments(); loadStats(); },[loadDocuments,loadStats]);
  useEffect(()=>{ loadFacts(); },[loadFacts]);
  useEffect(()=>{ loadQueue(); },[loadQueue]);
  useEffect(()=>{
    const id = setInterval(()=>{ loadDocuments(); loadQueue(); loadStats(); if(activeTab==="facts") loadFacts(); },5000);
    return ()=>clearInterval(id);
  },[loadDocuments,loadFacts,loadQueue,loadStats,activeTab]);

  const uniqueSources = [...new Set(facts.map(f=>f.source_doc).filter(Boolean))];
  const uniqueTypes   = [...new Set(facts.map(f=>f.fact_type).filter(Boolean) as string[])];
  const hasFilter     = Object.values(filter).some(Boolean);
  const totalPages    = documents.reduce((s,d)=>s+(d.page_count??0),0);
  const isProcessing  = !!(queue.current?.filename || queue.queued>0);

  const NAV: { id:TabId; label:string }[] = [
    { id:"relationships", label:"Relationships" },
    { id:"facts",         label:"Fact library"  },
    { id:"documents",     label:"Documents"     },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FAFAF8]">

      {/* ── top nav bar ──────────────────────────────────────────────── */}
      <header className="h-12 flex-shrink-0 bg-white border-b border-hairline flex items-center px-5 gap-4">
        {/* logo */}
        <button onClick={()=>navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
          <Logo size={22}/>
          <span className="font-bold text-gray-900 text-sm tracking-tight">FactLens</span>
        </button>

        <div className="h-4 w-px bg-gray-200 flex-shrink-0"/>

        {/* nav tabs */}
        <div className="flex items-center gap-0">
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setActiveTab(n.id)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors focus:outline-none -mb-px ${
                activeTab===n.id ? "border-sea-600 text-sea-700" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}>
              {n.label}
            </button>
          ))}
        </div>

        <div className="flex-1"/>

        {/* processing */}
        {isProcessing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"/>
            <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
              {queue.current?.filename ? shortName(queue.current.filename) : `${queue.queued} queued`}
              {queue.queued>0 && queue.current?.filename && ` +${queue.queued}`}
            </span>
          </div>
        )}

        {/* add PDFs */}
        <button onClick={()=>setShowUpload(v=>!v)}
          className="flex items-center gap-1.5 bg-sea-600 hover:bg-sea-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v7M3.5 3.5L6 1l2.5 2.5M1 9v1.5a.5.5 0 00.5.5h9a.5.5 0 00.5-.5V9" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Add PDFs
        </button>
      </header>

      {/* ── workspace header: title + stat cards ─────────────────────── */}
      <div className="bg-white border-b border-hairline px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Workspace</p>
            <h1 className="text-2xl font-bold text-gray-900 mt-0.5">
              {activeTab==="relationships" ? "Relationships"
               : activeTab==="facts" ? "Fact Library"
               : "Documents"}
            </h1>
            {activeTab==="relationships" && (
              <p className="text-sm text-gray-400 mt-0.5">Where documents agree, differ, or need a closer look.</p>
            )}
          </div>
          {totalPages>0 && (
            <span className="text-xs text-gray-400 mt-1">{totalPages.toLocaleString()} pages processed</span>
          )}
        </div>

        <div className="grid grid-cols-5 gap-3">
          {[
            { label:"Documents",              value:documents.length,              color:"text-gray-900" },
            { label:"Grounded facts",         value:facts.length.toLocaleString(), color:"text-gray-900" },
            { label:"Corroborations",         value:stats.corroborations,          color:"text-sea-700"  },
            { label:"Context reconciliations",value:stats.reconciled,              color:"text-lavender-700" },
            { label:"Likely contradictions",  value:stats.contradictions,          color:stats.contradictions>0?"text-terra-600":"text-gray-900" },
          ].map(s=>(
            <div key={s.label} className="bg-[#FAFAF8] border border-hairline rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400 leading-tight">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── upload modal ─────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center backdrop-blur-sm"
          onClick={()=>setShowUpload(false)}>
          <div className="bg-white rounded-2xl p-6 w-96 shadow-2xl border border-hairline" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Add PDFs</h3>
              <button onClick={()=>setShowUpload(false)} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
            </div>
            <UploadZone onUploaded={()=>{ loadDocuments(); loadFacts(); setTimeout(()=>setShowUpload(false), 1500); }}/>
          </div>
        </div>
      )}

      {/* ── content area ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* filter sidebar — only on facts */}
        {activeTab==="facts" && (
          <aside className="w-48 flex-shrink-0 border-r border-hairline bg-white overflow-y-auto p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter</p>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Fact type</span>
              <select value={filter.fact_type??""} onChange={e=>setFilter(f=>({...f,fact_type:e.target.value}))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">All types</option>
                {uniqueTypes.map(t=><option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Source</span>
              <select value={filter.source_doc??""} onChange={e=>setFilter(f=>({...f,source_doc:e.target.value}))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">All docs</option>
                {uniqueSources.map(s=><option key={s} value={s}>{shortName(s)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Period</span>
              <input value={filter.period??""} onChange={e=>setFilter(f=>({...f,period:e.target.value}))}
                placeholder="FY24"
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 font-mono focus:outline-none focus:border-sea-400 placeholder:text-gray-300"/>
            </label>
            {hasFilter && (
              <button onClick={()=>setFilter({fact_type:"",source_doc:"",period:""})}
                className="text-xs text-gray-400 hover:text-sea-600 underline">clear</button>
            )}
          </aside>
        )}

        <div className="flex-1 overflow-y-auto">

          {/* relationships */}
          {activeTab==="relationships" && (
            <RelationshipsPanel
              externalFilter={relFilter} onFilterChange={setRelFilter}
              onSelectFact={f=>{ if(f.id){ setSelectedFactId(f.id); setActiveTab("facts"); }}}
            />
          )}

          {/* facts */}
          {activeTab==="facts" && (
            <div className="p-4">
              {loading && facts.length===0 && <p className="text-xs text-gray-400 text-center py-10">loading…</p>}
              {!loading && facts.length===0 && (
                <div className="text-center py-14 space-y-2">
                  <p className="text-sm text-gray-500">no facts yet</p>
                  <button onClick={()=>setShowUpload(true)} className="text-sm text-sea-600 hover:text-sea-700 underline">upload PDFs to get started</button>
                </div>
              )}
              <div className="grid gap-2">
                {facts.map(fact=>(
                  <FactCard key={fact.id} fact={fact}
                    isSelected={selectedFactId===fact.id}
                    onClick={()=>setSelectedFactId(prev=>prev===fact.id?null:fact.id)}/>
                ))}
              </div>
            </div>
          )}

          {/* documents */}
          {activeTab==="documents" && (
            <div className="p-6 space-y-3">
              {documents.length===0 && (
                <div className="text-center py-14 space-y-2">
                  <p className="text-sm text-gray-500">no documents yet</p>
                  <button onClick={()=>setShowUpload(true)} className="text-sm text-sea-600 hover:text-sea-700 underline">add PDFs</button>
                </div>
              )}
              {documents.map(doc=>(
                <div key={doc.id} className="bg-white rounded-xl border border-hairline p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{shortName(doc.filename??"")}</p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono truncate max-w-xs">{doc.filename}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4 flex items-center gap-3">
                      <div>
                        <p className="text-xs text-gray-400">{doc.page_count??0} pages</p>
                        {doc.source_group && <p className="text-xs text-gray-300 mt-0.5">{doc.source_group}</p>}
                      </div>
                      <button
                        onClick={async()=>{ if(confirm("Delete this document and all its facts?")){ await api.deleteDocument(doc.id); loadDocuments(); loadFacts(); }}}
                        className="text-gray-300 hover:text-terra-500 transition-colors p-1 rounded"
                        title="Delete document">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  <DocProgressBar doc={doc}/>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* evidence panel */}
        {selectedFactId!=null && activeTab==="facts" && (
          <div className="w-80 flex-shrink-0 border-l border-hairline">
            <EvidencePanel key={selectedFactId} factId={selectedFactId} onClose={()=>setSelectedFactId(null)}/>
          </div>
        )}
      </div>
    </div>
  );
}
