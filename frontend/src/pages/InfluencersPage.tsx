import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type CharacterReference,
  type Influencer,
} from "../lib/api";
import { uploadReference } from "../lib/upload";

const roleLabel = (role: string): string => {
  const map: Record<string, string> = {
    anchor: "Face anchor",
    "turnaround-front": "Front",
    "turnaround-3-quarter-left": "3/4 left",
    "turnaround-3-quarter-right": "3/4 right",
    "turnaround-profile-left": "Profile left",
    "turnaround-profile-right": "Profile right",
    "turnaround-back": "Back",
    "full-body-front": "Full body front",
    "full-body-side": "Full body side",
  };
  return map[role] ?? role;
};

/**
 * Character manager.
 *
 * An influencer is now an identity kit: one face anchor plus generated
 * turnaround and full-body references, a written spec, and a version number.
 * Creating a character builds the kit from the anchor image automatically.
 */
export const InfluencersPage = () => {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    try {
      const { influencers: list } = await api.influencers();
      setInfluencers(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load characters.");
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = setInterval(() => void reload(), 4000);
    return () => clearInterval(timer);
  }, [reload]);

  const pickImage = async (files: FileList | null) => {
    if (!files?.[0]) return;
    setError(null);
    try {
      setImage(await uploadReference(files[0]));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!image) {
      setError("A reference image is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createInfluencer({
        handle,
        name: name || handle,
        description,
        image,
        buildKit: true,
      });
      setHandle("");
      setName("");
      setDescription("");
      setImage(null);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteInfluencer(id);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete.");
    }
  };

  const kitReferences = (influencer: Influencer): CharacterReference[] =>
    (influencer.references ?? []).filter((ref) => ref.role !== "anchor");

  return (
    <main className="page">
      <h1>Characters</h1>
      <p className="muted">
        Save a character once. The identity kit (turnaround, full body, spec)
        keeps the same face and body across models, shots and years.
      </p>

      {error ? <p className="error">{error}</p> : null}

      <form className="card" onSubmit={save}>
        <h2>New character</h2>
        <div className="grid-2">
          <label>
            Handle
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="gavi"
              required
            />
          </label>
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Gavi"
            />
          </label>
        </div>
        <label>
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="What this character looks like, for your own notes."
          />
        </label>

        <div className="row">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => void pickImage(event.target.files)}
          />
          <button
            type="button"
            className="ghost"
            onClick={() => fileInput.current?.click()}
          >
            {image ? "Replace image" : "Choose reference image"}
          </button>
          {image ? <img className="thumb" src={image} alt="reference" /> : null}
        </div>

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save character"}
        </button>
      </form>

      <div className="cards">
        {influencers.map((influencer) => (
          <article key={influencer.id} className="card">
            <div className="kit-header">
              <img
                src={influencer.image}
                alt={influencer.name}
                className="anchor-thumb"
              />
              <div>
                <div className="handle-row">
                  <h3>@{influencer.handle}</h3>
                  <span className={`kit-badge status-${influencer.kitStatus ?? "none"}`}>
                    v{influencer.version ?? 1}
                  </span>
                  <span className={`kit-badge status-${influencer.kitStatus ?? "none"}`}>
                    {influencer.kitStatus ?? "none"}
                  </span>
                </div>
                <p className="muted small">{influencer.name}</p>
                {influencer.description ? (
                  <p className="muted small">{influencer.description}</p>
                ) : null}
              </div>
            </div>

            {(influencer.spec || (influencer.references?.length ?? 0) > 1) && (
              <div className="kit-body">
                {influencer.spec ? (
                  <div className="kit-spec">
                    <strong className="small">Spec</strong>
                    <p className="muted small">{influencer.spec}</p>
                  </div>
                ) : null}
                {kitReferences(influencer).length > 0 ? (
                  <div className="kit-grid">
                    {kitReferences(influencer).map((ref) => (
                      <figure key={`${ref.role}-${ref.url}`} className="kit-cell">
                        <img src={ref.url} alt={ref.role} />
                        <figcaption className="kit-caption">
                          {roleLabel(ref.role)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            )}

            <button
              type="button"
              className="ghost danger"
              onClick={() => void remove(influencer.id)}
            >
              Delete
            </button>
          </article>
        ))}
        {influencers.length === 0 ? (
          <p className="muted">No characters yet.</p>
        ) : null}
      </div>
    </main>
  );
};
