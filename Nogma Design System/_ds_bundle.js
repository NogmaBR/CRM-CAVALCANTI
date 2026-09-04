/* @ds-bundle: {"format":4,"namespace":"NogmaDesignSystem_54b71f","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"IconButton","sourcePath":"components/buttons/IconButton.jsx"},{"name":"Avatar","sourcePath":"components/data-display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/data-display/Badge.jsx"},{"name":"Card","sourcePath":"components/data-display/Card.jsx"},{"name":"Stat","sourcePath":"components/data-display/Stat.jsx"},{"name":"Tag","sourcePath":"components/data-display/Tag.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Progress","sourcePath":"components/feedback/Progress.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"RadioGroup","sourcePath":"components/forms/RadioGroup.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"assets/icons.jsx":"e772fcdf20bd","components/buttons/Button.jsx":"4196e2fa976d","components/buttons/IconButton.jsx":"cb10db561b3a","components/data-display/Avatar.jsx":"5bf8e6144847","components/data-display/Badge.jsx":"a1d65ddcc43f","components/data-display/Card.jsx":"13f1369a1556","components/data-display/Stat.jsx":"cbd567507dfe","components/data-display/Tag.jsx":"0e6122be17b5","components/feedback/Alert.jsx":"6f0f3ff821c5","components/feedback/Dialog.jsx":"15cea4cbbf7b","components/feedback/Progress.jsx":"a488d32c07a4","components/feedback/Tooltip.jsx":"b4de3e814d90","components/forms/Checkbox.jsx":"3c34de85cf3f","components/forms/Input.jsx":"f454f3ac8b9f","components/forms/RadioGroup.jsx":"9e0911187ec4","components/forms/Select.jsx":"cda57cbe1928","components/forms/Switch.jsx":"a3b781c6eaff","components/forms/Textarea.jsx":"88b7185918df","components/navigation/Tabs.jsx":"dbc8c0de40ee","ui_kits/nogmaos/AppScreens.jsx":"862379d887a7","ui_kits/nogmaos/Chrome.jsx":"6aea6dac5b44","ui_kits/nogmaos/LoginScreen.jsx":"d1fd2ed3bbcf"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.NogmaDesignSystem_54b71f = window.NogmaDesignSystem_54b71f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/icons.jsx
try { (() => {
/* Lucide-style inline icons (ISC) — robust, offline, no CDN timing.
   Shared by the Nogma UI kits. Export: window.NogmaIcon */
const NG_PATHS = {
  "dashboard": '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  "workflow": '<rect width="8" height="8" x="3" y="3" rx="2"/><path d="M7 11v4a2 2 0 0 0 2 2h4"/><rect width="8" height="8" x="13" y="13" rx="2"/>',
  "bot": '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
  "chart": '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><rect x="7" y="13" width="3" height="5" rx="1"/><rect x="12" y="9" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="13" rx="1"/>',
  "settings": '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  "bell": '<path d="M10.268 21a2 2 0 0 0 3.464 0M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  "search": '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  "plus": '<path d="M5 12h14M12 5v14"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "check": '<path d="M20 6 9 17l-5-5"/>',
  "x": '<path d="M18 6 6 18M6 6l12 12"/>',
  "arrow-right": '<path d="M5 12h14M12 5l7 7-7 7"/>',
  "arrow-up-right": '<path d="M7 7h10v10M7 17 17 7"/>',
  "play": '<polygon points="6 3 20 12 6 21 6 3"/>',
  "pause": '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  "more-horizontal": '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  "zap": '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  "clock": '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  "file-text": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8m8 4H8m8 4H8"/>',
  "users": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  "mail": '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  "lock": '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "sparkles": '<path d="M9.94 14.66A1 1 0 0 1 9 14a1 1 0 0 1-.94-.66L7 10.5 3.66 9.44A1 1 0 0 1 3 8.5a1 1 0 0 1 .66-.94L7 6.5l1.06-3.34a1 1 0 0 1 1.88 0L11 6.5l3.34 1.06a1 1 0 0 1 0 1.88L11 10.5z"/><path d="M18 5v4M20 7h-4M18 17v4M20 19h-4"/>',
  "filter": '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  "calendar": '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  "trending-up": '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  "log-out": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  "message-square": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  "send": '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  "sliders": '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  "home": '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  "circle-check": '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  "help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  "external-link": '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  "menu": '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  "star": '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  "gauge": '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'
};
function NogmaIcon({
  name,
  size = 20,
  strokeWidth = 2,
  color = "currentColor",
  style,
  className = ""
}) {
  const p = NG_PATHS[name] || "";
  return React.createElement("svg", {
    className: "ng-ic " + className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      display: "inline-block",
      flex: "none",
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: p
    }
  });
}
window.NogmaIcon = NogmaIcon;
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/icons.jsx", error: String((e && e.message) || e) }); }

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Inject component styles once (design-system tokens drive all values). */
const CSS = `
.ng-btn{
  --_bg: var(--brand); --_fg: var(--brand-text); --_bd: transparent;
  display:inline-flex; align-items:center; justify-content:center; gap:.5em;
  font-family:var(--font-sans); font-weight:var(--fw-semibold);
  letter-spacing:var(--tracking-tight); line-height:1; white-space:nowrap;
  border:var(--border-thin) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer;
  transition:transform var(--dur-fast) var(--ease-out),
             background var(--dur-base) var(--ease-out),
             box-shadow var(--dur-base) var(--ease-out), opacity var(--dur-base);
  -webkit-tap-highlight-color:transparent; user-select:none; text-decoration:none;
}
.ng-btn:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); }
.ng-btn:active{ transform:translateY(1px) scale(.985); }
.ng-btn[disabled]{ opacity:.45; pointer-events:none; }

/* sizes */
.ng-btn--sm{ height:36px; padding:0 14px; font-size:var(--text-sm); }
.ng-btn--md{ height:44px; padding:0 20px; font-size:var(--text-base); }
.ng-btn--lg{ height:52px; padding:0 28px; font-size:var(--text-lg); }
.ng-btn--block{ width:100%; }

/* variants */
.ng-btn--primary{ --_bg:var(--lime-500); --_fg:var(--petroleum-950); }
.ng-btn--primary:hover{ --_bg:var(--lime-300); box-shadow:var(--shadow-lime); }
.ng-btn--solid{ --_bg:var(--petroleum-800); --_fg:var(--white); }
.ng-btn--solid:hover{ --_bg:var(--petroleum-700); }
.ng-btn--secondary{ --_bg:transparent; --_fg:var(--text-primary); --_bd:var(--border-default); }
.ng-btn--secondary:hover{ --_bg:var(--neutral-50); --_bd:var(--border-strong); }
.ng-btn--ghost{ --_bg:transparent; --_fg:var(--text-primary); }
.ng-btn--ghost:hover{ --_bg:var(--neutral-100); }
.ng-btn--danger{ --_bg:var(--danger); --_fg:#fff; }
.ng-btn--danger:hover{ --_bg:color-mix(in srgb, var(--danger) 88%, #000); }
.on-dark .ng-btn--secondary,[data-theme="dark"] .ng-btn--secondary,.on-black .ng-btn--secondary,[data-theme="black"] .ng-btn--secondary{ --_fg:var(--white); }
.on-dark .ng-btn--ghost:hover,[data-theme="dark"] .ng-btn--ghost:hover,.on-black .ng-btn--ghost:hover,[data-theme="black"] .ng-btn--ghost:hover{ --_bg:color-mix(in srgb,#fff 12%,transparent); }
`;
function useInjected(id, css) {
  React.useEffect(() => {
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = css;
    document.head.appendChild(el);
  }, [id, css]);
}

