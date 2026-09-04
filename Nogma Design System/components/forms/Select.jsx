import React from "react";

const CSS = `
.ng-select{ position:relative; display:flex; align-items:center; }
.ng-select__el{
  appearance:none; -webkit-appearance:none; width:100%; height:44px;
  padding:0 40px 0 14px; background:var(--surface-card);
  border:var(--border-thin) solid var(--border-default); border-radius:var(--radius-md);
  font-family:var(--font-sans); font-size:var(--text-base); color:var(--text-primary); cursor:pointer;
  transition:border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
}
.ng-select__el:focus{ outline:none; border-color:var(--border-focus); box-shadow:0 0 0 3px var(--ring); }
.ng-select__el:disabled{ opacity:.55; background:var(--bg-muted); cursor:not-allowed; }
.ng-select__chev{ position:absolute; right:14px; pointer-events:none; color:var(--text-muted);
  width:16px; height:16px; display:inline-flex; }
.ng-select__chev svg{ width:16px; height:16px; }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-select-css"))return;
  const s=document.createElement("style"); s.id="ng-select-css"; s.textContent=CSS; document.head.appendChild(s); }

const Chevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

/** Native select styled to the Nogma system. Pass `options` or children `<option>`s. */
export function Select({ label, hint, error, id, options, children, className="", ...props }) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return (
    <div className="ng-field">
      {label ? <label className="ng-field__label" htmlFor={fid}>{label}</label> : null}
      <div className="ng-select">
        <select id={fid} className={["ng-select__el", className].filter(Boolean).join(" ")} {...props}>
          {options ? options.map(o => {
            const v = typeof o === "string" ? o : o.value;
            const t = typeof o === "string" ? o : o.label;
            return <option key={v} value={v}>{t}</option>;
          }) : children}
        </select>
        <span className="ng-select__chev"><Chevron/></span>
      </div>
      {error ? <span className="ng-field__error">{error}</span> : hint ? <span className="ng-field__hint">{hint}</span> : null}
    </div>
  );
}
