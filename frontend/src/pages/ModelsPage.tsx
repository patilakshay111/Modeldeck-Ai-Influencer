import { useEffect, useState } from "react";
import { api, type ModelSummary } from "../lib/api";
import { groupByTask, firstPrice, taskLabel } from "../components/ModelPicker";

export const ModelsPage = () => {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { models: list, providers: available } = await api.models();
        setModels(list);
        setProviders(available);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load models.");
      }
    })();
  }, []);

  return (
    <main className="page">
      <h1>Models</h1>
      <p className="muted">
        Every model is billed at its own cost. No subscription sits between you
        and the provider.
      </p>

      <div className="row">
        {Object.entries(providers).map(([id, ready]) => (
          <span key={id} className={ready ? "chip ok" : "chip off"}>
            {id}: {ready ? "configured" : "no key on this host"}
          </span>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {groupByTask(models).map(([task, list]) => (
        <section key={task} className="model-section">
          <h2>{taskLabel(task)}</h2>
          <div className="table">
            {list.map((model) => (
              <div key={model.key} className="table-row">
                <span className="model-name">
                  {model.displayName}
                  {model.available ? "" : " (unavailable)"}
                </span>
                <span className="muted small">key: {model.key}</span>
                <span className="muted small">
                  {model.available
                    ? `${firstPrice(model)} cr`
                    : (model.unavailableReason ?? "no key on this host")}
                </span>
                <span className="muted small">
                  {model.acceptsPrompt ? "prompt" : "no prompt"}
                  {model.acceptsReferenceImages ? " · reference" : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
};
