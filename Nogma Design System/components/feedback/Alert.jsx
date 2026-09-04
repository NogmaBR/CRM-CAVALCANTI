import React from "react";

const CSS = `
.ng-alert{
  display:flex; gap:12px; padding:14px 16px; border-radius:var(--radius-md);
  font-family:var(--font-sans); border:var(--border-hair) solid transparent;
  background:var(--bg-subtle); color:var(--text-primary); align-items:flex-start;
}
.ng-alert__icon{ flex:none; width:20px; height:20px; display:inline-flex; margin-top:1px; }
.ng-alert__icon svg{ width:20px; height:20px; }
.ng-alert__body{ display:flex; flex-direction:column; gap:2px; flex:1; min-width:0; }
.ng-alert__title{ font-weight:var(--fw-bold); font-size:var(--text-sm); }
.ng-alert__msg{ font-size:var(--text-sm); color:var(--text-primary); line-height:1.45; }
.ng-alert--info{ background:var(--petroleum-050); border-color:var(--petroleum-100); }
.ng-alert--info .ng-alert__icon{ color:var(--petroleum-600); }
.ng-alert--success{ background:var(--success-bg); border-color:color-mix(in srgb,var(--success) 25%,transparent); }
.ng-alert--success .ng-alert__icon{ color:var(--success); }
.ng-alert--warning{ background:var(--warning-bg); border-color:color-mix(in srgb,var(--warning) 30%,transparent); }
.ng-alert--warning .ng-alert__icon{ color:#8a5d00; }
.ng-alert--danger{ background:var(--danger-bg); border-color:color-mix(in srgb,var(--danger) 25%,transparent); }
.ng-alert--danger .ng-alert__icon{ color:var(--danger); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-alert-css"))return;
  const s=document.createElement("style"); s.id="ng-alert-css"; s.textContent=CSS; document.head.appendChild(s); }

const ICONS = {
  info:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  success: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>,
  warning: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  danger:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>,
};

/** Inline contextual message. Also used as a toast body. */
export function Alert({ variant="info", title, children, icon, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <div role="status" className={["ng-alert", `ng-alert--${variant}`, className].filter(Boolean).join(" ")} {...props}>
      <span className="ng-alert__icon">{icon || ICONS[variant]}</span>
      <div className="ng-alert__body">
        {title ? <span className="ng-alert__title">{title}</span> : null}
        {children ? <span className="ng-alert__msg">{children}</span> : null}
      </div>
    </div>
  );
}
