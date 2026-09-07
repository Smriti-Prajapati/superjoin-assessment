const TYPE_COLORS = {
  financial_metric:       "bg-sea-50 text-sea-700 border-sea-200",
  operational_metric:     "bg-blue-50 text-blue-700 border-blue-200",
  macro_indicator:        "bg-purple-50 text-purple-700 border-purple-200",
  governance_event:       "bg-amber-50 text-amber-700 border-amber-200",
  personnel_appointment:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  personnel_resignation:  "bg-red-50 text-red-700 border-red-200",
  director_status:        "bg-orange-50 text-orange-700 border-orange-200",
  workforce_metric:       "bg-teal-50 text-teal-700 border-teal-200",
  esg_metric:             "bg-lime-50 text-lime-700 border-lime-200",
  customer_metric:        "bg-cyan-50 text-cyan-700 border-cyan-200",
  risk_factor:            "bg-rose-50 text-rose-700 border-rose-200",
  company_description:    "bg-gray-50 text-gray-600 border-gray-200",
  technology_capability:  "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export default function FactTypeBadge({ type }) {
  const style = TYPE_COLORS[type] ?? "bg-gray-50 text-gray-500 border-gray-200";
  const label = type?.replace(/_/g, " ") ?? "unknown";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border ${style}`}>
      {label}
    </span>
  );
}
