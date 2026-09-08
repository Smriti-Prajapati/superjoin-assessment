const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "https://factlens-backend-n5mi.onrender.com";

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface Document {
  id: number;
  filename: string;
  filepath?: string;
  source_group: string | null;
  page_count: number | null;
  ingested_at: string;
}

export interface Fact {
  id: number;
  document_id: number;
  subject: string;
  value: string | null;
  unit: string | null;
  period: string | null;
  period_normalized: string | null;
  scope: string | null;
  entity: string | null;
  fact_type: string | null;
  estimate_or_actual: string | null;
  as_of_date: string | null;
  extra_context: string | null;
  source_doc: string;
  page: number | null;
  evidence_snippet: string | null;
  confidence: number | null;
  created_at: string;
}

export interface Relationship {
  id: number;
  fact_id_a: number;
  fact_id_b: number;
  relationship_type: "corroborates" | "contradicts" | "reconciled_by_context";
  explanation: string | null;
  confidence: number | null;
  created_at: string;
  subject_a: string;
  value_a: string | null;
  unit_a: string | null;
  period_a: string | null;
  source_a: string;
  page_a: number | null;
  entity_a: string | null;
  type_a: string | null;
  subject_b: string;
  value_b: string | null;
  unit_b: string | null;
  period_b: string | null;
  source_b: string;
  page_b: number | null;
  entity_b: string | null;
  type_b: string | null;
}

export interface FactFilter {
  fact_type?: string;
  entity?: string;
  period?: string;
  source_doc?: string;
  limit?: number;
  offset?: number;
}

export interface RelationshipFilter {
  relationship_type?: string;
  limit?: number;
  offset?: number;
}

function toQS(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v != null && v !== "")
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return qs ? `?${qs}` : "";
}

export interface QueueStatus {
  queued: number;
  current: { filename?: string; started_at?: number } | null;
}

export interface DocProgress {
  document_id: number;
  stage: "queued" | "extracting" | "embedding" | "linking" | "done";
  batches_done: number;
  batches_total: number;
  facts_found: number;
  relationships_found: number;
  updated_at?: string;
}

export const api = {
  uploadDocument: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return req<{ status: string; filename: string }>("/documents", { method: "POST", body: form });
  },
  listDocuments: () => req<Document[]>("/documents"),
  getDocument: (id: number) => req<Document>(`/documents/${id}`),
  getDocumentFacts: (id: number) => req<Fact[]>(`/documents/${id}/facts`),
  listFacts: (params: FactFilter = {}) =>
    req<Fact[]>(`/facts${toQS(params as Record<string, string | number | undefined>)}`),
  getFact: (id: number) => req<Fact>(`/facts/${id}`),
  getFactRelationships: (id: number) => req<Relationship[]>(`/facts/${id}/relationships`),
  listRelationships: (params: RelationshipFilter = {}) =>
    req<Relationship[]>(`/relationships${toQS(params as Record<string, string | number | undefined>)}`),
  getQueueStatus: () => req<QueueStatus>("/queue"),
  getProgress: (docId: number) => req<DocProgress>(`/progress/${docId}`),
};
