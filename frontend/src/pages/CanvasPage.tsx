import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Canvas } from "../lib/api";
import { CanvasEditor } from "../components/CanvasEditor";
import { TileMenu } from "../components/TileMenu";

/**
 * The canvas dashboard.
 *
 * A canvas is a saved node graph. The dashboard is a grid of them; each tile
 * shows the last result on it
 * the cover for a canvas.
 */
const coverOf = (
  canvas: Canvas,
): { url: string; kind: "image" | "video" } | null => {
  for (let index = canvas.nodes.length - 1; index >= 0; index -= 1) {
    const output = canvas.nodes[index]?.data.output;
    if (typeof output !== "string" || output.length === 0) continue;
    const kind =
      canvas.nodes[index]?.data.outputKind === "video" ? "video" : "image";
    return { url: output, kind };
  }
  return null;
};

export const CanvasPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** The canvas whose name is being edited inline. */
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const draft = useRef<HTMLInputElement | null>(null);

  const reload = async () => {
    try {
      const { canvases: list } = await api.canvases();
      setCanvases(list);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load the canvases.",
      );
    }
  };

  useEffect(() => {
    if (id) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (renaming === null) return;
    const element = draft.current;
    if (!element) return;
    element.focus();
    element.select();
  }, [renaming]);

  if (id) return <CanvasEditor canvasId={id} />;

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const { canvas } = await api.createCanvas("Untitled canvas");
      navigate(`/canvas/${canvas.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create.");
    } finally {
      setCreating(false);
    }
  };

  const startRename = (canvas: Canvas) => {
    setRenaming(canvas.id);
    setDraftName(canvas.name);
  };

  const commitRename = async (canvasId: string) => {
    const name = draftName.trim();
    setRenaming(null);
    if (!name) return;
    try {
      await api.saveCanvas(canvasId, { name });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rename.");
    }
  };

  const remove = async (canvasId: string) => {
    try {
      await api.deleteCanvas(canvasId);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete.");
    }
  };

  return (
    <main className="page">
      <span className="eyebrow">Canvas</span>
      <h1 style={{ marginTop: 12 }}>Build your next scene</h1>
      <p className="muted">
        Image, video and motion in one workspace. Chain a character into a
        scene, then a scene into a video.
      </p>

      <div className="row" style={{ margin: "18px 0" }}>
        <button
          type="button"
          className="primary"
          onClick={() => void create()}
          disabled={creating}
        >
          {creating ? "Creating…" : "New canvas"}
        </button>
        <span className="muted small">{canvases.length} canvas</span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="cards">
        {canvases.map((canvas) => {
          const cover = coverOf(canvas);
          return (
            <article key={canvas.id} className="card">
              <Link to={`/canvas/${canvas.id}`}>
                {cover ? (
                  cover.kind === "video" ? (
                    <video src={cover.url} muted />
                  ) : (
                    <img src={cover.url} alt="" />
                  )
                ) : (
                  <div
                    className="dot-grid"
                    style={{
                      aspectRatio: "1",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--faint)",
                      fontSize: 13,
                    }}
                  >
                    empty
                  </div>
                )}
              </Link>
              <div className="body">
                {renaming === canvas.id ? (
                  <input
                    ref={draft}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void commitRename(canvas.id);
                      if (event.key === "Escape") setRenaming(null);
                    }}
                    onBlur={() => void commitRename(canvas.id)}
                    aria-label="Canvas name"
                  />
                ) : (
                  <strong>{canvas.name}</strong>
                )}
                <span className="muted small">
                  {canvas.nodes.length} node{canvas.nodes.length === 1 ? "" : "s"}
                </span>
                <div className="row">
                  <Link to={`/canvas/${canvas.id}`} className="muted small">
                    Open
                  </Link>
                  <span className="spacer" />
                  <TileMenu
                    label={`More for ${canvas.name}`}
                    items={[
                      {
                        key: "rename",
                        label: "Rename",
                        onSelect: () => startRename(canvas),
                      },
                      {
                        key: "delete",
                        label: "Delete",
                        danger: true,
                        onSelect: () => void remove(canvas.id),
                      },
                    ]}
                  />
                </div>
              </div>
            </article>
          );
        })}
        {canvases.length === 0 && !error ? (
          <p className="muted">No canvases yet. Create one to start.</p>
        ) : null}
      </div>
    </main>
  );
};
