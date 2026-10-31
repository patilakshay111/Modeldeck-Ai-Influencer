import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  type Canvas,
  type CanvasNode,
  type Influencer,
  type ModelSummary,
} from "../lib/api";
import { firstPrice } from "../components/ModelPicker";
import { MentionInput, mentionedCharacters } from "../components/MentionInput";

const NODE_WIDTH = 248;
const NODE_HEIGHT = 236;

/** How far the pointer must travel before a press becomes a drag. */
const DRAG_THRESHOLD_PX = 5;

type PortKind = "in" | "out";

interface PendingPort {
  nodeId: string;
  port: PortKind;
  startX: number;
  startY: number;
  dragging: boolean;
}

interface LinkGuide {
  fromId: string;
  port: PortKind;
  x: number;
  y: number;
  hoverId: string | null;
}

const newNode = (
  kind: CanvasNode["kind"],
  x: number,
  y: number,
): CanvasNode => ({
  id: `nd_${Math.random().toString(16).slice(2, 10)}`,
  kind,
  x,
  y,
  data: {
    model: kind === "video" ? "kling-3.0" : "flux-2-max",
    prompt: "",
    aspect: "1:1",
    quality: kind === "video" ? "720p" : "1K",
    sourceNodeIds: [],
    status: "idle",
    error: null,
  },
});

/**
 * The canvas editor.
 *
 * A canvas is a graph of generation nodes. Each node holds a model, a prompt
 * and the settings for one run; wiring a node's output into another node's
 * input makes the second one use the first one's result as its reference
 * image. That is the whole idea: chain a character into a scene, then a
 * scene into a video.
 *
 * Linking is decided by movement, not by which handler runs:
 *
 *   - press a dot and move  → a drag, and the drop decides the wire
 *   - press a dot and release without moving → a click
 *
 * A click on an output dot picks that node as the source; a click on an input
 * dot then attaches the picked source to it. A click on an input dot with
 * nothing picked opens a list of the other nodes to link from, so linking
 * never depends on hitting a small dot.
 */