/**
 * Nogma primary action button. `primary` = lime CTA, the brand's signature call to action.
 */
function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  leadingIcon,
  trailingIcon,
  as = "button",
  className = "",
  ...props
}) {
  useInjected("ng-btn-css", CSS);
  const Tag = as;
  const cls = ["ng-btn", `ng-btn--${variant}`, `ng-btn--${size}`, block ? "ng-btn--block" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, props), leadingIcon ? /*#__PURE__*/React.createElement("span", {
    className: "ng-btn__icon",
    "aria-hidden": "true"
  }, leadingIcon) : null, children, trailingIcon ? /*#__PURE__*/React.createElement("span", {
    className: "ng-btn__icon",
    "aria-hidden": "true"
  }, trailingIcon) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/buttons/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-iconbtn{
  --_bg:transparent; --_fg:var(--text-primary); --_bd:transparent;
  display:inline-flex; align-items:center; justify-content:center;
  border:var(--border-thin) solid var(--_bd); border-radius:var(--radius-md);
  background:var(--_bg); color:var(--_fg); cursor:pointer; padding:0;
  transition:background var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-base);
  -webkit-tap-highlight-color:transparent;
}
.ng-iconbtn:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); }
.ng-iconbtn:active{ transform:scale(.9); }
.ng-iconbtn[disabled]{ opacity:.45; pointer-events:none; }
.ng-iconbtn--sm{ width:36px; height:36px; }
.ng-iconbtn--md{ width:44px; height:44px; }
.ng-iconbtn--lg{ width:52px; height:52px; }
.ng-iconbtn--round{ border-radius:var(--radius-pill); }
.ng-iconbtn--ghost:hover{ --_bg:var(--neutral-100); }
.ng-iconbtn--outline{ --_bd:var(--border-default); }
.ng-iconbtn--outline:hover{ --_bg:var(--neutral-50); --_bd:var(--border-strong); }
.ng-iconbtn--primary{ --_bg:var(--lime-500); --_fg:var(--petroleum-950); }
.ng-iconbtn--primary:hover{ --_bg:var(--lime-300); }
.ng-iconbtn--solid{ --_bg:var(--petroleum-800); --_fg:#fff; }
.ng-iconbtn--solid:hover{ --_bg:var(--petroleum-700); }
.on-dark .ng-iconbtn,[data-theme="dark"] .ng-iconbtn,.on-black .ng-iconbtn,[data-theme="black"] .ng-iconbtn{ --_fg:var(--white); }
.on-dark .ng-iconbtn--ghost:hover,[data-theme="dark"] .ng-iconbtn--ghost:hover,.on-black .ng-iconbtn--ghost:hover,[data-theme="black"] .ng-iconbtn--ghost:hover{ --_bg:color-mix(in srgb,#fff 12%,transparent); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-iconbtn-css")) return;
  const s = document.createElement("style");
  s.id = "ng-iconbtn-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Square/round icon-only button. Always pass an accessible `label`. */
function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  round = false,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const cls = ["ng-iconbtn", `ng-iconbtn--${variant}`, `ng-iconbtn--${size}`, round ? "ng-iconbtn--round" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    className: cls,
    "aria-label": label,
    title: label
  }, props), icon);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-avatar-css")) return;
  const s = document.createElement("style");
  s.id = "ng-avatar-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
}

/** User avatar — image with initials fallback. Optional presence `status`. */
function Avatar({
  src,
  name = "",
  size = "md",
  square = false,
  status,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["ng-avatar", `ng-avatar--${size}`, square ? "ng-avatar--square" : "", className].filter(Boolean).join(" "),
    title: name
  }, props), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name
  }) : /*#__PURE__*/React.createElement("span", null, initials(name)), status ? /*#__PURE__*/React.createElement("span", {
    className: `ng-avatar__status ng-avatar__status--${status}`
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-badge-css")) return;
  const s = document.createElement("style");
  s.id = "ng-badge-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Compact status/label pill. `dot` prepends a status dot. */
function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["ng-badge", `ng-badge--${variant}`, className].filter(Boolean).join(" ")
  }, props), dot ? /*#__PURE__*/React.createElement("span", {
    className: "ng-badge__dot"
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-card-css")) return;
  const s = document.createElement("style");
  s.id = "ng-card-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Surface container. Compose freely, or pass `title`/`subtitle` for a standard header. */
function Card({
  title,
  subtitle,
  children,
  interactive = false,
  flat = false,
  accent = false,
  padded = true,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const cls = ["ng-card", padded ? "ng-card--pad" : "", interactive ? "ng-card--interactive" : "", flat ? "ng-card--flat" : "", accent ? "ng-card--accent" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, props), title || subtitle ? /*#__PURE__*/React.createElement("div", {
    className: "ng-card__header"
  }, title ? /*#__PURE__*/React.createElement("div", {
    className: "ng-card__title"
  }, title) : null, subtitle ? /*#__PURE__*/React.createElement("div", {
    className: "ng-card__subtitle"
  }, subtitle) : null) : null, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Card.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Stat.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-stat{ display:flex; flex-direction:column; gap:6px; font-family:var(--font-sans); }
.ng-stat__label{ font-size:var(--text-sm); color:var(--text-secondary); font-weight:var(--fw-medium); }
.ng-stat__value{ font-family:var(--font-display); font-weight:var(--fw-bold); font-size:var(--text-4xl);
  letter-spacing:var(--tracking-tight); line-height:1; color:var(--text-primary); }
.ng-stat__row{ display:flex; align-items:baseline; gap:10px; }
.ng-stat__delta{ display:inline-flex; align-items:center; gap:3px; font-size:var(--text-sm); font-weight:var(--fw-semibold); }
.ng-stat__delta--up{ color:var(--success); }
.ng-stat__delta--down{ color:var(--danger); }
.ng-stat__delta svg{ width:14px; height:14px; }
.ng-stat__caption{ font-size:var(--text-xs); color:var(--text-muted); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-stat-css")) return;
  const s = document.createElement("style");
  s.id = "ng-stat-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
const Arrow = up => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.6",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, up ? /*#__PURE__*/React.createElement("path", {
  d: "M7 17 17 7M9 7h8v8"
}) : /*#__PURE__*/React.createElement("path", {
  d: "M7 7l10 10M17 9v8H9"
}));

/** Headline metric with optional delta and caption. Value uses the Agency display face. */
function Stat({
  label,
  value,
  delta,
  direction = "up",
  caption,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["ng-stat", className].filter(Boolean).join(" ")
  }, props), label ? /*#__PURE__*/React.createElement("span", {
    className: "ng-stat__label"
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "ng-stat__row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ng-stat__value"
  }, value), delta != null ? /*#__PURE__*/React.createElement("span", {
    className: `ng-stat__delta ng-stat__delta--${direction}`
  }, Arrow(direction === "up"), delta) : null), caption ? /*#__PURE__*/React.createElement("span", {
    className: "ng-stat__caption"
  }, caption) : null);
}
Object.assign(__ds_scope, { Stat });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Stat.jsx", error: String((e && e.message) || e) }); }

