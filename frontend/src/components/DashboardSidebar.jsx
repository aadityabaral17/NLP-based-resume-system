import { useState } from "react";

/**
 * Shared left-hand navigation for the ResumeMatch dashboards.
 *
 * Props:
 * - logoSubtitle: small text under the "ResumeMatch" wordmark (e.g. "Hiring command center")
 * - initials: 1-2 letters shown in the avatar bubble
 * - name: primary line in the identity card
 * - roleLabel: secondary line in the identity card
 * - items: [{ key, label, icon }] nav entries
 * - activeKey: currently selected item's key
 * - onSelect(key): called when an item is clicked
 * - footerLabel / onFooterClick: bottom pinned button (e.g. "Update Profile")
 * - onLogout: signs the user out. Rendered inside the sidebar and shown only
 *   below the lg breakpoint, because the dashboards' own top bar carries a
 *   Logout button and that bar is `hidden lg:flex`. Without this there is no
 *   way to sign out on a phone at all: the button exists in the DOM but the
 *   bar holding it is never laid out, so it measures 0x0 and cannot be tapped.
 */
function DashboardSidebar({
  logoSubtitle,
  initials,
  name,
  roleLabel,
  items,
  activeKey,
  onSelect,
  footerLabel,
  onFooterClick,
  onLogout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSelect = (key) => {
    onSelect(key);
    setMobileOpen(false);
  };

  const NavList = () => (
    <nav className="flex-1 px-3 space-y-1">
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => handleSelect(item.key)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
              active
                ? "bg-indigo text-white shadow-sm"
                : "text-slate hover:bg-indigo-light hover:text-indigo"
            }`}
          >
            <span className="shrink-0">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile top bar trigger */}
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-line px-4 py-3">
        <div>
          <p className="font-serif text-lg text-ink leading-tight">
            ResumeMatch
          </p>
          <p className="text-xs text-slate">{logoSubtitle}</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="p-2 rounded-lg border border-line text-ink"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80%] bg-mist h-full flex flex-col py-6 shadow-2xl">
            <SidebarInner
              logoSubtitle={logoSubtitle}
              initials={initials}
              name={name}
              roleLabel={roleLabel}
              footerLabel={footerLabel}
              onFooterClick={() => {
                setMobileOpen(false);
                onFooterClick?.();
              }}
              onLogout={onLogout}
              NavList={NavList}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-mist border-r border-line h-screen sticky top-0 py-6 overflow-y-auto">
        <SidebarInner
          logoSubtitle={logoSubtitle}
          initials={initials}
          name={name}
          roleLabel={roleLabel}
          footerLabel={footerLabel}
          onFooterClick={onFooterClick}
          NavList={NavList}
        />
      </aside>
    </>
  );
}

function SidebarInner({
  logoSubtitle,
  initials,
  name,
  roleLabel,
  footerLabel,
  onFooterClick,
  onLogout,
  NavList,
  onClose,
}) {
  return (
    <>
      <div className="px-5 mb-6 flex items-start justify-between">
        <div>
          <p className="font-serif text-xl text-ink leading-tight">
            ResumeMatch
          </p>
          <p className="text-xs text-slate mt-0.5">{logoSubtitle}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="text-slate hover:text-danger"
          >
            ✕
          </button>
        )}
      </div>

      <div className="px-3 mb-6">
        <div className="flex items-center gap-3 bg-white border border-line rounded-2xl px-3 py-3">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo to-violet-600 flex items-center justify-center text-white font-serif text-sm shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink truncate">{name}</p>
            <p className="text-xs text-slate truncate">{roleLabel}</p>
          </div>
        </div>
      </div>

      <NavList />

      {footerLabel && (
        <div className="px-3 mt-6">
          <button
            onClick={onFooterClick}
            className="w-full bg-ink text-white text-sm font-medium py-3 rounded-xl hover:opacity-90 transition"
          >
            {footerLabel}
          </button>
        </div>
      )}

      {/* lg:hidden because the dashboards' top bar already carries a Logout
          above that breakpoint; showing both would duplicate it on desktop. */}
      {onLogout && (
        <div className="px-3 mt-3 lg:hidden">
          <button
            onClick={onLogout}
            className="w-full border border-line text-slate text-sm font-medium py-3 rounded-xl hover:text-danger hover:border-danger transition"
          >
            Logout
          </button>
        </div>
      )}
    </>
  );
}

// Small inline icon set so the sidebar doesn't need an external icon library.
const iconProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const GridIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

export const BriefcaseIcon = () => (
  <svg {...iconProps}>
    <rect x="2" y="7" width="20" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M2 12h20" />
  </svg>
);

export const BarChartIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20V10" />
    <path d="M12 20V4" />
    <path d="M20 20v-7" />
  </svg>
);

export const SettingsIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.35a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04Z" />
  </svg>
);

export const ClipboardCheckIcon = () => (
  <svg {...iconProps}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="m9 13 2 2 4-4" />
  </svg>
);

export const SearchIcon = () => (
  <svg {...iconProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const SparklesIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2" />
  </svg>
);

export const ClockIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export default DashboardSidebar;
