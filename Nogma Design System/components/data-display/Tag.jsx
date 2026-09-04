import React from "react";

const CSS = `
.ng-tag{
  display:inline-flex; align-items:center; gap:6px; font-family:var(--font-sans);
  font-weight:var(--fw-medium); font-size:var(--text-sm); line-height:1;
  padding:6px 10px; border-radius:var(--radius-sm);
  background:var(--neutral-100); color:var(--text-primary); border:var(--border-hair) solid transparent;
}
.ng-tag--outline{ background:transparent; border-color:var(--border-default); }
.ng-tag__remove{
  display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px;
  border:none; background:transparent; color:var(--text-muted); cursor:pointer; padding:0; border-radius:50%;
}
.ng-tag__remove:hover{ background:var(--neutral-200); color:var(--text-primary); }
.ng-tag__remove svg{ width:12px; height:12px; }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-tag-css"))return;
  const s=document.createElement("style"); s.id="ng-tag-css"; s.textContent=CSS; document.head.appendChild(s); }

const X = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>);

/** Removable keyword/filter tag. Pass `onRemove` to show the close affordance. */
export function Tag({ children, onRemove, outline=false, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <span className={["ng-tag", outline?"ng-tag--outline":"", className].filter(Boolean).join(" ")} {...props}>
      {children}
      {onRemove ? <button type="button" className="ng-tag__remove" aria-label="Remover" onClick={onRemove}><X/></button> : null}
    </span>
  );
}
