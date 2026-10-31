import { useEffect, useMemo, useState } from "react";
import { api, type CharacterTemplate } from "../lib/api";
import { useAuth } from "../lib/auth";

/**
 * Ready-made looks.
 *
 * Each tile is a template. Claiming one adds it to the caller's characters,
 * so it can then be used as the reference image on any generation.
 */
export const TemplatesPage = () => {
  const { refresh } = useAuth();
  const [templates, setTemplates] = useState<CharacterTemplate[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<Set<string>>(new Set());

  useEffect(() => {
    void (async () => {
      try {
        const { templates: list } = await api.templates();
        setTemplates(list);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not load the looks.",
        );
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter(
      (template) =>
        template.label.toLowerCase().includes(needle) ||
        template.handle.includes(needle),
    );
  }, [templates, query]);

  const claim = async (template: CharacterTemplate) => {
    setBusy(template.id);
    setError(null);
    try {
      await api.claimTemplate(template.id);
      setClaimed((previous) => new Set(previous).add(template.id));
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not add that look.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="page">
      <span className="eyebrow">Templates</span>
      <h1 style={{ marginTop: 12 }}>Ready-made looks</h1>
      <p className="muted">
        {templates.length} looks, ready to use. Add one to your characters and
        it becomes the reference image for every generation — across every
        model.
      </p>

      <div className="row" style={{ margin: "18px 0" }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          style={{ maxWidth: 280 }}
        />
        <span className="muted small">{filtered.length} shown</span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="template-grid">
        {filtered.map((template) => (
          <button
            type="button"
            key={template.id}
            className="template"
            onClick={() => void claim(template)}
            disabled={busy === template.id || claimed.has(template.id)}
          >
            <img src={template.src} alt={template.label} loading="lazy" />
            <span className="template-name">
              {claimed.has(template.id) ? `${template.label} — added` : template.label}
              <small>@{template.handle}</small>
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && !error ? (
        <p className="muted">No look matches that.</p>
      ) : null}
    </main>
  );
};