// components/data-display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-tag-css")) return;
  const s = document.createElement("style");
  s.id = "ng-tag-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
const X = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.4",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M18 6 6 18M6 6l12 12"
}));

/** Removable keyword/filter tag. Pass `onRemove` to show the close affordance. */
function Tag({
  children,
  onRemove,
  outline = false,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["ng-tag", outline ? "ng-tag--outline" : "", className].filter(Boolean).join(" ")
  }, props), children, onRemove ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ng-tag__remove",
    "aria-label": "Remover",
    onClick: onRemove
  }, /*#__PURE__*/React.createElement(X, null)) : null);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data-display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-alert-css")) return;
  const s = document.createElement("style");
  s.id = "ng-alert-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
const ICONS = {
  info: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 16v-4M12 8h.01"
  })),
  success: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M22 11.08V12a10 10 0 1 1-5.93-9.14"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m9 11 3 3L22 4"
  })),
  warning: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 9v4M12 17h.01"
  })),
  danger: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "10"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m15 9-6 6M9 9l6 6"
  }))
};

/** Inline contextual message. Also used as a toast body. */
function Alert({
  variant = "info",
  title,
  children,
  icon,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "status",
    className: ["ng-alert", `ng-alert--${variant}`, className].filter(Boolean).join(" ")
  }, props), /*#__PURE__*/React.createElement("span", {
    className: "ng-alert__icon"
  }, icon || ICONS[variant]), /*#__PURE__*/React.createElement("div", {
    className: "ng-alert__body"
  }, title ? /*#__PURE__*/React.createElement("span", {
    className: "ng-alert__title"
  }, title) : null, children ? /*#__PURE__*/React.createElement("span", {
    className: "ng-alert__msg"
  }, children) : null));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-dialog__overlay{
  position:fixed; inset:0; z-index:var(--z-modal); background:var(--overlay);
  display:flex; align-items:center; justify-content:center; padding:20px;
  backdrop-filter:blur(2px); animation:ngFade var(--dur-base) var(--ease-out);
}
.ng-dialog{
  width:100%; max-width:460px; background:var(--surface-card); border-radius:var(--radius-xl);
  box-shadow:var(--shadow-xl); overflow:hidden; animation:ngPop var(--dur-base) var(--ease-out);
  border:var(--border-hair) solid var(--border-subtle);
}
.ng-dialog__head{ padding:22px 24px 0; display:flex; flex-direction:column; gap:6px; }
.ng-dialog__title{ font-family:var(--font-sans); font-weight:var(--fw-extrabold); font-size:var(--text-2xl);
  letter-spacing:var(--tracking-tight); color:var(--text-primary); }
.ng-dialog__desc{ font-size:var(--text-sm); color:var(--text-secondary); line-height:1.5; }
.ng-dialog__body{ padding:16px 24px; }
.ng-dialog__foot{ padding:16px 24px 22px; display:flex; gap:10px; justify-content:flex-end; }
.ng-dialog__close{ position:absolute; }
@keyframes ngFade{ from{opacity:0} to{opacity:1} }
@keyframes ngPop{ from{opacity:0; transform:translateY(8px) scale(.98)} to{opacity:1; transform:none} }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-dialog-css")) return;
  const s = document.createElement("style");
  s.id = "ng-dialog-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Centered modal dialog. Controlled via `open` + `onClose`. `footer` for actions. */
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === "Escape" && onClose) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__overlay",
    onMouseDown: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    className: ["ng-dialog", className].filter(Boolean).join(" "),
    role: "dialog",
    "aria-modal": "true"
  }, props), title || description ? /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__head"
  }, title ? /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__title"
  }, title) : null, description ? /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__desc"
  }, description) : null) : null, children ? /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__body"
  }, children) : null, footer ? /*#__PURE__*/React.createElement("div", {
    className: "ng-dialog__foot"
  }, footer) : null));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Progress.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-progress{ font-family:var(--font-sans); display:flex; flex-direction:column; gap:8px; }
.ng-progress__head{ display:flex; justify-content:space-between; font-size:var(--text-sm); }
.ng-progress__label{ color:var(--text-secondary); font-weight:var(--fw-medium); }
.ng-progress__val{ color:var(--text-primary); font-weight:var(--fw-semibold); font-variant-numeric:tabular-nums; }
.ng-progress__track{ height:8px; border-radius:var(--radius-pill); background:var(--neutral-200); overflow:hidden; }
.ng-progress__fill{ height:100%; border-radius:var(--radius-pill); background:var(--petroleum-800);
  transition:width var(--dur-slow) var(--ease-out); }
