import React from "react";

const CSS = `
.ng-check{ display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; font-family:var(--font-sans); user-select:none; }
.ng-check--disabled{ opacity:.5; pointer-events:none; }
.ng-check__box{
  flex:none; width:20px; height:20px; margin-top:1px; border-radius:var(--radius-xs);
  border:var(--border-thin) solid var(--border-strong); background:var(--surface-card);
  display:inline-flex; align-items:center; justify-content:center; color:var(--petroleum-950);
  transition:background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.ng-check__box svg{ width:13px; height:13px; opacity:0; transform:scale(.6); transition:opacity var(--dur-fast), transform var(--dur-fast) var(--ease-out); }
.ng-check input{ position:absolute; opacity:0; width:0; height:0; }
.ng-check input:checked + .ng-check__box{ background:var(--lime-500); border-color:var(--lime-500); }
.ng-check input:checked + .ng-check__box svg{ opacity:1; transform:scale(1); }
.ng-check input:focus-visible + .ng-check__box{ box-shadow:0 0 0 3px var(--ring); }
.ng-check__body{ display:flex; flex-direction:column; gap:2px; }
.ng-check__label{ font-size:var(--text-base); color:var(--text-primary); line-height:1.35; }
.ng-check__desc{ font-size:var(--text-sm); color:var(--text-muted); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-check-css"))return;
  const s=document.createElement("style"); s.id="ng-check-css"; s.textContent=CSS; document.head.appendChild(s); }

const Tick = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>);

/** Checkbox with lime fill when checked. Supports label + description. */
export function Checkbox({ label, description, disabled, id, className="", ...props }) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return (
    <label htmlFor={fid} className={["ng-check", disabled?"ng-check--disabled":"", className].filter(Boolean).join(" ")}>
      <input id={fid} type="checkbox" disabled={disabled} {...props} />
      <span className="ng-check__box"><Tick/></span>
      {(label || description) ? (
        <span className="ng-check__body">
          {label ? <span className="ng-check__label">{label}</span> : null}
          {description ? <span className="ng-check__desc">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
