import { useEffect, useState } from "react";
import { api, type Influencer } from "../lib/api";
import { uploadReference } from "../lib/upload";

/**
 * Avatar builder.
 *
 * One face, one handle. The image becomes the likeness reference used on
 * every generation that names the character.
 */
export const AvatarPage = () => {
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const reload = async () => {
    try {
      const { influencers: list } = await api.influencers();
      setInfluencers(list);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not load your characters.",
      );
    }
  };

  useEffect(() => {
    void reload();
  }, []);

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
      setError("A face image is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const { influencer } = await api.createInfluencer({
        handle,
        name: name || handle,
        description,
        image,
      });
      setSaved(`@${influencer.handle} is ready.`);
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

  return (
    <main className="page">
      <span className="eyebrow">Avatar</span>
      <h1 style={{ marginTop: 12 }}>Build your avatar</h1>
      <p className="muted">
        One image, one handle. Name them with @ in any prompt and the face
        travels with the request — on every model.
      </p>

      <form className="card" onSubmit={save} style={{ marginTop: 20 }}>
        <div className="grid-2">
          <label>
            Handle
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="lena"
              required
            />
          </label>
          <label>
            Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Lena"
            />
          </label>
        </div>
        <label>
          Notes
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            placeholder="Cozy attic bedroom, burgundy knit. For your own reference."
          />
        </label>

        <div className="row">
          <input
            type="file"
            accept="image/*"
            hidden
            id="avatar-file"
            onChange={(event) => void pickImage(event.target.files)}
          />
          <label className="outline button-like" htmlFor="avatar-file">
            {image ? "Replace image" : "Choose a face"}
          </label>
          {image ? <img className="thumb" src={image} alt="face" /> : null}
        </div>

        {error ? <p className="error">{error}</p> : null}
        {saved ? <p style={{ color: "var(--green)" }}>{saved}</p> : null}

        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Saving…" : "Create avatar"}
        </button>
      </form>

      <h2 style={{ marginTop: 30 }}>Your cast</h2>
      <div className="cards">
        {influencers.map((influencer) => (
          <article key={influencer.id} className="card">
            <img src={influencer.image} alt={influencer.name} />
            <div className="body">
              <strong>@{influencer.handle}</strong>
              <span className="muted small">{influencer.name}</span>
              {influencer.description ? (
                <span className="muted small">{influencer.description}</span>
              ) : null}
            </div>
          </article>
        ))}
        {influencers.length === 0 ? (
          <p className="muted">No avatars yet.</p>
        ) : null}
      </div>
    </main>
  );
};
