import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface LibraryAsset {
  url: string;
  contentType: string | null;
  isVideo: boolean;
  modelKey: string;
  prompt: string;
  jobId: string;
  createdAt: number;
}

export const LibraryPage = () => {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { assets: list } = await api.library();
        setAssets(list);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load the library.");
      }
    })();
  }, []);

  return (
    <main className="page">
      <h1>Library</h1>
      <p className="muted">Everything you have generated on this account.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="results">
        {assets.map((asset) => (
          <figure key={`${asset.jobId}-${asset.url}`} className="result">
            {asset.isVideo ? (
              <video src={asset.url} controls playsInline />
            ) : (
              <img src={asset.url} alt={asset.prompt} />
            )}
            <figcaption>
              {asset.modelKey}
              {asset.prompt ? ` · ${asset.prompt}` : ""}
            </figcaption>
          </figure>
        ))}
        {assets.length === 0 && !error ? (
          <p className="muted empty">Nothing here yet.</p>
        ) : null}
      </div>
    </main>
  );
};
