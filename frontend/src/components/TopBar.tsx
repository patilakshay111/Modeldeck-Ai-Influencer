import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { PRODUCT } from "../config";

/**
 * The studio's tabs.
 *
 * The reference also lists an "NSFW" tab, which routes to its uncensored
 * model tier. That tier is not reproduced here — see docs/MODEL-REGISTRY.md.
 */
export const STUDIO_TABS = [
  { to: "/canvas", label: "Canvas" },
  { to: "/templates", label: "Templates" },
  { to: "/avatar", label: "Avatar" },
  { to: "/studio", label: "Image" },
  { to: "/video", label: "Video" },
  { to: "/upscale", label: "Upscale" },
  { to: "/characters", label: "Influencers" },
  { to: "/library", label: "Library" },
  { to: "/agent", label: "Agent" },
  { to: "/mcp", label: "MCP & CLI" },
  { to: "/courses", label: "Courses" },
] as const;

export const TopBar = () => {
  const { user, signOut } = useAuth();
  const credits = (user?.balanceMillicredits ?? 0) / 1000;

  return (
    <header className="topbar">
      <Link to="/studio" className="brand">
        <span className="mark" />
        {PRODUCT.name}
      </Link>

      <nav className="pill-nav">
        {STUDIO_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => (isActive ? "active" : undefined)}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="spacer" />

      <div className="row">
        <span className="credits" title="Remaining credit balance">
          {credits.toFixed(2)} cr
        </span>
        <span className="muted small">{user?.name}</span>
        <button type="button" className="outline sm" onClick={signOut}>
          Sign out
        </button>
      </div>
    </header>
  );
};
