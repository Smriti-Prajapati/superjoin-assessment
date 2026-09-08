import { useEffect, useState, useCallback } from "react";
import { api } from "./api/client";
import type { Document, Fact, FactFilter, QueueStatus } from "./api/client";
import UploadZone from "./components/UploadZone";
import FactCard from "./components/FactCard";
import EvidencePanel from "./components/EvidencePanel";
import RelationshipsPanel from "./components/RelationshipsPanel";
import DocProgressBar from "./components/DocProgressBar";
import CaseSummary from "./components/CaseSummary";

type TabId = "facts" | "relationships";

function shortName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  const parts = base.split(/[-_]/).filter(p => !/^\d{2}$/.test(p));
  if (parts.length <= 3) return parts.join(" ");
  return parts.slice(0, 3).join(" ") + "…";
}

// ── FactLens logo SVG ────────────────────────────────────────────────────────
function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* outer ring */}
      <circle cx="14" cy="14" r="13" stroke="#0F6B5C" strokeWidth="1.5" fill="none" opacity="0.25"/>
      {/* lens body */}
      <circle cx="12" cy="12" r="7" stroke="#0F6B5C" strokeWidth="2" fill="#E8F5F2"/>
      {/* lens highlight */}
      <circle cx="10" cy="10" r="2" fill="#1B7A6B" opacity="0.35"/>
      {/* magnifier handle */}
      <line x1="17.5" y1="17.5" x2="23" y2="23" stroke="#0F6B5C" strokeWidth="2.5" strokeLinecap="round"/>
      {/* fact lines inside lens */}
      <line x1="9" y1="11" x2="15" y2="11" stroke="#0F6B5C" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      <line x1="9" y1="13.5" x2="14" y2="13.5" stroke="#0F6B5C" strokeWidth="1.2" strokeLinecap="round" opacity="0.5"/>
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

  const loadDocuments = useCallback(() => {
    api.listDocuments().then(setDocuments).catch(console.error);
  }, []);
  const loadQueue = useCallback(() => {
    api.getQueueStatus().then(setQueue).catch(console.error);
  }, []);
  const loadFacts = useCallback(() => {
    setLoading(true);
    const params: FactFilter = { limit: 1000, ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) };
    api.listFacts(params).then(setFacts).catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadFacts(); },    [loadFacts]);
  useEffect(() => { loadQueue(); },    [loadQueue]);
  useEffect(() => {
    const id = setInterval(() => {
      loadDocuments(); loadQueue();
      if (activeTab === "facts") loadFacts();
    }, 5000);
    return () => clearInterval(id);
  }, [loadDocuments, loadFacts, loadQueue, activeTab]);

  const uniqueSources = [...new Set(facts.map(f => f.source_doc).filter(Boolean))];
  const uniqueTypes   = [...new Set(facts.map(f => f.fact_type).filter(Boolean) as string[])];
  const hasFilter     = Object.values(filter).some(Boolean);
  const isProcessing  = !!(queue.current?.filename || queue.queued > 0);

  function handleCaseSummaryFilter(type: string) {
    setRelFilter(type);
    setActiveTab("relationships");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#FAFAF8" }}>

      {/* ── top bar ──────────────────────────────────────────────────────── */}
      <header className="border-b border-hairline bg-white flex-shrink-0" style={{ height: 48 }}>
        <div className="h-full px-4 flex items-center justify-between">

          {/* left: logo + wordmark + stats */}
          <div className="flex items-center gap-3">
            <Logo />
            <span className="font-semibold text-gray-900 text-sm tracking-tight">FactLens</span>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs text-gray-400 tabular-nums">
              {documents.length} doc{documents.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-gray-400 tabular-nums">
              {facts.length.toLocaleString()} facts
            </span>
          </div>

          {/* right: queue indicator */}
          {isProcessing && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              <span className="text-xs text-amber-700 font-medium">
                {queue.current?.filename
                  ? <>processing <span className="font-semibold">{shortName(queue.current.filename)}</span>
                    {queue.queued > 0 && <span className="text-amber-500 ml-1">+{queue.queued} queued</span>}</>
                  : `${queue.queued} queued`
                }
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-56 border-r border-hairline bg-white flex flex-col flex-shrink-0">

          {/* upload */}
          <div className="p-3 border-b border-hairline">
            <UploadZone onUploaded={() => { loadDocuments(); loadFacts(); }} />
          </div>

          {/* documents list */}
          {documents.length > 0 && (
            <div className="px-3 pt-3 pb-2 border-b border-hairline">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">documents</p>
              <div className="space-y-2">
                {documents.map(doc => (
                  <div key={doc.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sea-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 truncate leading-tight" title={doc.filename}>
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">filter</p>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">fact type</span>
              <select value={filter.fact_type ?? ""}
                onChange={e => setFilter(f => ({ ...f, fact_type: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">all types</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">source</span>
              <select value={filter.source_doc ?? ""}
                onChange={e => setFilter(f => ({ ...f, source_doc: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400">
                <option value="">all documents</option>
                {uniqueSources.map(s => <option key={s} value={s}>{shortName(s)}</option>)}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">period</span>
              <input value={filter.period ?? ""}
                onChange={e => setFilter(f => ({ ...f, period: e.target.value }))}
                placeholder="FY24"
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 font-mono focus:outline-none focus:border-sea-400 placeholder:text-gray-300" />
            </label>

            {hasFilter && (
              <button onClick={() => setFilter({ fact_type: "", source_doc: "", period: "" })}
                className="text-xs text-gray-400 hover:text-sea-600 underline transition-colors">
                clear filters
              </button>
            )}
          </div>
        </aside>

        {/* ── main content ─────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* tab bar */}
          <div className="flex border-b border-hairline bg-white px-4 flex-shrink-0">
            {(["facts", "relationships"] as TabId[]).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none ${
                  activeTab === tab
                    ? "border-sea-600 text-sea-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}>
                {tab === "facts"
                  ? <>{`facts`}<span className="ml-1.5 text-xs font-mono text-gray-400">({facts.length.toLocaleString()})</span></>
                  : "relationships"
                }
              </button>
            ))}
          </div>

          {/* case summary */}
          <CaseSummary activeFilter={relFilter} onFilter={handleCaseSummaryFilter} />

          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">

              {activeTab === "facts" && (
                <>
                  {loading && facts.length === 0 &&
                    <p className="text-xs text-gray-400 text-center py-10">loading…</p>}
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
                <EvidencePanel
                  key={selectedFactId}
                  factId={selectedFactId}
                  onClose={() => setSelectedFactId(null)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
