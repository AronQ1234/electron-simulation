// src/components/InfoDialog.jsx
import React, { useState, useId } from "react";

/**
 * InfoDialog
 *
 * Props:
 * - text: string (required) — content to show in the tooltip
 * - placement: "top" | "bottom" | "left" | "right" (default: "top")
 * - className: additional classes applied to the icon wrapper
 *
 * NOTE: Font Awesome must be loaded in your app (e.g. in index.html):
 * <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
 */
export default function InfoDialog({ text = "", placement = "top", className = "" }) {
  const [open, setOpen] = useState(false);
  const id = useId(); // unique id to link aria-describedby

  // tooltip placement classes (Tailwind)
  const placementMap = {
    top: "bottom-full mb-2 left-1/2 transform -translate-x-1/2",
    bottom: "top-full mt-2 left-1/2 transform -translate-x-1/2",
    left: "right-full mr-2 top-1/2 transform -translate-y-1/2",
    right: "left-full ml-2 top-1/2 transform -translate-y-1/2",
  };
  const placeClasses = placementMap[placement] || placementMap.top;

  return (
    <span className={`relative inline-block ${className}`}>

      {/* Icon (focusable) */}
      <span
        role="button"
        tabIndex={0}
        aria-describedby={id}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onTouchStart={() => setOpen((s) => !s)} // toggle on mobile tap
        className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sky-700 bg-sky-100/80 hover:bg-sky-200 active:bg-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400 transition"
        style={{ lineHeight: 0 }}
      >
        <i className="fa-solid fa-circle-info" aria-hidden="true" />
        <span className="sr-only">Information</span>
      </span>

      {/* Tooltip */}
      <div
        id={id}
        role="tooltip"
        aria-hidden={!open}
        className={`
          pointer-events-none
          absolute z-50
          ${placeClasses}
          w-64 max-w-xs
          transition-all duration-150 ease-out transform origin-center
          ${open ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95"}
        `}
      >
        <div
          className="
            bg-white dark:bg-slate-800 text-slate-900 dark:text-white
            text-sm leading-tight
            rounded-md shadow-lg ring-1 ring-slate-200 dark:ring-slate-700
            px-3 py-2 sm:px-4 sm:py-2
          "
        >
          <div className="text-xs">{text}</div>
        </div>
        {/* little caret */}
        <div className={`absolute ${placement === "top" ? "-bottom-1.5 left-1/2 -translate-x-1/2" : ""} ${placement === "bottom" ? "-top-1.5 left-1/2 -translate-x-1/2 rotate-180" : ""} ${placement === "left" ? "-right-1.5 top-1/2 -translate-y-1/2 rotate-90" : ""} ${placement === "right" ? "-left-1.5 top-1/2 -translate-y-1/2 -rotate-90" : ""}`}>
          <svg width="12" height="6" viewBox="0 0 12 6" fill="none" xmlns="http://www.w3.org/2000/svg" className="block">
            <path d="M0 6L6 0L12 6H0Z" fill="currentColor" className="text-white dark:text-slate-800" />
          </svg>
        </div>
      </div>
    </span>
  );
}
