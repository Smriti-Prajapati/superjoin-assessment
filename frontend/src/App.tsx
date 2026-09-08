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

// Shorten filenames for display in the header pill
function shortName(filename: string): string {
  const base = filename.replace(/\.pdf$/i, "");
  // keep meaningful prefix — e.g. "01-delhivery-annual-report-fy24" → "delhivery annual fy24"
  const parts = base.split("-").filter(p => !/^\d{2}$/.test(p)); // drop leading number
  if (parts.length <= 4) return parts.join(" ");
  return parts.slice(0, 3).join(" ") + "…";
}

export default function App() {
  const [documents, setDocuments]           = useState<Document[]>([]);
  const [facts, setFacts]                   = useState<Fact[]>([]);
  // store only the ID — panel fetches full data from API
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

  function handleCaseSummaryFilter(type: string) {
    setRelFilter(type);
    setActiveTab("relationships");
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#FAFAF8" }}>

      {/* ── top bar ──────────────────────────────────────────────────────── */}
      <header className="border-b border-hairline bg-white px-5 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded bg-sea-600 flex items-center justify-center select-none">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">FactLens</span>
          <span className="text-gray-300 text-xs select-none">·</span>
          <span className="text-xs text-gray-400">
            {documents.length} doc{documents.length !== 1 ? "s" : ""} · {facts.length} facts
          </span>
          {(queue.current?.filename || queue.queued > 0) && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
              {queue.current?.filename
                ? <>processing <span className="font-medium">{shortName(queue.current.filename)}</span>
                    {queue.queued > 0 ? ` · ${queue.queued} waiting` : ""}</>
                : `${queue.queued} queued`
              }
            </span>
          )}
        </div>

        {/* doc pills — short name + tooltip for full name */}
        <div className="flex items-start gap-2 flex-wrap max-w-[55vw]">
          {documents.map(doc => (
            <div key={doc.id} className="flex flex-col" style={{ minWidth: 100, maxWidth: 160 }}>
              <span title={doc.filename}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sea-50 border border-sea-100 text-xs text-sea-700 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-sea-500 inline-block flex-shrink-0" />
                <span className="truncate">{shortName(doc.filename ?? "")}</span>
              </span>
              <DocProgressBar doc={doc} />
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── sidebar ──────────────────────────────────────────────────── */}
        <aside className="w-56 border-r border-hairline bg-white flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-hairline">
            <UploadZone onUploaded={() => { loadDocuments(); loadFacts(); }} />
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">filter facts</p>

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
              <span className="text-xs text-gray-400 block mb-1">source doc</span>
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
                placeholder="e.g. FY24"
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 font-mono focus:outline-none focus:border-sea-400 placeholder:text-gray-300" />
            </label>

            {hasFilter && (
              <button onClick={() => setFilter({ fact_type: "", source_doc: "", period: "" })}
                className="text-xs text-gray-400 hover:text-gray-700 underline">clear filters</button>
            )}
          </div>
        </aside>

        {/* ── main ─────────────────────────────────────────────────────── */}
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
                {tab === "facts" ? `facts (${facts.length})` : "relationships"}
              </button>
            ))}
          </div>

          {/* case-summary strip — only shows when there are relationships */}
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

            {/* evidence panel — keyed by factId so it always re-fetches */}
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
