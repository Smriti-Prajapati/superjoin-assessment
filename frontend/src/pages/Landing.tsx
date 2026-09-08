import { useNavigate } from "react-router-dom";

function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="12" cy="12" r="8" stroke="#0F6B5C" strokeWidth="2.2" fill="#E8F5F2"/>
      <line x1="8.5" y1="10.5" x2="15.5" y2="10.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="8.5" y1="13.5" x2="14"   y2="13.5" stroke="#0F6B5C" strokeWidth="1.8" strokeLinecap="round" opacity="0.55"/>
      <line x1="17.5" y1="17.5" x2="24" y2="24" stroke="#0F6B5C" strokeWidth="2.4" strokeLinecap="round"/>
    </svg>
  );
}

// ── App preview mock card ─────────────────────────────────────────────────────
function AppPreview() {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden w-full max-w-lg">
      {/* chrome */}
      <div className="bg-sea-700 px-4 py-2.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400/70"/>
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70"/>
        <span className="w-2.5 h-2.5 rounded-full bg-sea-300/70"/>
        <span className="ml-3 text-xs text-sea-200 font-mono">FactLens · Relationships</span>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100 bg-[#FAFAF8]">
        {[["Documents","6"],["Grounded facts","1,113"],["Corroborations","59"],["Contradictions","2"]].map(([l,v])=>(
          <div key={l} className="px-3 py-2.5">
            <p className="text-xs text-gray-400">{l}</p>
            <p className="text-lg font-bold text-gray-900">{v}</p>
          </div>
        ))}
      </div>

      {/* tab bar */}
      <div className="flex border-b border-gray-100 bg-white px-3">
        {["All","Corroborates","Contradicts","Reconciles"].map((t,i)=>(
          <span key={t} className={`px-3 py-2 text-xs font-medium border-b-2 ${i===1?"border-sea-600 text-sea-700":"border-transparent text-gray-400"}`}>{t}</span>
        ))}
      </div>

      {/* relationship card */}
      <div className="p-3">
        <div className="bg-white rounded-xl border border-sea-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-widest bg-sea-50 text-sea-700 border border-sea-200 px-2 py-0.5 rounded">CORROBORATES</span>
            <span className="text-xs text-gray-400">agreement</span>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Express parcels shipped</p>
          <div className="grid grid-cols-2 gap-2">
            {[["02-annual-report",4],["03-q4-earnings",6]].map(([doc,pg])=>(
              <div key={String(doc)} className="rounded-lg bg-[#FAFAF8] border border-gray-100 p-2.5">
                <p className="text-base font-bold text-gray-900">740 <span className="text-xs text-gray-400 font-normal">Mn</span></p>
                <p className="text-xs text-gray-400 mt-0.5">FY2024</p>
                <p className="text-xs text-sea-600 mt-1 truncate">📄 {doc} · p.{pg}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 bg-gray-50 rounded-lg p-2.5">
            <span className="text-xs font-semibold text-gray-500">Reasoning </span>
            <span className="text-xs text-gray-500">740 Mn confirmed in both sources for FY2024 — identical after normalization.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── nav ── */}
      <nav className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={22}/>
            <span className="font-bold text-gray-900 text-base">FactLens</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/Smriti-Prajapati/superjoin-assessment" target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors">GitHub</a>
            <button onClick={()=>navigate("/app")}
              className="bg-sea-600 hover:bg-sea-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
              Open App →
            </button>
          </div>
        </div>
      </nav>

      {/* ── hero: left copy + right preview ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">

        {/* left */}
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 bg-sea-50 border border-sea-200 text-sea-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-sea-500"/>
            Superjoin VIT 2026 · Engineering Intern
          </div>

          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Extract facts.<br/>
            <span className="text-sea-600">Find the truth</span><br/>
            across PDFs.
          </h1>

          <p className="text-lg text-gray-500 leading-relaxed max-w-md">
            Upload PDFs. FactLens extracts grounded facts, links them to source evidence, and finds where documents agree, conflict, or need context to reconcile.
          </p>

          <div className="flex items-center gap-3 flex-wrap pt-1">
            <button onClick={()=>navigate("/app")}
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

          {/* tech stack */}
          <div className="flex gap-5 flex-wrap pt-2 text-xs text-gray-400 font-medium uppercase tracking-wider">
            {["Cohere LLM","PyMuPDF","FastAPI","React"].map(t=>(
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>

        {/* right */}
        <div className="flex justify-center lg:justify-end">
          <AppPreview/>
        </div>
      </section>

      {/* ── trust strip ── */}
      <div className="border-y border-gray-100 bg-[#FAFAF8] py-4">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400">
          Demonstrates all four required cases
        </p>
      </div>

      {/* ── four cases ── */}
      <section className="py-16 bg-[#FAFAF8]">
        <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { badge:"Corroborates", color:"bg-sea-50 text-sea-700 border-sea-200",
              title:"Same fact, two sources",
              desc:"740 Mn parcels confirmed in both the annual report and earnings presentation." },
            { badge:"Contradicts", color:"bg-terra-50 text-terra-700 border-terra-200",
              title:"Genuine conflict",
              desc:"A metric at two different values with no period, scope, or unit to explain it." },
            { badge:"Reconciled", color:"bg-lavender-50 text-lavender-700 border-lavender-200",
              title:"Context explains it",
              desc:"₹74,540 Mn standalone vs ₹81,415 Mn consolidated — same period, different scope." },
            { badge:"Limitation", color:"bg-gray-50 text-gray-500 border-gray-200",
              title:"Failure, documented",
              desc:"~50% of page numbers were wrong in a sample. Evidence text is always correct." },
          ].map(c=>(
            <div key={c.badge} className="bg-white rounded-xl border border-gray-100 p-5 space-y-2.5 shadow-sm">
              <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${c.color}`}>
                {c.badge}
              </span>
              <p className="text-sm font-semibold text-gray-900 leading-snug">{c.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── final CTA ── */}
      <section className="py-16 border-t border-gray-100 text-center">
        <div className="max-w-xl mx-auto px-6 space-y-4">
          <h2 className="text-3xl font-extrabold text-gray-900">Ready to try it?</h2>
          <p className="text-gray-500">Drop PDFs in. Facts appear within seconds.</p>
          <button onClick={()=>navigate("/app")}
            className="bg-sea-600 hover:bg-sea-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors shadow-sm">
            Open FactLens →
          </button>
        </div>
      </section>

      {/* ── footer ── */}
      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        Built by Smriti Prajapati · Superjoin Engineering Intern Assignment 2026
      </footer>
    </div>
  );
}
