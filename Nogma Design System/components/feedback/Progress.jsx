import React from "react";

const CSS = `
.ng-progress{ font-family:var(--font-sans); display:flex; flex-direction:column; gap:8px; }
.ng-progress__head{ display:flex; justify-content:space-between; font-size:var(--text-sm); }
.ng-progress__label{ color:var(--text-secondary); font-weight:var(--fw-medium); }
.ng-progress__val{ color:var(--text-primary); font-weight:var(--fw-semibold); font-variant-numeric:tabular-nums; }
.ng-progress__track{ height:8px; border-radius:var(--radius-pill); background:var(--neutral-200); overflow:hidden; }
.ng-progress__fill{ height:100%; border-radius:var(--radius-pill); background:var(--petroleum-800);
  transition:width var(--dur-slow) var(--ease-out); }
.ng-progress--lime .ng-progress__fill{ background:var(--lime-500); }
.on-dark .ng-progress__track,[data-theme="dark"] .ng-progress__track{ background:color-mix(in srgb,#fff 14%,transparent); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-progress-css"))return;
  const s=document.createElement("style"); s.id="ng-progress-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Determinate progress bar (0–100). */
export function Progress({ value=0, label, showValue=false, tone="petroleum", className="", ...props }) {
  React.useEffect(inject, []);
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={["ng-progress", tone==="lime"?"ng-progress--lime":"", className].filter(Boolean).join(" ")} {...props}>
      {(label || showValue) ? (
        <div className="ng-progress__head">
          {label ? <span className="ng-progress__label">{label}</span> : <span/>}
          {showValue ? <span className="ng-progress__val">{Math.round(pct)}%</span> : null}
        </div>
      ) : null}
      <div className="ng-progress__track" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="ng-progress__fill" style={{width:`${pct}%`}} />
      </div>
    </div>
  );
}
