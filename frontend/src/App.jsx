import { useEffect, useState, useCallback } from "react";
import { api } from "./api/client";
import UploadZone from "./components/UploadZone";
import FactCard from "./components/FactCard";
import EvidencePanel from "./components/EvidencePanel";
import RelationshipsPanel from "./components/RelationshipsPanel";

const TABS = [
  { id: "facts",         label: (n) => `Facts (${n})` },
  { id: "relationships", label: ()  => "Relationships" },
];

export default function App() {
  const [documents, setDocuments]       = useState([]);
  const [facts, setFacts]               = useState([]);
  const [selectedFact, setSelectedFact] = useState(null);
  const [activeTab, setActiveTab]       = useState("facts");
  const [loading, setLoading]           = useState(false);
  const [filter, setFilter]             = useState({
    fact_type: "",
    source_doc: "",
    period: "",
  });

  const loadDocuments = useCallback(() => {
    api.listDocuments().then(setDocuments).catch(console.error);
  }, []);

  const loadFacts = useCallback(() => {
    setLoading(true);
    const params = { limit: 300, ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) };
    api
      .listFacts(params)
      .then(setFacts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { loadDocuments(); }, [loadDocuments]);
  useEffect(() => { loadFacts(); },    [loadFacts]);

  // poll every 8 s while processing
  useEffect(() => {
    const id = setInterval(() => {
      loadDocuments();
      if (activeTab === "facts") loadFacts();
    }, 8000);
    return () => clearInterval(id);
  }, [loadDocuments, loadFacts, activeTab]);

  const uniqueSources = [...new Set(facts.map((f) => f.source_doc).filter(Boolean))];
  const uniqueTypes   = [...new Set(facts.map((f) => f.fact_type).filter(Boolean))];

  function toggleFact(fact) {
    setSelectedFact((prev) => (prev?.id === fact.id ? null : fact));
  }

  function clearFilter() {
    setFilter({ fact_type: "", source_doc: "", period: "" });
  }

  const hasFilter = Object.values(filter).some(Boolean);

  return (
    <div className="h-screen flex flex-col overflow-hidden">

      {/* ── top bar ─────────────────────────────────────────────────────── */}
      <header className="border-b border-hairline bg-white px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* logo */}
          <div className="w-6 h-6 rounded bg-sea-600 flex items-center justify-center select-none">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">FactLens</span>
          <span className="text-gray-300 text-xs select-none">·</span>
          <span className="text-xs text-gray-400">
            {documents.length} doc{documents.length !== 1 ? "s" : ""}
            {" · "}
            {facts.length} fact{facts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ingested docs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {documents.map((doc) => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sea-50 border border-sea-100 text-xs text-sea-700"
              title={doc.filename}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sea-500 inline-block flex-shrink-0" />
              <span className="max-w-[160px] truncate">
                {doc.filename?.replace(/\.pdf$/i, "")}
              </span>
            </span>
          ))}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── left sidebar ─────────────────────────────────────────────── */}
        <aside className="w-60 border-r border-hairline bg-white flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-hairline">
            <UploadZone onUploaded={() => { loadDocuments(); loadFacts(); }} />
          </div>

          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Filter Facts
            </p>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Fact type</span>
              <select
                value={filter.fact_type}
                onChange={(e) => setFilter((f) => ({ ...f, fact_type: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400"
              >
                <option value="">All types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Source doc</span>
              <select
                value={filter.source_doc}
                onChange={(e) => setFilter((f) => ({ ...f, source_doc: e.target.value }))}
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:border-sea-400"
              >
                <option value="">All documents</option>
                {uniqueSources.map((s) => (
                  <option key={s} value={s}>{s.replace(/\.pdf$/i, "")}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs text-gray-400 block mb-1">Period</span>
              <input
                value={filter.period}
                onChange={(e) => setFilter((f) => ({ ...f, period: e.target.value }))}
                placeholder="e.g. FY24"
                className="w-full text-xs border border-hairline rounded px-2 py-1.5 bg-white text-gray-700 font-mono focus:outline-none focus:border-sea-400 placeholder:text-gray-300"
              />
            </label>

            {hasFilter && (
              <button
                onClick={clearFilter}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
              >
                clear filters
              </button>
            )}
          </div>
        </aside>

        {/* ── main panel ───────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* tab bar */}
          <div className="flex border-b border-hairline bg-white px-4 flex-shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 ${
                  activeTab === tab.id
                    ? "border-sea-600 text-sea-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label(facts.length)}
              </button>
            ))}
          </div>

          <div className="flex flex-1 overflow-hidden">

            {/* fact list / relationships */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === "facts" && (
                <>
                  {loading && facts.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-10">Loading facts…</p>
                  )}
                  {!loading && facts.length === 0 && (
                    <div className="text-center py-14 space-y-2">
                      <p className="text-sm text-gray-500">No facts extracted yet.</p>
                      <p className="text-xs text-gray-400">
                        Upload PDFs — extraction runs automatically in the background.
                      </p>
                    </div>
                  )}
                  <div className="grid gap-2">
                    {facts.map((fact) => (
                      <FactCard
                        key={fact.id}
                        fact={fact}
                        isSelected={selectedFact?.id === fact.id}
                        onClick={() => toggleFact(fact)}
                      />
                    ))}
                  </div>
                </>
              )}

              {activeTab === "relationships" && (
                <RelationshipsPanel
                  onSelectFact={(fact) => {
                    setSelectedFact(fact);
                    setActiveTab("facts");
                  }}
                />
              )}
            </div>

            {/* evidence panel */}
            {selectedFact && (
              <div className="w-80 flex-shrink-0">
                <EvidencePanel
                  fact={selectedFact}
                  onClose={() => setSelectedFact(null)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
