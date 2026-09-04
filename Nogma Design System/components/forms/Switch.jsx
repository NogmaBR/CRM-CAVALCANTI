import React from "react";

const CSS = `
.ng-switch{ display:inline-flex; align-items:center; gap:10px; cursor:pointer; font-family:var(--font-sans); user-select:none; }
.ng-switch--disabled{ opacity:.5; pointer-events:none; }
.ng-switch input{ position:absolute; opacity:0; width:0; height:0; }
.ng-switch__track{
  position:relative; width:44px; height:26px; border-radius:var(--radius-pill);
  background:var(--neutral-300); transition:background var(--dur-base) var(--ease-out); flex:none;
}
.ng-switch__thumb{
  position:absolute; top:3px; left:3px; width:20px; height:20px; border-radius:50%;
  background:#fff; box-shadow:var(--shadow-sm); transition:transform var(--dur-base) var(--ease-out);
}
.ng-switch input:checked + .ng-switch__track{ background:var(--petroleum-900); }
.ng-switch input:checked + .ng-switch__track .ng-switch__thumb{ transform:translateX(18px); }
.ng-switch input:focus-visible + .ng-switch__track{ box-shadow:0 0 0 3px var(--ring); }
.ng-switch--lime input:checked + .ng-switch__track{ background:var(--lime-500); }
.ng-switch--lime input:checked + .ng-switch__track .ng-switch__thumb{ background:var(--petroleum-950); }
.ng-switch__label{ font-size:var(--text-base); color:var(--text-primary); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-switch-css"))return;
  const s=document.createElement("style"); s.id="ng-switch-css"; s.textContent=CSS; document.head.appendChild(s); }

/** Toggle switch. `tone="lime"` for an accented on-state. */
export function Switch({ label, disabled, tone="petroleum", id, className="", ...props }) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return (
    <label htmlFor={fid} className={["ng-switch", tone==="lime"?"ng-switch--lime":"", disabled?"ng-switch--disabled":"", className].filter(Boolean).join(" ")}>
      <input id={fid} type="checkbox" role="switch" disabled={disabled} {...props} />
      <span className="ng-switch__track"><span className="ng-switch__thumb"/></span>
      {label ? <span className="ng-switch__label">{label}</span> : null}
    </label>
  );
}
