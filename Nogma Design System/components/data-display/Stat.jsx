import React from "react";

const CSS = `
.ng-stat{ display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans); }
.ng-stat__label{ font-size:var(--text-sm); color:var(--text-secondary); font-weight:var(--fw-medium); }
.ng-stat__value{ font-family:var(--font-display); font-weight:var(--fw-bold); font-size:var(--text-4xl);
  letter-spacing:var(--tracking-tight); line-height:1; color:var(--text-primary); }
.ng-stat__row{ display:flex; align-items:baseline; gap:10px; }
.ng-stat__delta{ display:inline-flex; align-items:center; gap:3px; font-size:var(--text-sm); font-weight:var(--fw-semibold); }
.ng-stat__delta--up{ color:var(--success); }
.ng-stat__delta--down{ color:var(--danger); }
.ng-stat__delta svg{ width:14px; height:14px; }
.ng-stat__caption{ font-size:var(--text-xs); color:var(--text-muted); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-stat-css"))return;
  const s=document.createElement("style"); s.id="ng-stat-css"; s.textContent=CSS; document.head.appendChild(s); }

const Arrow = (up) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{up ? <path d="M7 17 17 7M9 7h8v8"/> : <path d="M7 7l10 10M17 9v8H9"/>}</svg>);

/** Headline metric with optional delta and caption. Value uses the Agency display face. */
export function Stat({ label, value, delta, direction="up", caption, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <div className={["ng-stat", className].filter(Boolean).join(" ")} {...props}>
      {label ? <span className="ng-stat__label">{label}</span> : null}
      <div className="ng-stat__row">
        <span className="ng-stat__value">{value}</span>
        {delta != null ? (
          <span className={`ng-stat__delta ng-stat__delta--${direction}`}>{Arrow(direction==="up")}{delta}</span>
        ) : null}
      </div>
      {caption ? <span className="ng-stat__caption">{caption}</span> : null}
    </div>
  );
}
