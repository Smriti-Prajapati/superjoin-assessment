import { useEffect, useState, useCallback } from "react";
import { api } from "./api/client";
import type { Document, Fact, FactFilter, QueueStatus } from "./api/client";
import UploadZone from "./components/UploadZone";
import FactCard from "./components/FactCard";
import EvidencePanel from "./components/EvidencePanel";
import RelationshipsPanel from "./components/RelationshipsPanel";
import DocProgressBar from "./components/DocProgressBar";

type TabId = "facts" | "relationships";

function shortName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  const parts = base.split(/[-_]/).filter(p => !/^\d{2}$/.test(p));
  if (parts.length <= 3) return parts.join(" ");
  return parts.slice(0, 3).join(" ") + "…";
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="11" cy="11" r="8" stroke="#0F6B5C" strokeWidth="2" fill="#E8F5F2"/>
      <line x1="8"  y1="9.5"  x2="14" y2="9.5"  stroke="#0F6B5C" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8"  y1="12"   x2="13" y2="12"    stroke="#0F6B5C" strokeWidth="1.5" strokeLinecap="round" opacity="0.55"/>
      <line x1="15" y1="15"   x2="22" y2="22"    stroke="#0F6B5C" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}

export default function App() {
  const [documents, setDocuments]           = useState<Document[]>([]);
  const [facts, setFacts]                   = useState<Fact[]>([]);
  const [selectedFactId, setSelectedFactId] = useState<number | null>(null);
  const [activeTab, setActiveTab]           = useState<TabId>("facts");
  const [loading, setLoading]               = useState(false);
  const [filter, setFilter]                 = useState<FactFilter>({ fact_type: "", source_doc: "", period: "" });
  const [queue, setQueue]                   = useState<QueueStatus>({ queued: 0, current: null });
  const [relFilter, setRelFilter]           = useState("");

  const loadDocuments = useCallback(() => { api.listDocuments().then(setDocuments).catch(console.error); }, []);
  const loadQueue     = useCallback(() => { api.getQueueStatus().then(setQueue).catch(console.error); }, []);
  const loadFacts     = useCallback(() => {
    setLoading(true);
    const p: FactFilter = { limit: 1000, ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) };
    api.listFacts(p).then(setFacts).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadFacts(); },    [loadFacts]);
  useEffect(() => { loadQueue(); },    [loadQueue]);
  useEffect(() => {
    const id = setInterval(() => { loadDocuments(); loadQueue(); if (activeTab === "facts") loadFacts(); }, 5000);
    return () => clearInterval(id);
  }, [loadDocuments, loadFacts, loadQueue, activeTab]);

  const uniqueSources = [...new Set(facts.map(f => f.source_doc).filter(Boolean))];
  const uniqueTypes   = [...new Set(facts.map(f => f.fact_type).filter(Boolean) as string[])];
  const hasFilter     = Object.values(filter).some(Boolean);
  const isProcessing  = !!(queue.current?.filename || queue.queued > 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FAFAF8]">

      {/* ── header ───────────────────────────────────────────────────── */}
      <header className="h-11 flex-shrink-0 bg-white border-b border-hairline flex items-center px-4 gap-3">
        <Logo />
        <span className="text-sm font-semibold text-gray-900 tracking-tight">FactLens</span>
        <div className="h-4 w-px bg-gray-200" />
        <span className="text-xs text-gray-400 tabular-nums">
          {documents.length} docs · {facts.length.toLocaleString()} facts
        </span>
        <div className="flex-1" />
        {isProcessing && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-700 font-medium whitespace-nowrap">
              {queue.current?.filename
                ? `${shortName(queue.current.filename)}${queue.queued > 0 ? ` +${queue.queued}` : ""}`
                : `${queue.queued} queued`}
            </span>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── sidebar ──────────────────────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 border-r border-hairline bg-white flex flex-col">
          <div className="p-3 border-b border-hairline">
            <UploadZone onUploaded={() => { loadDocuments(); loadFacts(); }} />
          </div>

          {/* doc list — compact */}
          {documents.length > 0 && (
            <div className="px-3 pt-2.5 pb-2 border-b border-hairline">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Documents</p>
              <div className="space-y-0.5">
                {documents.map(doc => (
                  <div key={doc.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sea-500 flex-shrink-0" />
                      <span className="text-xs text-gray-600 truncate" title={doc.filename}>
                        {shortName(doc.filename ?? "")}
                      </span>
                    </div>
                    <DocProgressBar doc={doc} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* filters */}
          <div className="p-3 space-y-3 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filter</p>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Fact type</span>
              <select value={filter.fact_type ?? ""} onChange={e => setFilter(f => ({ ...f, fact_type: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">All types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Source</span>
              <select value={filter.source_doc ?? ""} onChange={e => setFilter(f => ({ ...f, source_doc: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">All documents</option>
                {uniqueSources.map(s => <option key={s} value={s}>{shortName(s)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Period</span>
              <input value={filter.period ?? ""} onChange={e => setFilter(f => ({ ...f, period: e.target.value }))}
                placeholder="FY24"
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 font-mono focus:outline-none focus:border-sea-400 placeholder:text-gray-300" />
            </label>
            {hasFilter && (
              <button onClick={() => setFilter({ fact_type: "", source_doc: "", period: "" })}
                className="text-xs text-gray-400 hover:text-sea-600 underline">clear filters</button>
            )}
          </div>
        </aside>

        {/* ── main ─────────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* tabs */}
          <div className="flex border-b border-hairline bg-white px-4 flex-shrink-0">
            {(["facts", "relationships"] as TabId[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none ${
                  activeTab === tab ? "border-sea-600 text-sea-700" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}>
                {tab === "facts"
                  ? <span>facts <span className="text-xs font-mono text-gray-400">({facts.length.toLocaleString()})</span></span>
                  : "relationships"}
              </button>
            ))}
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "facts" && (
                <>
                  {loading && facts.length === 0 && <p className="text-xs text-gray-400 text-center py-10">loading…</p>}
                  {!loading && facts.length === 0 && (
                    <div className="text-center py-14 space-y-2">
                      <p className="text-sm text-gray-500">no facts extracted yet</p>
                      <p className="text-xs text-gray-400">upload pdfs — extraction runs in the background</p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    {facts.map(fact => (
                      <FactCard key={fact.id} fact={fact}
                        isSelected={selectedFactId === fact.id}
                        onClick={() => setSelectedFactId(prev => prev === fact.id ? null : fact.id)} />
                    ))}
                  </div>
                </>
              )}

              {activeTab === "relationships" && (
                <RelationshipsPanel
                  externalFilter={relFilter}
                  onFilterChange={setRelFilter}
                  onSelectFact={f => {
                    if (f.id) { setSelectedFactId(f.id); setActiveTab("facts"); }
                  }}
                />
              )}
            </div>

            {selectedFactId != null && (
              <div className="w-80 flex-shrink-0">
                <EvidencePanel key={selectedFactId} factId={selectedFactId} onClose={() => setSelectedFactId(null)} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
