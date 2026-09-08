type RelType = "corroborates" | "contradicts" | "reconciled_by_context" | "related";

const STYLES: Record<RelType, string> = {
  corroborates:          "bg-sea-100 text-sea-700 border-sea-200",
  contradicts:           "bg-terra-100 text-terra-700 border-terra-200",
  reconciled_by_context: "bg-lavender-100 text-lavender-700 border-lavender-200",
  related:               "bg-gray-100 text-gray-500 border-gray-200",
};

const LABELS: Record<RelType, string> = {
  corroborates:          "corroborates",
  contradicts:           "contradicts",
  reconciled_by_context: "reconciled",
  related:               "related",
};

export default function RelationshipBadge({ type }: { type: string | null | undefined }) {
  const key = (type as RelType) ?? "related";
  const style = STYLES[key] ?? "bg-gray-100 text-gray-500 border-gray-200";
  const label = LABELS[key] ?? (type ?? "unknown");
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}
