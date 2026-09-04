import React from "react";

const CSS = `
.ng-badge{
  display:inline-flex; align-items:center; gap:5px; font-family:var(--font-sans);
  font-weight:var(--fw-semibold); font-size:var(--text-xs); line-height:1;
  padding:5px 10px; border-radius:var(--radius-pill); border:var(--border-hair) solid transparent;
  white-space:nowrap; letter-spacing:.01em;
}
.ng-badge__dot{ width:6px; height:6px; border-radius:50%; background:currentColor; }
.ng-badge--neutral{ background:var(--neutral-100); color:var(--neutral-700); }
.ng-badge--petroleum{ background:var(--petroleum-050); color:var(--petroleum-800); }
.ng-badge--lime{ background:var(--lime-050); color:var(--petroleum-800); border-color:var(--lime-300); }
.ng-badge--solid-lime{ background:var(--lime-500); color:var(--petroleum-950); }
.ng-badge--solid{ background:var(--petroleum-800); color:#fff; }
.ng-badge--success{ background:var(--success-bg); color:var(--success); }
.ng-badge--warning{ background:var(--warning-bg); color:#8a5d00; }
.ng-badge--danger{ background:var(--danger-bg); color:var(--danger); }
.ng-badge--outline{ background:transparent; border-color:var(--border-default); color:var(--text-secondary); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-badge-css"))return;
  const s=document.createElement("style"); s.id="ng-badge-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Compact status/label pill. `dot` prepends a status dot. */
export function Badge({ children, variant="neutral", dot=false, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <span className={["ng-badge", `ng-badge--${variant}`, className].filter(Boolean).join(" ")} {...props}>
      {dot ? <span className="ng-badge__dot" /> : null}
      {children}
    </span>
  );
}
