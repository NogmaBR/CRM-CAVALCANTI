import React from "react";

const CSS = `
.ng-field{ display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans); }
.ng-field__label{ font-size:var(--text-sm); font-weight:var(--fw-semibold); color:var(--text-primary); }
.ng-field__hint{ font-size:var(--text-xs); color:var(--text-muted); }
.ng-field__error{ font-size:var(--text-xs); color:var(--danger); font-weight:var(--fw-medium); }
.ng-input{
  display:flex; align-items:center; gap:8px; height:44px; padding:0 14px;
  background:var(--surface-card); border:var(--border-thin) solid var(--border-default);
  border-radius:var(--radius-md); transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.ng-input:focus-within{ border-color:var(--border-focus); box-shadow:0 0 0 3px var(--ring); }
.ng-input--error{ border-color:var(--danger); }
.ng-input--error:focus-within{ box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 30%,transparent); }
.ng-input--disabled{ opacity:.55; pointer-events:none; background:var(--bg-muted); }
.ng-input__el{
  flex:1; min-width:0; border:none; background:transparent; outline:none;
  font-family:var(--font-sans); font-size:var(--text-base); color:var(--text-primary);
}
.ng-input__el::placeholder{ color:var(--text-muted); }
.ng-input__aff{ display:inline-flex; color:var(--text-muted); flex:none; }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-input-css"))return;
  const s=document.createElement("style"); s.id="ng-input-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Text field with optional label, hint, error, and leading/trailing adornments. */
export function Input({ label, hint, error, leading, trailing, id, disabled, className="", ...props }) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return (
    <div className="ng-field">
      {label ? <label className="ng-field__label" htmlFor={fid}>{label}</label> : null}
      <div className={["ng-input", error?"ng-input--error":"", disabled?"ng-input--disabled":"", className].filter(Boolean).join(" ")}>
        {leading ? <span className="ng-input__aff">{leading}</span> : null}
        <input id={fid} className="ng-input__el" disabled={disabled} aria-invalid={!!error} {...props} />
        {trailing ? <span className="ng-input__aff">{trailing}</span> : null}
      </div>
      {error ? <span className="ng-field__error">{error}</span> : hint ? <span className="ng-field__hint">{hint}</span> : null}
    </div>
  );
}