.ng-progress--lime .ng-progress__fill{ background:var(--lime-500); }
.on-dark .ng-progress__track,[data-theme="dark"] .ng-progress__track{ background:color-mix(in srgb,#fff 14%,transparent); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-progress-css")) return;
  const s = document.createElement("style");
  s.id = "ng-progress-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Determinate progress bar (0–100). */
function Progress({
  value = 0,
  label,
  showValue = false,
  tone = "petroleum",
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const pct = Math.max(0, Math.min(100, value));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["ng-progress", tone === "lime" ? "ng-progress--lime" : "", className].filter(Boolean).join(" ")
  }, props), label || showValue ? /*#__PURE__*/React.createElement("div", {
    className: "ng-progress__head"
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ng-progress__label"
  }, label) : /*#__PURE__*/React.createElement("span", null), showValue ? /*#__PURE__*/React.createElement("span", {
    className: "ng-progress__val"
  }, Math.round(pct), "%") : null) : null, /*#__PURE__*/React.createElement("div", {
    className: "ng-progress__track",
    role: "progressbar",
    "aria-valuenow": pct,
    "aria-valuemin": 0,
    "aria-valuemax": 100
  }, /*#__PURE__*/React.createElement("div", {
    className: "ng-progress__fill",
    style: {
      width: `${pct}%`
    }
  })));
}
Object.assign(__ds_scope, { Progress });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Progress.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-tip{ position:relative; display:inline-flex; }
.ng-tip__bubble{
  position:absolute; z-index:var(--z-overlay); left:50%; transform:translateX(-50%) translateY(4px);
  bottom:calc(100% + 8px); padding:6px 10px; border-radius:var(--radius-sm);
  background:var(--petroleum-950); color:#fff; font-family:var(--font-sans); font-size:var(--text-xs);
  font-weight:var(--fw-medium); white-space:nowrap; box-shadow:var(--shadow-md);
  opacity:0; pointer-events:none; transition:opacity var(--dur-base), transform var(--dur-base) var(--ease-out);
}
.ng-tip__bubble::after{ content:""; position:absolute; top:100%; left:50%; transform:translateX(-50%);
  border:5px solid transparent; border-top-color:var(--petroleum-950); }
.ng-tip:hover .ng-tip__bubble, .ng-tip:focus-within .ng-tip__bubble{ opacity:1; transform:translateX(-50%) translateY(0); }
.ng-tip--bottom .ng-tip__bubble{ bottom:auto; top:calc(100% + 8px); }
.ng-tip--bottom .ng-tip__bubble::after{ top:auto; bottom:100%; border-top-color:transparent; border-bottom-color:var(--petroleum-950); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-tip-css")) return;
  const s = document.createElement("style");
  s.id = "ng-tip-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Lightweight CSS tooltip. Wrap the trigger; provide `label`. */
function Tooltip({
  label,
  side = "top",
  children,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  return /*#__PURE__*/React.createElement("span", _extends({
    className: ["ng-tip", side === "bottom" ? "ng-tip--bottom" : "", className].filter(Boolean).join(" ")
  }, props), children, /*#__PURE__*/React.createElement("span", {
    className: "ng-tip__bubble",
    role: "tooltip"
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-check-css")) return;
  const s = document.createElement("style");
  s.id = "ng-check-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
const Tick = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3.4",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M20 6 9 17l-5-5"
}));

/** Checkbox with lime fill when checked. Supports label + description. */
function Checkbox({
  label,
  description,
  disabled,
  id,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    className: ["ng-check", disabled ? "ng-check--disabled" : "", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    type: "checkbox",
    disabled: disabled
  }, props)), /*#__PURE__*/React.createElement("span", {
    className: "ng-check__box"
  }, /*#__PURE__*/React.createElement(Tick, null)), label || description ? /*#__PURE__*/React.createElement("span", {
    className: "ng-check__body"
  }, label ? /*#__PURE__*/React.createElement("span", {
    className: "ng-check__label"
  }, label) : null, description ? /*#__PURE__*/React.createElement("span", {
    className: "ng-check__desc"
  }, description) : null) : null);
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-input-css")) return;
  const s = document.createElement("style");
  s.id = "ng-input-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Text field with optional label, hint, error, and leading/trailing adornments. */
function Input({
  label,
  hint,
  error,
  leading,
  trailing,
  id,
  disabled,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    className: "ng-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "ng-field__label",
    htmlFor: fid
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: ["ng-input", error ? "ng-input--error" : "", disabled ? "ng-input--disabled" : "", className].filter(Boolean).join(" ")
  }, leading ? /*#__PURE__*/React.createElement("span", {
    className: "ng-input__aff"
  }, leading) : null, /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    className: "ng-input__el",
    disabled: disabled,
    "aria-invalid": !!error
  }, props)), trailing ? /*#__PURE__*/React.createElement("span", {
    className: "ng-input__aff"
  }, trailing) : null), error ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/RadioGroup.jsx
