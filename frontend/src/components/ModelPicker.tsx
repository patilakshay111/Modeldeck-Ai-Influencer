import type { ModelSummary } from "../lib/api";

const TASK_LABEL: Record<ModelSummary["task"], string> = {
  "text-to-image": "Text to image",
  "image-to-image": "Image to image",
  "text-to-video": "Text to video",
  "image-to-video": "Image to video",
  "video-to-video": "Video to video",
  "upscale-image": "Image upscale",
  "upscale-video": "Video upscale",
  "image-to-text": "Image understanding",
};

export const taskLabel = (task: ModelSummary["task"]): string => TASK_LABEL[task];

export const groupByTask = (
  models: ModelSummary[],
): Array<[ModelSummary["task"], ModelSummary[]]> => {
  const groups = new Map<ModelSummary["task"], ModelSummary[]>();
  for (const model of models) {
    const list = groups.get(model.task) ?? [];
    list.push(model);
    groups.set(model.task, list);
  }
  return [...groups.entries()];
};

export const ModelPicker = ({
  models,
  selected,
  onSelect,
}: {
  models: ModelSummary[];
  selected: string | null;
  onSelect: (model: ModelSummary) => void;
}) => {
  const groups = groupByTask(models);
  return (
    <div className="model-picker">
      {groups.map(([task, list]) => (
        <section key={task}>
          <h3>{taskLabel(task)}</h3>
          <div className="model-grid">
            {list.map((model) => (
              <button
                type="button"
                key={model.key}
                className={selected === model.key ? "model selected" : "model"}
                disabled={!model.available}
                title={model.unavailableReason}
                onClick={() => onSelect(model)}
              >
                <span className="model-name">{model.displayName}</span>
                {model.spicy ? (
                  <span className="badge spicy">spicy</span>
                ) : null}
                <span className="model-meta">
                  {model.available
                    ? `${firstPrice(model)} cr`
                    : "unavailable"}
                  {model.acceptsReferenceImages ? " · ref" : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

/** The cheapest tier price of a model, for the picker label. */
export const firstPrice = (model: ModelSummary): string => {
  const values = Object.values(model.prices ?? {});
  if (values.length === 0) return "—";
  return Math.min(...values).toFixed(2);
};
