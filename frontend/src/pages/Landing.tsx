import { useNavigate } from "react-router-dom";

// ── Logo ─────────────────────────────────────────────────────────────────────
function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="8" stroke="#0F6B5C" strokeWidth="2.2" fill="#E8F5F2"/>
      <line x1="8.5"  y1="10.5" x2="15.5" y2="10.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8.5"  y1="13.5" x2="14"   y2="13.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="17.5" y1="17.5" x2="24"   y2="24"   stroke="#0F6B5C" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

// ── App preview mock ──────────────────────────────────────────────────────────
function AppPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      {/* chrome bar */}
      <div className="bg-sea-700 px-4 py-2.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-sea-300/70" />
        <span className="ml-3 text-xs text-sea-200 font-mono">FactLens · Relationships</span>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-[#FAFAF8]">
        {[["Documents","6"],["Grounded facts","1,113"],["Corroborations","59"],["Contradictions","2"]].map(([l,v]) => (
          <div key={l} className="px-3 py-2.5">
            <p className="text-xs text-gray-400">{l}</p>
            <p className="text-lg font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>

      {/* tab bar */}
      <div className="flex gap-0 border-b border-gray-100 bg-white px-3">
        {["All","Corroborates","Contradicts","Reconciles"].map((t,i) => (
          <span key={t} className={`px-3 py-2 text-xs font-medium border-b-2 ${i===1 ? "border-sea-600 text-sea-700" : "border-transparent text-gray-400"}`}>{t}</span>
        ))}
      </div>

      {/* relationship card */}
      <div className="p-3 space-y-2.5">
        <div className="bg-white rounded-xl border border-sea-100 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-widest bg-sea-50 text-sea-700 border border-sea-200 px-2 py-0.5 rounded">CORROBORATES</span>
            <span className="text-xs text-gray-400">agreement</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Express parcels shipped</p>
          <div className="grid grid-cols-2 gap-2">
            {[["02-annual-report",4],["03-q4-earnings",6]].map(([doc,pg]) => (
              <div key={String(doc)} className="rounded-lg bg-[#FAFAF8] border border-gray-100 p-2">
                <p className="text-base font-bold text-gray-900">740 <span className="text-xs text-gray-400 font-normal">Mn</span></p>
                <p className="text-xs text-gray-400 mt-0.5">FY2024</p>
                <p className="text-xs text-sea-600 mt-1 truncate">📄 {doc} · p.{pg}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 bg-gray-50 rounded-lg border border-gray-100 p-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reasoning </span>
            <span className="text-xs text-gray-500">740 Mn confirmed in both sources for FY2024 — identical after normalization.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Feature section ───────────────────────────────────────────────────────────
function Feature({ num, tag, title, bullets, visual }: {
  num: string; tag: string; title: string; bullets: string[]; visual: React.ReactNode;
}) {
  return (
    <section className="py-20 border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded">{num}</span>
            <span className="text-xs font-semibold uppercase tracking-widest text-sea-600">{tag}</span>
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">{title}</h2>
          <ul className="space-y-2.5">
            {bullets.map(b => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-gray-600">
                <svg className="w-4 h-4 mt-0.5 text-sea-500 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="#1B7A6B" strokeWidth="1.4"/>
                  <path d="M5 8l2 2 4-4" stroke="#1B7A6B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <button className="text-sm font-semibold text-sea-700 hover:text-sea-600 transition-colors">
            Learn More →
          </button>
        </div>
        <div className="flex justify-center lg:justify-end">{visual}</div>
      </div>
    </section>
  );
}

// ── Reconcile visual ──────────────────────────────────────────────────────────
function ReconcileVisual() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-5 w-full max-w-md space-y-3">
      <span className="text-xs font-bold uppercase tracking-widest bg-lavender-50 text-lavender-700 border border-lavender-200 px-2 py-0.5 rounded">RECONCILED</span>
      <p className="text-sm font-semibold text-gray-900">Revenue from operations</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#FAFAF8] border border-gray-100 p-3">
          <p className="text-xl font-bold text-gray-900">₹74,540 <span className="text-xs text-gray-400 font-normal">Mn</span></p>
          <p className="text-xs text-lavender-600 mt-1">Standalone · FY24</p>
        </div>
        <div className="rounded-xl bg-[#FAFAF8] border border-gray-100 p-3">
          <p className="text-xl font-bold text-gray-900">₹81,415 <span className="text-xs text-gray-400 font-normal">Mn</span></p>
          <p className="text-xs text-lavender-600 mt-1">Consolidated · FY24</p>
        </div>
      </div>
      <div className="bg-lavender-50 rounded-lg border border-lavender-100 p-3">
        <p className="text-xs text-gray-600"><span className="font-semibold text-lavender-700">Context: </span>Standalone vs consolidated scope — same period, different reporting boundary.</p>
      </div>
    </div>
  );
}

// ── Extraction visual ─────────────────────────────────────────────────────────
function ExtractionVisual() {
  const facts = [
    { v: "₹81,415 Mn", l: "Revenue", type: "financial metric", p: 1 },
    { v: "740 Mn",      l: "Parcels shipped", type: "operational metric", p: 4 },
    { v: "July 1 2024", l: "Director resignation", type: "governance event", p: 12 },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-4 w-full max-w-md space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-sea-500 animate-pulse" />
        <span className="text-xs text-gray-400 font-mono">extracting · batch 3/22</span>
      </div>
      {facts.map(f => (
        <div key={f.l} className="flex items-center justify-between rounded-lg border border-hairline bg-[#FAFAF8] px-3 py-2">
          <div>
            <p className="text-sm font-bold text-gray-900">{f.v}</p>
            <p className="text-xs text-gray-500">{f.l}</p>
          </div>
          <div className="text-right">
            <span className="text-xs bg-sea-50 text-sea-700 border border-sea-200 px-1.5 py-0.5 rounded">{f.type}</span>
            <p className="text-xs text-gray-400 mt-1">p.{f.p}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── nav ──────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="font-bold text-gray-900 text-base tracking-tight">FactLens</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-gray-500">
            <a href="#how-it-works" className="hover:text-gray-900 transition-colors">How it works</a>
            <a href="#cases" className="hover:text-gray-900 transition-colors">Use cases</a>
            <a href="https://github.com/Smriti-Prajapati/superjoin-assessment" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 transition-colors">GitHub</a>
          </div>
          <button onClick={() => navigate("/app")}
            className="bg-sea-600 hover:bg-sea-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm">
            Open App →
          </button>
        </div>
      </nav>

      {/* ── hero ─────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-14 items-center">
        <div className="space-y-7">
          <div className="inline-flex items-center gap-2 bg-sea-50 border border-sea-200 text-sea-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-sea-500" />
            Superjoin VIT 2026 · Engineering Intern
          </div>

          <h1 className="text-5xl font-extrabold text-gray-900 leading-[1.1] tracking-tight">
            Fact extraction<br />
            <span className="text-sea-600">across documents,</span><br />
            grounded in evidence.
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed max-w-lg">
            Upload PDFs. FactLens extracts meaningful facts, links them to source pages, and automatically finds where documents agree, conflict, or need context to be reconciled.
          </p>

          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => navigate("/app")}
              className="bg-sea-600 hover:bg-sea-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm text-sm">
              Try it now →
            </button>
            <a href="https://github.com/Smriti-Prajapati/superjoin-assessment" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-gray-200 bg-white hover:border-sea-300 text-gray-700 font-medium px-5 py-3 rounded-xl transition-colors text-sm">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              View source
            </a>
          </div>
        </div>

        <div className="flex justify-end">
          <AppPreview />
        </div>
      </section>

      {/* ── trust bar ────────────────────────────────────────────────── */}
      <div className="border-y border-gray-100 bg-[#FAFAF8] py-4">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center gap-8 flex-wrap">
          {["PyMuPDF extraction","Cohere LLM","sentence-transformers","SQLite storage","FastAPI + React"].map(t => (
            <span key={t} className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t}</span>
          ))}
        </div>
      </div>

      {/* ── feature sections ─────────────────────────────────────────── */}
      <div id="how-it-works">
        <Feature
          num="01" tag="Extraction"
          title={"Extract facts from\nany PDF automatically."}
          bullets={[
            "Grounded in source pages — every fact links to exact evidence",
            "Handles financial metrics, governance events, macro indicators",
            "Schema evolves dynamically — no hardcoded fact types",
          ]}
          visual={<ExtractionVisual />}
        />

        <Feature
          num="02" tag="Context reconciliation"
          title={"Apparent conflicts\nexplained by context."}
          bullets={[
            "Standalone vs consolidated scope — same period, different boundary",
            "Advance estimate vs final actual — vintage explains the gap",
            "Time period differences — FY23 vs FY24 figures",
          ]}
          visual={<ReconcileVisual />}
        />
      </div>

      {/* ── four cases ───────────────────────────────────────────────── */}
      <section id="cases" className="py-20 border-t border-gray-100 bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2 text-center">Required cases</p>
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-10">All four cases, demonstrated.</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { badge: "corroborates", badgeStyle: "bg-sea-50 text-sea-700 border-sea-200",
                title: "Same fact, two sources",
                desc: "740 Mn express parcels confirmed in both the annual report and earnings presentation." },
              { badge: "contradicts", badgeStyle: "bg-terra-50 text-terra-700 border-terra-200",
                title: "Genuine conflict",
                desc: "A metric at two irreconcilably different values — no period, scope, or unit difference explains the gap." },
              { badge: "reconciled", badgeStyle: "bg-lavender-50 text-lavender-700 border-lavender-200",
                title: "Context explains it",
                desc: "₹74,540 Mn standalone vs ₹81,415 Mn consolidated — same period, different scope." },
              { badge: "limitation", badgeStyle: "bg-gray-50 text-gray-500 border-gray-200",
                title: "Failure, documented",
                desc: "~50% of page numbers were wrong in a sample. Evidence text is always correct. Fix is known and planned." },
            ].map(c => (
              <div key={c.badge} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3 shadow-sm">
                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${c.badgeStyle}`}>
                  {c.badge}
                </span>
                <p className="text-sm font-semibold text-gray-900 leading-snug">{c.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── final CTA ────────────────────────────────────────────────── */}
      <section className="py-20 border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <h2 className="text-4xl font-extrabold text-gray-900">Ready to try it?</h2>
          <p className="text-gray-500 text-lg">Drop your PDFs in. Facts start appearing within seconds.</p>
          <button onClick={() => navigate("/app")}
            className="bg-sea-600 hover:bg-sea-700 text-white font-semibold px-8 py-3.5 rounded-xl text-sm transition-colors shadow-sm">
            Open FactLens →
          </button>
        </div>
      </section>

      {/* ── footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        Built by Smriti Prajapati · Superjoin Engineering Intern Assignment 2026
      </footer>
    </div>
  );
}