export const CanvasEditor = ({ canvasId }: { canvasId: string }) => {
  const [canvas, setCanvas] = useState<Canvas | null>(null);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [characters, setCharacters] = useState<Influencer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickSourceFor, setPickSourceFor] = useState<string | null>(null);
  /** True while the canvas name is being edited. */
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");
  const nameInput = useRef<HTMLInputElement | null>(null);
  const [guide, setGuide] = useState<LinkGuide | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveTimer = useRef<number | null>(null);
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const pending = useRef<PendingPort | null>(null);
  /**
   * The picked source, held in a ref as well as in state.
   *
   * The pointer listeners are created when a port is pressed, so they close
   * over whatever `armed` was at that moment. A click on an output dot sets
   * the source afterwards, so the listener has to read the current value, not
   * the one it captured.
   */
  const armedRef = useRef<string | null>(null);
  const [armed, setArmedState] = useState<string | null>(null);
  const setArmed = useCallback((value: string | null) => {
    armedRef.current = value;
    setArmedState(value);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [{ canvas: loaded }, { models: list }, { influencers: cast }] =
          await Promise.all([api.canvas(canvasId), api.models(), api.influencers()]);
        setCanvas(loaded);
        setModels(list);
        setCharacters(cast);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not open that canvas.",
        );
      }
    })();
  }, [canvasId]);

  const save = useCallback((next: Canvas) => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void api.saveCanvas(next.id, { nodes: next.nodes }).catch(() => undefined);
    }, 500);
  }, []);

  /** Rename the canvas and persist it. */
  const commitRename = useCallback(async () => {
    setRenaming(false);
    const name = draftName.trim();
    if (!name || !canvas || name === canvas.name) return;
    setCanvas({ ...canvas, name });
    try {
      await api.saveCanvas(canvas.id, { name });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not rename this canvas.",
      );
    }
  }, [canvas, draftName]);

  const patchNode = useCallback(
    (id: string, patch: Partial<CanvasNode["data"]>) => {
      setCanvas((current) => {
        if (!current) return current;
        const next: Canvas = {
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === id ? { ...node, data: { ...node.data, ...patch } } : node,
          ),
        };
        save(next);
        return next;
      });
    },
    [save],
  );

  const addNode = (kind: CanvasNode["kind"]) => {
    setCanvas((current) => {
      if (!current) return current;
      const node = newNode(
        kind,
        140 + (current.nodes.length % 4) * 300,
        140 + Math.floor(current.nodes.length / 4) * 280,
      );
      const next = { ...current, nodes: [...current.nodes, node] };
      setSelected(node.id);
      void api.saveCanvas(next.id, { nodes: next.nodes }).catch(() => undefined);
      return next;
    });
  };

  const removeNode = (id: string) => {
    setCanvas((current) => {
      if (!current) return current;
      const next: Canvas = {
        ...current,
        nodes: current.nodes
          .filter((node) => node.id !== id)
          .map((node) => ({
            ...node,
            data: {
              ...node.data,
              sourceNodeIds: (node.data.sourceNodeIds ?? []).filter(
                (sourceId) => sourceId !== id,
              ),
            },
          })),
      };
      void api.saveCanvas(next.id, { nodes: next.nodes }).catch(() => undefined);
      return next;
    });
  };

  /** Wire `sourceId` into `targetId`, and persist it. */
  const connect = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setCanvas((current) => {
      if (!current) return current;
      const target = current.nodes.find((node) => node.id === targetId);
      if (!target) return current;
      const sources = target.data.sourceNodeIds ?? [];
      if (sources.includes(sourceId)) return current;
      const next: Canvas = {
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === targetId
            ? {
                ...node,
                data: { ...node.data, sourceNodeIds: [...sources, sourceId] },
              }
            : node,
        ),
      };
      // Persist outside the state updater, so the body is never computed
      // during a render.
      void api
        .saveCanvas(next.id, { nodes: next.nodes })
        .catch(() => undefined);
      return next;
    });
  }, []);

  // ── Port interaction ────────────────────────────────────────────────────

  const portListeners = useRef<(() => void) | null>(null);

  const onPortDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    node: CanvasNode,
    port: PortKind,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setSelected(node.id);

    pending.current = {
      nodeId: node.id,
      port,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };

    // The listeners are attached now, not in an effect. A press and a release
    // can happen inside one frame, and an effect would not have run yet.
    const onMove = (move: PointerEvent) => {
      const state = pending.current;
      if (!state) return;
      const moved =
        Math.abs(move.clientX - state.startX) +
        Math.abs(move.clientY - state.startY);
      if (!state.dragging && moved < DRAG_THRESHOLD_PX) return;
      state.dragging = true;

      const surface = document.querySelector<HTMLElement>(".canvas-surface");
      const rect = surface?.getBoundingClientRect();
      const under = document.elementFromPoint(move.clientX, move.clientY);
      const port = under?.closest<HTMLElement>("[data-port-node]");
      const nodeEl = under?.closest<HTMLElement>("[data-node-id]");
      setGuide({
        fromId: state.nodeId,
        port: state.port,
        x: rect ? move.clientX - rect.left : move.clientX,
        y: rect ? move.clientY - rect.top : move.clientY,
        hoverId:
          port?.getAttribute("data-port-node") ??
          nodeEl?.getAttribute("data-node-id") ??
          null,
      });
    };

    const onUp = (up: PointerEvent) => {
      const state = pending.current;
      pending.current = null;
      setGuide(null);
      portListeners.current?.();
      portListeners.current = null;
      if (!state) return;

      if (!state.dragging) {
        // A click, not a drag.
        if (state.port === "out") {
          setArmed(
            armedRef.current === state.nodeId ? null : state.nodeId,
          );
          setPickSourceFor(null);
        } else if (armedRef.current) {
          connect(armedRef.current, state.nodeId);
          setArmed(null);
          setPickSourceFor(null);
        } else {
          setPickSourceFor((current) =>
            current === state.nodeId ? null : state.nodeId,
          );
        }
        return;
      }

      // A drag: the drop decides the wire.
      const under = document.elementFromPoint(up.clientX, up.clientY);
      const port = under?.closest<HTMLElement>("[data-port-node]");
      const nodeEl = under?.closest<HTMLElement>("[data-node-id]");
      const droppedId =
        port?.getAttribute("data-port-node") ??
        nodeEl?.getAttribute("data-node-id") ??
        null;
      const droppedKind = port?.getAttribute("data-port-kind") as
        | PortKind
        | null;
      if (!droppedId || droppedId === state.nodeId) return;

      // The direction comes from where the drag started.
      const startedOnOutput = state.port === "out";
      const landedOnOutput = droppedKind === "out";
      const sourceId =
        startedOnOutput === landedOnOutput ? state.nodeId : droppedId;
      const targetId =
        startedOnOutput === landedOnOutput ? droppedId : state.nodeId;
      connect(sourceId, targetId);
    };

    const onCancel = () => {
      pending.current = null;
      setGuide(null);
      portListeners.current?.();
      portListeners.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    portListeners.current = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  };

  useEffect(
    () => () => {
      portListeners.current?.();
    },
    [],
  );

  // ── Node dragging ───────────────────────────────────────────────────────

  const onNodeDown = (
    event: React.PointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => {
    if ((event.target as HTMLElement).closest(".port, button")) return;
    const surface = event.currentTarget.closest(".canvas-surface");
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    dragging.current = {
      id: node.id,
      dx: event.clientX - rect.left - node.x,
      dy: event.clientY - rect.top - node.y,
    };
    setSelected(node.id);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (guide) return;
    const active = dragging.current;
    if (!active) return;
    const surface = event.currentTarget.closest(".canvas-surface");
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    const x = Math.max(8, event.clientX - rect.left - active.dx);
    const y = Math.max(8, event.clientY - rect.top - active.dy);
    setCanvas((current) =>
      current
        ? {
            ...current,
            nodes: current.nodes.map((node) =>
              node.id === active.id ? { ...node, x, y } : node,
            ),
          }
        : current,
    );
  };

  const onPointerUp = () => {
    const active = dragging.current;
    dragging.current = null;
    if (!active || !canvas) return;
    void api
      .saveCanvas(canvas.id, { nodes: canvas.nodes })
      .catch(() => undefined);
  };

  // ── Running a node ──────────────────────────────────────────────────────

  const run = async (node: CanvasNode) => {
    setError(null);
    patchNode(node.id, { status: "queued", error: null });
    try {
      await api.runCanvasNode(canvasId, node.id);
      const poll = window.setInterval(async () => {
        try {
          const { node: updated } = await api.canvasNode(canvasId, node.id);
          patchNode(node.id, {
            status: updated.data.status,
            error: updated.data.error ?? null,
            output: updated.data.output,
            outputKind: updated.data.outputKind,
          });
          if (
            updated.data.status === "completed" ||
            updated.data.status === "failed"
          ) {
            window.clearInterval(poll);
          }
        } catch {
          window.clearInterval(poll);
        }
      }, 3000);
    } catch (cause) {
      patchNode(node.id, { status: "failed" });
      setError(cause instanceof Error ? cause.message : "The run failed.");
    }
  };

  const wires = useMemo(() => {
    if (!canvas) return [];
    const byId = new Map(canvas.nodes.map((node) => [node.id, node]));
    const list: Array<{ from: CanvasNode; to: CanvasNode }> = [];
    for (const node of canvas.nodes) {
      for (const sourceId of node.data.sourceNodeIds ?? []) {
        const source = byId.get(sourceId);
        if (source) list.push({ from: source, to: node });
      }
    }
    return list;
  }, [canvas]);

  if (error && !canvas) {
    return (
      <main className="page">
        <p className="error">{error}</p>
      </main>
    );
  }
  if (!canvas) {
    return <main className="page muted">Loading…</main>;
  }

  const modelOptions = models.filter(
    (model) =>
      model.available &&
      (model.task.startsWith("text-to-image") ||
        model.task.startsWith("image-to-image") ||
        model.task.startsWith("image-to-video") ||
        model.task.startsWith("text-to-video")),
  );

  const guideNode = guide
    ? canvas.nodes.find((node) => node.id === guide.fromId)
    : undefined;

  return (
    <div className="canvas-wrap">
      <div
        className="canvas-surface dot-grid"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="canvas-inner">
          <svg className="canvas-wires" width="100%" height="100%">
            {wires.map(({ from, to }) => (
              <path
                key={`${from.id}-${to.id}`}
                d={`M ${from.x + NODE_WIDTH} ${from.y + NODE_HEIGHT / 2} C ${
                  from.x + NODE_WIDTH + 70
                } ${from.y + NODE_HEIGHT / 2}, ${to.x - 70} ${to.y + NODE_HEIGHT / 2}, ${
                  to.x
                } ${to.y + NODE_HEIGHT / 2}`}
                fill="none"
                stroke="rgba(255,45,138,.7)"
                strokeWidth={2}
              />
            ))}
            {guide && guideNode ? (
              <path
                d={`M ${
                  guide.port === "out"
                    ? guideNode.x + NODE_WIDTH
                    : guideNode.x
                } ${guideNode.y + NODE_HEIGHT / 2} L ${guide.x} ${guide.y}`}
                fill="none"
                stroke="rgba(255,111,181,.95)"
                strokeWidth={2}
                strokeDasharray="6 5"
              />
            ) : null}
          </svg>

          {canvas.nodes.map((node) => {
            const running =
              node.data.status === "queued" || node.data.status === "running";
            const mentions = mentionedCharacters(node.data.prompt ?? "", characters);
            const isHovered = guide?.hoverId === node.id;
            return (
              <div
                key={node.id}
                className={`canvas-node${selected === node.id ? " selected" : ""}${
                  isHovered ? " link-target" : ""
                }`}
                data-node-id={node.id}
                style={{ left: node.x, top: node.y }}
                onPointerDown={(event) => onNodeDown(event, node)}
              >
                <div className="node-head">
                  <span>{node.kind === "video" ? "Video" : "Image"}</span>
                  <div className="row" style={{ gap: 4 }}>
                    <button
                      type="button"
                      className="ghost sm node-link"
                      aria-label={`Link a source into this ${node.kind} node`}
                      title="Link a source node into this one"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => {
                        setPickSourceFor(
                          pickSourceFor === node.id ? null : node.id,
                        );
                        setArmed(null);
                      }}
                    >
                      link
                    </button>
                    <button
                      type="button"
                      className="ghost sm"
                      aria-label="Delete node"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => removeNode(node.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>

                <div className="node-body">
                  <div className="node-preview">
                    {node.data.output ? (
                      node.data.outputKind === "video" ? (
                        <video src={node.data.output} muted loop playsInline controls />
                      ) : (
                        <img src={node.data.output} alt="result" />
                      )
                    ) : running ? (
                      <span>Working…</span>
                    ) : (
                      <span>No output yet</span>
                    )}
                  </div>

                  <select
                    value={node.data.model ?? ""}
                    onChange={(event) =>
                      patchNode(node.id, { model: event.target.value })
                    }
                  >
                    {modelOptions.map((entry) => (
                      <option key={entry.key} value={entry.key}>
                        {entry.displayName} · {firstPrice(entry)} cr
                      </option>
                    ))}
                  </select>

                  <MentionInput
                    value={node.data.prompt ?? ""}
                    rows={2}
                    placeholder="Describe what this node makes"
                    characters={characters}
                    onChange={(next) => patchNode(node.id, { prompt: next })}
                    onMention={(character) =>
                      patchNode(node.id, {
                        sourceNodeIds: Array.from(
                          new Set([
                            ...(node.data.sourceNodeIds ?? []),
                            ...canvas.nodes
                              .filter((entry) => entry.data.output === character.image)
                              .map((entry) => entry.id),
                          ]),
                        ),
                      })
                    }
                  />

                  {mentions.length > 0 ? (
                    <div className="row" style={{ gap: 5 }}>
                      {mentions.map((character) => (
                        <span key={character.id} className="chip ok">
                          @{character.handle} · ready
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="row" style={{ gap: 6 }}>
                    <select
                      value={node.data.aspect ?? ""}
                      onChange={(event) =>
                        patchNode(node.id, { aspect: event.target.value })
                      }
                      style={{ flex: 1 }}
                    >
                      {["1:1", "16:9", "9:16", "4:3", "3:4"].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="primary sm"
                      onClick={() => void run(node)}
                      disabled={running}
                    >
                      {running ? "…" : "Run"}
                    </button>
                  </div>

                  {node.data.error ? (
                    <p className="error" style={{ margin: 0, fontSize: 12 }}>
                      {node.data.error}
                    </p>
                  ) : null}
                </div>

                <div className="node-ports">
                  <button
                    type="button"
                    className={`port port-in${armed ? " port-armed" : ""}`}
                    data-port-node={node.id}
                    data-port-kind="in"
                    aria-label={`Input of ${node.kind} node`}
                    title="This node's input. Drag onto another node to link them, or click to choose a source."
                    onPointerDown={(event) => onPortDown(event, node, "in")}
                  />
                  <button
                    type="button"
                    className={`port port-out${armed === node.id ? " port-armed" : ""}`}
                    data-port-node={node.id}
                    data-port-kind="out"
                    aria-label={`Output of ${node.kind} node`}
                    title="This node's output. Drag onto another node, or click to pick it as a source."
                    onPointerDown={(event) => onPortDown(event, node, "out")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="canvas-toolbar">
        <button type="button" className="sm" onClick={() => addNode("image")}>
          + Image node
        </button>
        <button type="button" className="sm" onClick={() => addNode("video")}>
          + Video node
        </button>
        {armed ? (
          <span className="muted small">
            Source picked. Click the left dot on the node that should use it.
          </span>
        ) : pickSourceFor ? (
          <span className="muted small">
            Link from:
            {canvas.nodes
              .filter((entry) => entry.id !== pickSourceFor)
              .map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className="chip outline"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    connect(entry.id, pickSourceFor);
                    setPickSourceFor(null);
                  }}
                >
                  {entry.kind} node
                </button>
              ))}
          </span>
        ) : (
          <span className="muted small">
            Drag a dot onto another node to link them, or click a right dot and
            then a left dot.
          </span>
        )}
      </div>

      <div className="canvas-hint">
        {renaming ? (
          <input
            ref={nameInput}
            className="canvas-name-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void commitRename();
              if (event.key === "Escape") setRenaming(false);
            }}
            onBlur={() => void commitRename()}
            aria-label="Canvas name"
          />
        ) : (
          <button
            type="button"
            className="ghost sm canvas-name"
            title="Rename this canvas"
            onClick={() => {
              setDraftName(canvas.name);
              setRenaming(true);
            }}
          >
            {canvas.name}
          </button>
        )}
        <span>
          {canvas.nodes.length} node{canvas.nodes.length === 1 ? "" : "s"}
        </span>
        {armed ? <span>· source picked</span> : null}
        {guide ? <span>· drop on a node</span> : null}
      </div>    </div>
  );
};
