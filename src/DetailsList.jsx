import React from "react";
import InfoDialog from "./InfoDialog";

/**
 * DetailsList
 *
 * Props:
 * - title: string — main title shown next to the InfoDialog
 * - infoText: string — tooltip text shown by the InfoDialog
 * - items: string[] — array of strings rendered as a list inside the details
 * - defaultOpen: boolean — whether <details> starts open (default: false)
 * - className: string — extra classes for outer wrapper
 *
 * Example usage:
 * <DetailsList
 *   title="Purpose of graphs"
 *   infoText="Explains what each graph shows"
 *   items={[ "Transmission vs E — shows T(E)", "Wavefunction — |ψ|² across barrier" ]}
 * />
 */
export default function DetailsList({
  title = "Details",
  infoText = "",
  items = [],
  defaultOpen = false,
  className = "",
}) {
  return (
    <details
      open={defaultOpen}
      className={`group bg-white rounded-lg shadow-sm border border-slate-100 p-3 ${className}`}
    >
      <summary
        className="
          list-none cursor-pointer select-none
          flex items-center justify-between gap-3
          focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400
        "
      >
        <div className="flex items-center gap-2">
          {/* InfoDialog placed left of title per your example */}
          <div className="shrink-0">
            <InfoDialog text={infoText} placement="left" />
          </div>

          <div className="text-sm font-semibold">{title}</div>
        </div>

        {/* caret icon — rotates when open */}
        <svg
          className="w-4 h-4 text-slate-500 transition-transform duration-150 transform group-open:rotate-180"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      <div className="mt-3">
        {items && items.length > 0 ? (
          <ul className="list-disc list-inside space-y-2 text-sm text-slate-700">
            {items.map((it, idx) => (
              <li key={idx} className="leading-snug">
                {it}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-slate-500">No items provided.</div>
        )}
      </div>
    </details>
  );
}
