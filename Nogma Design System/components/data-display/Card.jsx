import React from "react";

const CSS = `
.ng-card{
  background:var(--surface-card); border:var(--border-hair) solid var(--border-subtle);
  border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);
  transition:box-shadow var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out), border-color var(--dur-base);
  overflow:hidden;
}
.ng-card--pad{ padding:var(--space-6); }
.ng-card--interactive{ cursor:pointer; }
.ng-card--interactive:hover{ box-shadow:var(--shadow-lg); transform:translateY(-2px); border-color:var(--border-default); }
.ng-card--flat{ box-shadow:none; }
.ng-card--accent{ border-top:3px solid var(--lime-500); }
.on-dark .ng-card,[data-theme="dark"] .ng-card{ box-shadow:none; }
.ng-card__header{ display:flex; flex-direction:column; gap:4px; margin-bottom:var(--space-4); }
.ng-card__title{ font-family:var(--font-sans); font-weight:var(--fw-extrabold); font-size:var(--text-xl);
  letter-spacing:var(--tracking-tight); color:var(--text-primary); }
.ng-card__subtitle{ font-size:var(--text-sm); color:var(--text-secondary); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-card-css"))return;
  const s=document.createElement("style"); s.id="ng-card-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Surface container. Compose freely, or pass `title`/`subtitle` for a standard header. */
export function Card({ title, subtitle, children, interactive=false, flat=false, accent=false, padded=true, className="", ...props }) {
  React.useEffect(inject, []);
  const cls = ["ng-card", padded?"ng-card--pad":"", interactive?"ng-card--interactive":"", flat?"ng-card--flat":"", accent?"ng-card--accent":"", className].filter(Boolean).join(" ");
  return (
    <div className={cls} {...props}>
      {(title || subtitle) ? (
        <div className="ng-card__header">
          {title ? <div className="ng-card__title">{title}</div> : null}
          {subtitle ? <div className="ng-card__subtitle">{subtitle}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
