/* NogmaOS — app chrome: Sidebar + TopBar. Exports to window. */
const { Avatar, Badge } = window.NogmaDesignSystem_54b71f;
const Icon = window.NogmaIcon;

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard" },
  { id: "automations", label: "Automações", icon: "workflow", badge: "12" },
  { id: "agents", label: "Agentes", icon: "bot" },
  { id: "reports", label: "Relatórios", icon: "chart" },
  { id: "team", label: "Equipe", icon: "users" },
];

function Sidebar({ route, onNav, collapsed }) {
  return (
    <aside className={"nos-sidebar" + (collapsed ? " nos-sidebar--collapsed" : "")}>
      <div className="nos-brand">
        <span className="nos-brand__mark"><img src="../../assets/isotype-n-lime.png" alt="" /></span>
        {!collapsed && <img className="nos-brand__word" src="../../assets/logo-nogma-lime.png" alt="nogma" />}
      </div>

      <nav className="nos-nav">
        {NAV.map((n) => (
          <button key={n.id} className={"nos-navitem" + (route === n.id ? " is-active" : "")} onClick={() => onNav(n.id)}>
            <Icon name={n.icon} size={19} />
            {!collapsed && <span className="nos-navitem__label">{n.label}</span>}
            {!collapsed && n.badge && <span className="nos-navitem__badge">{n.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="nos-side-foot">
        <button className="nos-navitem" onClick={() => onNav("settings")}>
          <Icon name="settings" size={19} />{!collapsed && <span className="nos-navitem__label">Configurações</span>}
        </button>
        <div className="nos-userpill">
          <Avatar name="Ana Prado" size="sm" status="online" />
          {!collapsed && (
            <div className="nos-userpill__meta">
              <div className="nos-userpill__name">Ana Prado</div>
              <div className="nos-userpill__org">Vitrine Comércio</div>
            </div>
          )}
          {!collapsed && <Icon name="log-out" size={16} color="var(--petroleum-300)" />}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ title, subtitle, onToggle, actions }) {
  return (
    <header className="nos-topbar">
      <div className="nos-topbar__left">
        <button className="nos-iconbtn nos-iconbtn--ghost" onClick={onToggle} aria-label="Menu"><Icon name="menu" size={20} /></button>
        <div>
          <h1 className="nos-topbar__title">{title}</h1>
          {subtitle && <div className="nos-topbar__sub">{subtitle}</div>}
        </div>
      </div>
      <div className="nos-topbar__right">
        <label className="nos-search">
          <Icon name="search" size={17} color="var(--text-muted)" />
          <input placeholder="Buscar automações, agentes…" />
          <kbd>⌘K</kbd>
        </label>
        <button className="nos-iconbtn nos-iconbtn--ghost" aria-label="Alertas">
          <Icon name="bell" size={19} /><span className="nos-dot" />
        </button>
        {actions}
      </div>
    </header>
  );
}

window.NogmaOSChrome = { Sidebar, TopBar, NAV };
