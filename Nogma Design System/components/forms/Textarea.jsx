import React from "react";

const CSS = `
.ng-textarea__el{
  width:100%; min-height:104px; padding:12px 14px; resize:vertical;
  background:var(--surface-card); border:var(--border-thin) solid var(--border-default);
  border-radius:var(--radius-md); font-family:var(--font-sans); font-size:var(--text-base);
  line-height:var(--leading-normal); color:var(--text-primary);
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.ng-textarea__el::placeholder{ color:var(--text-muted); }
.ng-textarea__el:focus{ outline:none; border-color:var(--border-focus); box-shadow:0 0 0 3px var(--ring); }
.ng-textarea__el:disabled{ opacity:.55; background:var(--bg-muted); }
.ng-textarea--error .ng-textarea__el{ border-color:var(--danger); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-textarea-css"))return;
  const s=document.createElement("style"); s.id="ng-textarea-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Multi-line text field. Shares label/hint/error chrome with Input. */
export function Textarea({ label, hint, error, id, className="", ...props }) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return (
    <div className={["ng-field", error?"ng-textarea--error":""].filter(Boolean).join(" ")}>
      {label ? <label className="ng-field__label" htmlFor={fid}>{label}</label> : null}
      <textarea id={fid} className={["ng-textarea__el", className].filter(Boolean).join(" ")} aria-invalid={!!error} {...props} />
      {error ? <span className="ng-field__error">{error}</span> : hint ? <span className="ng-field__hint">{hint}</span> : null}
    </div>
  );
}