try { (() => {
const CSS = `
.ng-radiogroup{ display:flex; flex-direction:column; gap:10px; font-family:var(--font-sans); }
.ng-radio{ display:inline-flex; align-items:flex-start; gap:10px; cursor:pointer; user-select:none; }
.ng-radio--disabled{ opacity:.5; pointer-events:none; }
.ng-radio input{ position:absolute; opacity:0; width:0; height:0; }
.ng-radio__dot{
  flex:none; width:20px; height:20px; margin-top:1px; border-radius:50%;
  border:var(--border-thin) solid var(--border-strong); background:var(--surface-card);
  display:inline-flex; align-items:center; justify-content:center;
  transition:border-color var(--dur-fast) var(--ease-out);
}
.ng-radio__dot::after{ content:""; width:10px; height:10px; border-radius:50%; background:var(--lime-500);
  transform:scale(0); transition:transform var(--dur-fast) var(--ease-out); }
.ng-radio input:checked + .ng-radio__dot{ border-color:var(--petroleum-800); }
.ng-radio input:checked + .ng-radio__dot::after{ transform:scale(1); background:var(--lime-500); }
.ng-radio input:focus-visible + .ng-radio__dot{ box-shadow:0 0 0 3px var(--ring); }
.ng-radio__label{ font-size:var(--text-base); color:var(--text-primary); line-height:1.35; }
.ng-radio__desc{ font-size:var(--text-sm); color:var(--text-muted); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-radio-css")) return;
  const s = document.createElement("style");
  s.id = "ng-radio-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Controlled radio group. `options`: array of {value,label,description}. */
function RadioGroup({
  name,
  value,
  onChange,
  options = [],
  className = ""
}) {
  React.useEffect(inject, []);
  const gname = name || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    className: ["ng-radiogroup", className].filter(Boolean).join(" "),
    role: "radiogroup"
  }, options.map(o => /*#__PURE__*/React.createElement("label", {
    key: o.value,
    className: ["ng-radio", o.disabled ? "ng-radio--disabled" : ""].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("input", {
    type: "radio",
    name: gname,
    value: o.value,
    checked: value === o.value,
    disabled: o.disabled,
    onChange: () => onChange && onChange(o.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "ng-radio__dot"
  }), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "ng-radio__label"
  }, o.label), o.description ? /*#__PURE__*/React.createElement("span", {
    className: "ng-radio__desc",
    style: {
      display: "block"
    }
  }, o.description) : null))));
}
Object.assign(__ds_scope, { RadioGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/RadioGroup.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-select-css")) return;
  const s = document.createElement("style");
  s.id = "ng-select-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}
const Chevron = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "m6 9 6 6 6-6"
}));

/** Native select styled to the Nogma system. Pass `options` or children `<option>`s. */
function Select({
  label,
  hint,
  error,
  id,
  options,
  children,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    className: "ng-field"
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "ng-field__label",
    htmlFor: fid
  }, label) : null, /*#__PURE__*/React.createElement("div", {
    className: "ng-select"
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: fid,
    className: ["ng-select__el", className].filter(Boolean).join(" ")
  }, props), options ? options.map(o => {
    const v = typeof o === "string" ? o : o.value;
    const t = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: v,
      value: v
    }, t);
  }) : children), /*#__PURE__*/React.createElement("span", {
    className: "ng-select__chev"
  }, /*#__PURE__*/React.createElement(Chevron, null))), error ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-switch-css")) return;
  const s = document.createElement("style");
  s.id = "ng-switch-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Toggle switch. `tone="lime"` for an accented on-state. */
function Switch({
  label,
  disabled,
  tone = "petroleum",
  id,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: fid,
    className: ["ng-switch", tone === "lime" ? "ng-switch--lime" : "", disabled ? "ng-switch--disabled" : "", className].filter(Boolean).join(" ")
  }, /*#__PURE__*/React.createElement("input", _extends({
    id: fid,
    type: "checkbox",
    role: "switch",
    disabled: disabled
  }, props)), /*#__PURE__*/React.createElement("span", {
    className: "ng-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ng-switch__thumb"
  })), label ? /*#__PURE__*/React.createElement("span", {
    className: "ng-switch__label"
  }, label) : null);
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-textarea-css")) return;
  const s = document.createElement("style");
  s.id = "ng-textarea-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Multi-line text field. Shares label/hint/error chrome with Input. */
function Textarea({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const fid = id || React.useId();
  return /*#__PURE__*/React.createElement("div", {
    className: ["ng-field", error ? "ng-textarea--error" : ""].filter(Boolean).join(" ")
  }, label ? /*#__PURE__*/React.createElement("label", {
    className: "ng-field__label",
    htmlFor: fid
  }, label) : null, /*#__PURE__*/React.createElement("textarea", _extends({
    id: fid,
    className: ["ng-textarea__el", className].filter(Boolean).join(" "),
    "aria-invalid": !!error
  }, props)), error ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__error"
  }, error) : hint ? /*#__PURE__*/React.createElement("span", {
    className: "ng-field__hint"
  }, hint) : null);
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const CSS = `
.ng-tabs{ font-family:var(--font-sans); }
.ng-tabs__list{ display:inline-flex; gap:2px; position:relative; }
.ng-tabs--line .ng-tabs__list{ gap:24px; border-bottom:var(--border-hair) solid var(--border-subtle); }
.ng-tabs__tab{
  appearance:none; border:none; background:transparent; cursor:pointer; font-family:inherit;
  font-weight:var(--fw-semibold); font-size:var(--text-sm); color:var(--text-secondary);
  transition:color var(--dur-base), background var(--dur-base);
}
.ng-tabs--line .ng-tabs__tab{ padding:12px 2px; position:relative; }
.ng-tabs--line .ng-tabs__tab::after{ content:""; position:absolute; left:0; right:0; bottom:-1px; height:2.5px;
  background:var(--petroleum-800); border-radius:2px; transform:scaleX(0); transition:transform var(--dur-base) var(--ease-out); }
.ng-tabs--line .ng-tabs__tab[aria-selected="true"]{ color:var(--text-primary); }
.ng-tabs--line .ng-tabs__tab[aria-selected="true"]::after{ transform:scaleX(1); }
.ng-tabs--pill .ng-tabs__list{ background:var(--neutral-100); padding:4px; border-radius:var(--radius-md); }
.ng-tabs--pill .ng-tabs__tab{ padding:8px 16px; border-radius:var(--radius-sm); }
.ng-tabs--pill .ng-tabs__tab[aria-selected="true"]{ background:var(--surface-card); color:var(--text-primary); box-shadow:var(--shadow-xs); }
.ng-tabs__tab:focus-visible{ outline:none; box-shadow:0 0 0 3px var(--ring); border-radius:var(--radius-sm); }
.ng-tabs__count{ margin-left:6px; font-size:var(--text-xs); color:var(--text-muted); font-weight:var(--fw-medium); }
`;
function inject() {
  if (typeof document === "undefined" || document.getElementById("ng-tabs-css")) return;
  const s = document.createElement("style");
  s.id = "ng-tabs-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Tab switcher. Controlled via `value`+`onChange`, or uncontrolled with `defaultValue`. */
function Tabs({
  items = [],
  value,
  defaultValue,
  onChange,
  variant = "line",
  className = "",
  ...props
}) {
  React.useEffect(inject, []);
  const [internal, setInternal] = React.useState(defaultValue ?? (items[0] && items[0].value));
  const active = value !== undefined ? value : internal;
  const select = v => {
    if (value === undefined) setInternal(v);
    onChange && onChange(v);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    className: ["ng-tabs", `ng-tabs--${variant}`, className].filter(Boolean).join(" ")
  }, props), /*#__PURE__*/React.createElement("div", {
    className: "ng-tabs__list",
    role: "tablist"
  }, items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.value,
    role: "tab",
    "aria-selected": active === it.value,
    className: "ng-tabs__tab",
    onClick: () => select(it.value)
  }, it.label, it.count != null ? /*#__PURE__*/React.createElement("span", {
    className: "ng-tabs__count"
  }, it.count) : null))));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/nogmaos/AppScreens.jsx
try { (() => {
/* NogmaOS — Dashboard, Automations, Agent chat. Exports window.NogmaOSScreens */
const {
  Card,
  Stat,
  Badge,
  Switch,
  Progress,
  Button,
  Avatar,
  Tabs
} = window.NogmaDesignSystem_54b71f;
const Ic = window.NogmaIcon;
const AUTOMATIONS = [{
  name: "Conciliação de notas fiscais",
  agent: "Fiscal",
  status: "active",
  runs: "1.240",
  rate: 98,
  last: "há 4 min"
}, {
  name: "Follow-up de propostas",
  agent: "Vendas",
  status: "active",
  runs: "612",
  rate: 91,
  last: "há 18 min"
}, {
  name: "Triagem de atendimento",
  agent: "Suporte",
  status: "active",
  runs: "3.480",
  rate: 96,
  last: "há 2 min"
}, {
  name: "Fechamento financeiro",
  agent: "Fiscal",
  status: "paused",
  runs: "88",
  rate: 100,
  last: "ontem"
}, {
  name: "Onboarding de clientes",
  agent: "CS",
  status: "active",
  runs: "204",
  rate: 87,
  last: "há 1 h"
}];

/* ---------------- Dashboard ---------------- */
function DashboardScreen({
  onOpenAgent
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "nos-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-greet"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "nos-eyebrow"
  }, "Segunda, 1 de julho"), /*#__PURE__*/React.createElement("h2", {
    className: "nos-greet__title"
  }, "Bom dia, Ana \uD83D\uDC4B")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    leadingIcon: /*#__PURE__*/React.createElement(Ic, {
      name: "plus",
      size: 18
    })
  }, "Nova automa\xE7\xE3o")), /*#__PURE__*/React.createElement("div", {
    className: "nos-kpis"
  }, /*#__PURE__*/React.createElement(Card, {
    accent: true
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Horas economizadas / m\xEAs",
    value: "128h",
    delta: "+18%",
    caption: "vs. junho"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Stat, {
    label: "Processos ativos",
    value: "24",
    delta: "+3",
    caption: "este m\xEAs"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Stat, {
    label: "Taxa de sucesso",
    value: "95%",
    delta: "+1,2pp",
    caption: "m\xE9dia 30 dias"
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Stat, {
    label: "Execu\xE7\xF5es / semana",
    value: "6.4k",
    delta: "-2%",
    direction: "down",
    caption: "vs. semana anterior"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "nos-cols"
  }, /*#__PURE__*/React.createElement(Card, {
    padded: false,
    className: "nos-tablecard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-tablecard__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "nos-tablecard__title"
  }, "Automa\xE7\xF5es ativas"), /*#__PURE__*/React.createElement("div", {
    className: "nos-tablecard__sub"
  }, "Rodando agora na sua opera\xE7\xE3o")), /*#__PURE__*/React.createElement("button", {
    className: "nos-linkbtn",
    onClick: () => onOpenAgent("automations")
  }, "Ver todas ", /*#__PURE__*/React.createElement(Ic, {
    name: "arrow-right",
    size: 15
  }))), /*#__PURE__*/React.createElement("table", {
    className: "nos-table"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Automa\xE7\xE3o"), /*#__PURE__*/React.createElement("th", null, "Agente"), /*#__PURE__*/React.createElement("th", null, "Status"), /*#__PURE__*/React.createElement("th", null, "Sucesso"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, AUTOMATIONS.slice(0, 4).map(a => /*#__PURE__*/React.createElement("tr", {
    key: a.name
  }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
    className: "nos-cellmain"
  }, a.name), /*#__PURE__*/React.createElement("div", {
    className: "nos-cellsub"
  }, a.runs, " execu\xE7\xF5es \xB7 ", a.last)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
    variant: "petroleum"
  }, a.agent)), /*#__PURE__*/React.createElement("td", null, a.status === "active" ? /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "Ativa") : /*#__PURE__*/React.createElement(Badge, {
    variant: "neutral",
    dot: true
  }, "Pausada")), /*#__PURE__*/React.createElement("td", {
    style: {
      width: 130
    }
  }, /*#__PURE__*/React.createElement(Progress, {
    value: a.rate,
    tone: a.rate >= 95 ? "lime" : "petroleum"
  })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
    className: "nos-iconbtn nos-iconbtn--ghost",
    "aria-label": "Abrir",
    onClick: () => onOpenAgent("agents")
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chevron-right",
    size: 18
  })))))))), /*#__PURE__*/React.createElement("div", {
    className: "nos-side"
  }, /*#__PURE__*/React.createElement(Card, {
    className: "nos-agentcard"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-agentcard__top"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nos-agentcard__ic"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "sparkles",
    size: 20,
    color: "var(--petroleum-950)"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "nos-agentcard__title"
  }, "Agente Fiscal"), /*#__PURE__*/React.createElement("div", {
    className: "nos-agentcard__meta"
  }, "Online \xB7 aprendeu 3 regras hoje"))), /*#__PURE__*/React.createElement("p", {
    className: "nos-agentcard__body"
  }, "\u201CConclu\xED a concilia\xE7\xE3o de 142 notas. 2 exigem sua revis\xE3o.\u201D"), /*#__PURE__*/React.createElement(Button, {
    variant: "solid",
    size: "sm",
    block: true,
    onClick: () => onOpenAgent("agents"),
    trailingIcon: /*#__PURE__*/React.createElement(Ic, {
      name: "message-square",
      size: 16
    })
  }, "Conversar")), /*#__PURE__*/React.createElement(Card, {
    title: "Atividade recente",
    padded: true
  }, /*#__PURE__*/React.createElement("ul", {
    className: "nos-feed"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__dot nos-feed__dot--ok"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Triagem de atendimento"), " processou 38 tickets", /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__t"
  }, "h\xE1 2 min"))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__dot nos-feed__dot--warn"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Follow-up"), " aguarda aprova\xE7\xE3o de 4 propostas", /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__t"
  }, "h\xE1 18 min"))), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__dot nos-feed__dot--ok"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Onboarding"), " concluiu cadastro de 12 clientes", /*#__PURE__*/React.createElement("span", {
    className: "nos-feed__t"
  }, "h\xE1 1 h"))))))));
}

/* ---------------- Automations list ---------------- */
function AutomationsScreen({
  onOpenAgent
}) {
  const [tab, setTab] = React.useState("ativos");
  const [toggles, setToggles] = React.useState(() => AUTOMATIONS.map(a => a.status === "active"));
  const rows = AUTOMATIONS.filter(a => tab === "todos" ? true : tab === "ativos" ? a.status === "active" : a.status === "paused");
  return /*#__PURE__*/React.createElement("div", {
    className: "nos-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-greet"
  }, /*#__PURE__*/React.createElement(Tabs, {
    variant: "line",
    value: tab,
    onChange: setTab,
    items: [{
      value: "ativos",
      label: "Ativas",
      count: AUTOMATIONS.filter(a => a.status === "active").length
    }, {
      value: "pausados",
      label: "Pausadas",
      count: AUTOMATIONS.filter(a => a.status === "paused").length
    }, {
      value: "todos",
      label: "Todas",
      count: AUTOMATIONS.length
    }]
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    leadingIcon: /*#__PURE__*/React.createElement(Ic, {
      name: "filter",
      size: 16
    })
  }, "Filtrar"), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    leadingIcon: /*#__PURE__*/React.createElement(Ic, {
      name: "plus",
      size: 18
    })
  }, "Nova automa\xE7\xE3o"))), /*#__PURE__*/React.createElement(Card, {
    padded: false,
    className: "nos-tablecard"
  }, /*#__PURE__*/React.createElement("table", {
    className: "nos-table nos-table--full"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", null, "Automa\xE7\xE3o"), /*#__PURE__*/React.createElement("th", null, "Agente"), /*#__PURE__*/React.createElement("th", null, "Execu\xE7\xF5es"), /*#__PURE__*/React.createElement("th", null, "Taxa de sucesso"), /*#__PURE__*/React.createElement("th", null, "\xDAltima"), /*#__PURE__*/React.createElement("th", null, "Ativa"), /*#__PURE__*/React.createElement("th", null))), /*#__PURE__*/React.createElement("tbody", null, rows.map(a => {
    const idx = AUTOMATIONS.indexOf(a);
    return /*#__PURE__*/React.createElement("tr", {
      key: a.name
    }, /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("div", {
      className: "nos-cellmain"
    }, a.name)), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Badge, {
      variant: "petroleum"
    }, a.agent)), /*#__PURE__*/React.createElement("td", {
      className: "nos-num"
    }, a.runs), /*#__PURE__*/React.createElement("td", {
      style: {
        width: 170
      }
    }, /*#__PURE__*/React.createElement(Progress, {
      value: a.rate,
      showValue: true,
      tone: a.rate >= 95 ? "lime" : "petroleum"
    })), /*#__PURE__*/React.createElement("td", {
      className: "nos-cellsub"
    }, a.last), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement(Switch, {
      tone: "lime",
      checked: toggles[idx],
      onChange: () => setToggles(t => t.map((v, i) => i === idx ? !v : v))
    })), /*#__PURE__*/React.createElement("td", null, /*#__PURE__*/React.createElement("button", {
      className: "nos-iconbtn nos-iconbtn--ghost",
      "aria-label": "Abrir",
      onClick: () => onOpenAgent("agents")
    }, /*#__PURE__*/React.createElement(Ic, {
      name: "chevron-right",
      size: 18
    }))));
  })))));
}

/* ---------------- Agent chat ---------------- */
const SEED = [{
  from: "agent",
  text: "Oi, Ana. Rodei a conciliação de notas fiscais de hoje: 142 documentos, 140 conciliados automaticamente."
}, {
  from: "agent",
  text: "2 notas ficaram com divergência de valor. Quer que eu envie para revisão do financeiro?"
}, {
  from: "user",
  text: "Sim, envia. E me mostra o resumo da semana."
}, {
  from: "agent",
  text: "Feito ✅ — enviei as 2 divergências para o João. Na semana: 1.240 notas processadas, 98% de sucesso, ~11h economizadas."
}];
function AgentScreen() {
  const [msgs, setMsgs] = React.useState(SEED);
  const [draft, setDraft] = React.useState("");
  const bodyRef = React.useRef(null);
  React.useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs]);
  const send = () => {
    const t = draft.trim();
    if (!t) return;
    setMsgs(m => [...m, {
      from: "user",
      text: t
    }]);
    setDraft("");
    setTimeout(() => setMsgs(m => [...m, {
      from: "agent",
      text: "Entendido — já estou processando isso e te aviso assim que concluir."
    }]), 650);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "nos-agent"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-chat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nos-chat__ic"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "sparkles",
    size: 20,
    color: "var(--petroleum-950)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__id"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__name"
  }, "Agente Fiscal"), /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nos-online"
  }), "Online \xB7 conectado ao ERP")), /*#__PURE__*/React.createElement(Badge, {
    variant: "lime"
  }, "GPT-4 \xB7 pt-BR")), /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__body",
    ref: bodyRef
  }, msgs.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "nos-msg nos-msg--" + m.from
  }, m.from === "agent" && /*#__PURE__*/React.createElement("span", {
    className: "nos-msg__av"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "bot",
    size: 16,
    color: "var(--lime-500)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "nos-msg__bubble"
  }, m.text)))), /*#__PURE__*/React.createElement("div", {
    className: "nos-chat__composer"
  }, /*#__PURE__*/React.createElement("button", {
    className: "nos-iconbtn nos-iconbtn--ghost",
    "aria-label": "Anexar"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "file-text",
    size: 18
  })), /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") send();
    },
    placeholder: "Pe\xE7a um resumo, ajuste uma regra\u2026"
  }), /*#__PURE__*/React.createElement("button", {
    className: "nos-sendbtn",
    onClick: send,
    "aria-label": "Enviar"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "send",
    size: 18,
    color: "var(--petroleum-950)"
  })))), /*#__PURE__*/React.createElement("div", {
    className: "nos-agent__rail"
  }, /*#__PURE__*/React.createElement(Card, {
    title: "Ferramentas conectadas",
    padded: true
  }, /*#__PURE__*/React.createElement("ul", {
    className: "nos-tools"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-tool__ic"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "file-text",
    size: 16
  })), "ERP Fiscal", /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "OK")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-tool__ic"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "mail",
    size: 16
  })), "E-mail", /*#__PURE__*/React.createElement(Badge, {
    variant: "success",
    dot: true
  }, "OK")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "nos-tool__ic"
  }, /*#__PURE__*/React.createElement(Ic, {
    name: "chart",
    size: 16
  })), "Planilhas", /*#__PURE__*/React.createElement(Badge, {
    variant: "warning",
    dot: true
  }, "Token")))), /*#__PURE__*/React.createElement(Card, {
    title: "Esta semana",
    padded: true
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-railstats"
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "Notas processadas",
    value: "1.240"
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "Horas economizadas",
    value: "11h",
    delta: "+9%"
  })))));
}
window.NogmaOSScreens = {
  DashboardScreen,
  AutomationsScreen,
  AgentScreen
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/nogmaos/AppScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/nogmaos/Chrome.jsx
try { (() => {
/* NogmaOS — app chrome: Sidebar + TopBar. Exports to window. */
const {
  Avatar,
  Badge
} = window.NogmaDesignSystem_54b71f;
const Icon = window.NogmaIcon;
const NAV = [{
  id: "dashboard",
  label: "Dashboard",
  icon: "dashboard"
}, {
  id: "automations",
  label: "Automações",
  icon: "workflow",
  badge: "12"
}, {
  id: "agents",
  label: "Agentes",
  icon: "bot"
}, {
  id: "reports",
  label: "Relatórios",
  icon: "chart"
}, {
  id: "team",
  label: "Equipe",
  icon: "users"
}];
function Sidebar({
  route,
  onNav,
  collapsed
}) {
  return /*#__PURE__*/React.createElement("aside", {
    className: "nos-sidebar" + (collapsed ? " nos-sidebar--collapsed" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "nos-brand__mark"
  }, /*#__PURE__*/React.createElement("img", {
    src: "../../assets/isotype-n-lime.png",
    alt: ""
  })), !collapsed && /*#__PURE__*/React.createElement("img", {
    className: "nos-brand__word",
    src: "../../assets/logo-nogma-lime.png",
    alt: "nogma"
  })), /*#__PURE__*/React.createElement("nav", {
    className: "nos-nav"
  }, NAV.map(n => /*#__PURE__*/React.createElement("button", {
    key: n.id,
    className: "nos-navitem" + (route === n.id ? " is-active" : ""),
    onClick: () => onNav(n.id)
  }, /*#__PURE__*/React.createElement(Icon, {
    name: n.icon,
    size: 19
  }), !collapsed && /*#__PURE__*/React.createElement("span", {
    className: "nos-navitem__label"
  }, n.label), !collapsed && n.badge && /*#__PURE__*/React.createElement("span", {
    className: "nos-navitem__badge"
  }, n.badge)))), /*#__PURE__*/React.createElement("div", {
    className: "nos-side-foot"
  }, /*#__PURE__*/React.createElement("button", {
    className: "nos-navitem",
    onClick: () => onNav("settings")
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "settings",
    size: 19
  }), !collapsed && /*#__PURE__*/React.createElement("span", {
    className: "nos-navitem__label"
  }, "Configura\xE7\xF5es")), /*#__PURE__*/React.createElement("div", {
    className: "nos-userpill"
  }, /*#__PURE__*/React.createElement(Avatar, {
    name: "Ana Prado",
    size: "sm",
    status: "online"
  }), !collapsed && /*#__PURE__*/React.createElement("div", {
    className: "nos-userpill__meta"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-userpill__name"
  }, "Ana Prado"), /*#__PURE__*/React.createElement("div", {
    className: "nos-userpill__org"
  }, "Vitrine Com\xE9rcio")), !collapsed && /*#__PURE__*/React.createElement(Icon, {
    name: "log-out",
    size: 16,
    color: "var(--petroleum-300)"
  }))));
}
function TopBar({
  title,
  subtitle,
  onToggle,
  actions
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "nos-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-topbar__left"
  }, /*#__PURE__*/React.createElement("button", {
    className: "nos-iconbtn nos-iconbtn--ghost",
    onClick: onToggle,
    "aria-label": "Menu"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 20
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    className: "nos-topbar__title"
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    className: "nos-topbar__sub"
  }, subtitle))), /*#__PURE__*/React.createElement("div", {
    className: "nos-topbar__right"
  }, /*#__PURE__*/React.createElement("label", {
    className: "nos-search"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "search",
    size: 17,
    color: "var(--text-muted)"
  }), /*#__PURE__*/React.createElement("input", {
    placeholder: "Buscar automa\xE7\xF5es, agentes\u2026"
  }), /*#__PURE__*/React.createElement("kbd", null, "\u2318K")), /*#__PURE__*/React.createElement("button", {
    className: "nos-iconbtn nos-iconbtn--ghost",
    "aria-label": "Alertas"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 19
  }), /*#__PURE__*/React.createElement("span", {
    className: "nos-dot"
  })), actions));
}
window.NogmaOSChrome = {
  Sidebar,
  TopBar,
  NAV
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/nogmaos/Chrome.jsx", error: String((e && e.message) || e) }); }

// ui_kits/nogmaos/LoginScreen.jsx
try { (() => {
/* NogmaOS — Login screen. Exports window.NogmaOSLogin */
const {
  Button,
  Input,
  Checkbox
} = window.NogmaDesignSystem_54b71f;
const NgIcon = window.NogmaIcon;
function LoginScreen({
  onLogin
}) {
  const [email, setEmail] = React.useState("ana@vitrine.com.br");
  const [pw, setPw] = React.useState("••••••••");
  return /*#__PURE__*/React.createElement("div", {
    className: "nos-login"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-login__aside"
  }, /*#__PURE__*/React.createElement("img", {
    className: "nos-login__logo",
    src: "../../assets/logo-nogma-lime.png",
    alt: "nogma"
  }), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__pitch"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-login__eyebrow"
  }, "NogmaOS"), /*#__PURE__*/React.createElement("h2", null, "Sua opera\xE7\xE3o no ", /*#__PURE__*/React.createElement("span", {
    className: "nos-mark"
  }, "piloto autom\xE1tico"), "."), /*#__PURE__*/React.createElement("p", null, "Seu painel de agentes, fluxos e indicadores \u2014 num s\xF3 lugar.")), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__stats"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "128h"), /*#__PURE__*/React.createElement("span", null, "economizadas / m\xEAs")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "+42%"), /*#__PURE__*/React.createElement("span", null, "produtividade")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, "24"), /*#__PURE__*/React.createElement("span", null, "processos ativos")))), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "nos-login__card"
  }, /*#__PURE__*/React.createElement("h1", null, "Entrar"), /*#__PURE__*/React.createElement("p", {
    className: "nos-login__hint"
  }, "Acesse o painel da sua opera\xE7\xE3o."), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__form"
  }, /*#__PURE__*/React.createElement(Input, {
    label: "E-mail",
    type: "email",
    value: email,
    onChange: e => setEmail(e.target.value),
    leading: /*#__PURE__*/React.createElement(NgIcon, {
      name: "mail",
      size: 16,
      color: "var(--text-muted)"
    })
  }), /*#__PURE__*/React.createElement(Input, {
    label: "Senha",
    type: "password",
    value: pw,
    onChange: e => setPw(e.target.value),
    leading: /*#__PURE__*/React.createElement(NgIcon, {
      name: "lock",
      size: 16,
      color: "var(--text-muted)"
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__row"
  }, /*#__PURE__*/React.createElement(Checkbox, {
    label: "Manter conectada",
    defaultChecked: true
  }), /*#__PURE__*/React.createElement("a", {
    className: "nos-login__link",
    href: "#"
  }, "Esqueci a senha")), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    block: true,
    onClick: onLogin,
    trailingIcon: /*#__PURE__*/React.createElement(NgIcon, {
      name: "arrow-right",
      size: 18
    })
  }, "Entrar")), /*#__PURE__*/React.createElement("div", {
    className: "nos-login__foot"
  }, "Protegido por SSO \xB7 Nogma Consultoria"))));
}
window.NogmaOSLogin = LoginScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/nogmaos/LoginScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Stat = __ds_scope.Stat;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Progress = __ds_scope.Progress;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.RadioGroup = __ds_scope.RadioGroup;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
