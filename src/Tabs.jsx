import React from "react";

export default function Tabs({ tab, onChange }) {
  const classes = (isActive) =>
    `px-3 py-2 rounded-md text-sm font-semibold transition ${isActive ? "bg-sky-600 text-white shadow" : "bg-white text-slate-700 border"}`;

  return (
    <div className="inline-flex items-center gap-2 bg-transparent rounded-md p-1">
      <button aria-pressed={tab === 1} className={classes(tab === 1)} onClick={() => onChange(1)}>
        1
      </button>
      <button aria-pressed={tab === 2} className={classes(tab === 2)} onClick={() => onChange(2)}>
        2
      </button>
      <button aria-pressed={tab === 3} className={classes(tab === 3)} onClick={() => onChange(3)}>
        3
      </button>
    </div>
  );
}
