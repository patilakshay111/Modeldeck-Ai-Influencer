import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type Influencer, type ModelSummary } from "../lib/api";
import { useAuth } from "../lib/auth";
import { ModelPicker } from "../components/ModelPicker";
import { MentionInput, mentionedCharacters } from "../components/MentionInput";
import { uploadReference } from "../lib/upload";

/** Which family of models a studio tab shows. */
export type StudioMode = "image" | "video" | "upscale";

const TASKS: Record<StudioMode, ModelSummary["task"][]> = {
  image: ["text-to-image", "image-to-image", "image-to-text", "upscale-image"],
  video: ["text-to-video", "image-to-video", "video-to-video", "upscale-video"],
  upscale: ["upscale-image", "upscale-video"],
};

/**
 * The studio.
 *
 * Generate starts a job and the client polls for its result, which is the
 * contract the backend publishes. Nothing is streamed; the result appears
 * when the job completes.
 */
export const Studio = ({ mode = "image" }: { mode?: StudioMode }) => {
  const { refresh } = useAuth();
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [modelKey, setModelKey] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("");
  const [resolution, setResolution] = useState("");
  const [duration, setDuration] = useState("");
  const [references, setReferences] = useState<string[]>([]);
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [results, setResults] = useState<
    Array<{ url: string; isVideo: boolean; prompt: string; modelKey: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const allowed = useMemo(() => new Set(TASKS[mode]), [mode]);
  const visibleModels = useMemo(
    () => models.filter((model) => allowed.has(model.task)),
    [models, allowed],
  );

  const mentioned = useMemo(
    () => mentionedCharacters(prompt, influencers),
    [prompt, influencers],
  );

  /** Every reference that will be sent: the uploaded ones plus any mentioned character. */
  const attachedReferences = useMemo(
    () => Array.from(new Set([...references, ...mentioned.map((c) => c.image)])),
    [references, mentioned],
  );

  const model = useMemo(
    () => visibleModels.find((entry) => entry.key === modelKey) ?? null,
    [visibleModels, modelKey],
  );

  useEffect(() => {
    void (async () => {
      try {
        const { models: list } = await api.models();
        setModels(list);
        const { influencers: characters } = await api.influencers();
        setInfluencers(characters);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load the studio.");
      }
    })();
  }, []);

  // Keep a valid selection when the tab changes.
  useEffect(() => {
    const first =
      visibleModels.find((entry) => entry.available && entry.acceptsPrompt) ??
      visibleModels.find((entry) => entry.available) ??
      visibleModels[0];
    setModelKey(first?.key ?? null);
    setAspectRatio("");
    setResolution("");
    setDuration("");
  }, [visibleModels]);

  const poll = useCallback(async (jobId: string) => {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const job = await api.status(jobId);
      setStatus(job.status);
      if (job.status === "completed") {
        return job.output.map((asset) => ({
          url: asset.url,
          isVideo: asset.isVideo,
          prompt: "",
          modelKey: job.modelKey,
        }));
      }
      if (job.status === "failed") {
        throw new Error(job.error ?? "The generation failed.");
      }
    }
    throw new Error("The generation did not finish in time.");
  }, []);

  const generate = async () => {
    if (!model) return;
    setBusy(true);
    setError(null);
    setStatus("starting");
    // Any character named with @ in the prompt is used as a reference image,
    // so "@lena" in the text means "with Lena's face".
    const images = attachedReferences;
    try {
      const { jobId } = await api.generate({
        modelKey: model.key,
        prompt: prompt.trim() || undefined,
        images: images.length > 0 ? images : undefined,
        aspectRatio: aspectRatio || undefined,
        resolution: resolution || undefined,
        duration: duration || undefined,
      });
      setStatus("running");
      const assets = await poll(jobId);
      setResults((previous) =>
        [...assets, ...previous].map((asset) => ({
          ...asset,
          prompt: prompt.trim(),
          modelKey: model.key,
        })),
      );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The generation failed.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  };

  const onPickFile = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setError(null);
    try {
      const url = await uploadReference(files[0]);
      setReferences((previous) => [...previous, url]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  };

  const addInfluencer = (influencer: Influencer) => {
    setReferences((previous) =>
      previous.includes(influencer.image)
        ? previous
        : [...previous, influencer.image],
    );
  };

  return (
    <div className="studio-body">
      <aside className="model-pane">
        <ModelPicker
          models={visibleModels}
          selected={modelKey}
          onSelect={(entry) => {
            setModelKey(entry.key);
            setAspectRatio("");
            setResolution("");
            setDuration("");
          }}
        />
      </aside>

      <section className="work-pane">
        <div className="composer">
          <MentionInput
            value={prompt}
            onChange={setPrompt}
            characters={influencers}
            onMention={(character) =>
              setReferences((previous) =>
                previous.includes(character.image)
                  ? previous
                  : [...previous, character.image],
              )
            }
            placeholder={
              model?.acceptsPrompt
                ? "Describe what you want to create…  (@name uses that character)"
                : "This model does not take a prompt"
            }
            rows={4}
            disabled={!model?.acceptsPrompt}
          />

          {mentioned.length > 0 ? (
            <div className="row" style={{ marginTop: 10 }}>
              {mentioned.map((character) => (
                <span key={character.id} className="chip ok">
                  @{character.handle} · face-lock
                </span>
              ))}
            </div>
          ) : null}

          {mentioned.length > 0 &&
          model &&
          !model.acceptsReferenceImages ? (
            <p className="warn small" style={{ marginTop: 8 }}>
              {model.displayName} cannot take a reference image, so that
              character will not be used. Pick an edit model to keep the face
              locked.
            </p>
          ) : null}

          {model?.acceptsReferenceImages ||
          mentioned.length > 0 ||
          attachedReferences.length > 0 ? (
            <div className="references">
              <div className="row">
                <strong className="small">Reference images</strong>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(event) => void onPickFile(event.target.files)}
                />
                <button
                  type="button"
                  className="outline sm"
                  onClick={() => fileInput.current?.click()}
                >
                  Upload
                </button>
              </div>
              <div className="ref-list">
                {attachedReferences.map((url) => (
                  <span key={url} className="ref">
                    <img src={url} alt="reference" />
                    <button
                      type="button"
                      aria-label="Remove reference"
                      onClick={() =>
                        setReferences((previous) =>
                          previous.filter((entry) => entry !== url),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {influencers.length > 0 ? (
                <div className="row">
                  <strong className="small">Characters</strong>
                  {influencers.map((influencer) => (
                    <button
                      type="button"
                      key={influencer.id}
                      className="chip outline"
                      onClick={() => addInfluencer(influencer)}
                    >
                      @{influencer.handle}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="settings">
            {model && model.aspectRatios.length > 0 ? (
              <label>
                Aspect
                <select
                  value={aspectRatio}
                  onChange={(event) => setAspectRatio(event.target.value)}
                >
                  <option value="">default</option>
                  {model.aspectRatios.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {model && model.resolutions.length > 0 ? (
              <label>
                {mode === "video" ? "Quality" : "Resolution"}
                <select
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                >
                  <option value="">default</option>
                  {model.resolutions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {model && model.durations.length > 0 ? (
              <label>
                Duration
                <select
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                >
                  <option value="">default</option>
                  {model.durations.map((value) => (
                    <option key={value} value={value}>
                      {value}s
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="primary"
              onClick={() => void generate()}
              disabled={busy || !model || !model.available}
              title={model?.unavailableReason}
            >
              {busy
                ? `Generating (${status ?? "…"})`
                : model?.available === false
                  ? "Unavailable"
                  : "Generate"}
            </button>
          </div>

          {error ? <p className="error">{error}</p> : null}
        </div>

        <div className="results">
          {results.length === 0 ? (
            <p className="muted empty">
              Nothing generated yet. Pick a model and describe what you want.
            </p>
          ) : (
            results.map((result) => (
              <figure key={result.url} className="result">
                {result.isVideo ? (
                  <video src={result.url} controls playsInline />
                ) : (
                  <img src={result.url} alt={result.prompt} />
                )}
                <figcaption>
                  {result.modelKey}
                  {result.prompt ? ` · ${result.prompt}` : ""}
                </figcaption>
              </figure>
            ))
          )}
        </div>
      </section>
    </div>
  );
};
