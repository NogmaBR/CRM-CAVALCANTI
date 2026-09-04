import React from "react";

const CSS = `
.ng-avatar{
  display:inline-flex; align-items:center; justify-content:center; flex:none;
  border-radius:var(--radius-pill); overflow:hidden; font-family:var(--font-sans);
  font-weight:var(--fw-bold); background:var(--petroleum-800); color:var(--lime-500);
  position:relative; user-select:none;
}
.ng-avatar img{ width:100%; height:100%; object-fit:cover; }
.ng-avatar--square{ border-radius:var(--radius-md); }
.ng-avatar--xs{ width:28px; height:28px; font-size:11px; }
.ng-avatar--sm{ width:36px; height:36px; font-size:13px; }
.ng-avatar--md{ width:44px; height:44px; font-size:15px; }
.ng-avatar--lg{ width:56px; height:56px; font-size:19px; }
.ng-avatar--xl{ width:72px; height:72px; font-size:24px; }
.ng-avatar__status{
  position:absolute; right:0; bottom:0; width:28%; height:28%; border-radius:50%;
  border:2px solid var(--surface-card); background:var(--success);
}
.ng-avatar__status--away{ background:var(--warning); }
.ng-avatar__status--offline{ background:var(--neutral-400); }
`;
function inject(){ if(typeof document==="undefined"||document.getElementById("ng-avatar-css"))return;
  const s=document.createElement("style"); s.id="ng-avatar-css"; s.textContent=CSS; document.head.appendChild(s); }

function initials(name=""){ return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]||"").join("").toUpperCase(); }

/** User avatar — image with initials fallback. Optional presence `status`. */
export function Avatar({ src, name="", size="md", square=false, status, className="", ...props }) {
  React.useEffect(inject, []);
  return (
    <span className={["ng-avatar", `ng-avatar--${size}`, square?"ng-avatar--square":"", className].filter(Boolean).join(" ")} title={name} {...props}>
      {src ? <img src={src} alt={name} /> : <span>{initials(name)}</span>}
      {status ? <span className={`ng-avatar__status ng-avatar__status--${status}`} /> : null}
    </span>
  );
}
