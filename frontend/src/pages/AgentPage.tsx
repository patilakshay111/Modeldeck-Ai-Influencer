import { useCallback, useEffect, useState } from "react";
import {
  api,
  type AgentChat,
  type AgentJob,
  type AgentMemory,
  type AgentSchedule,
  type Influencer,
  type ModelSummary,
} from "../lib/api";
import { MentionInput } from "../components/MentionInput";
import { firstPrice } from "../components/ModelPicker";

type Panel = "chat" | "memories" | "skills" | "schedules";

/**
 * The agent.
 *
 * ModelDeck does not have a chat box that generates images.
 * It has a **plan, approve, run** pipeline: you write what you want, an LLM
 * turns it into a plan, the plan comes back for approval with the model and
 * duration editable, and only then does it run.
 *
 * This page is that pipeline. Around it sit memories (facts the agent
 * remembers), skills (what it can do) and schedules (recurring jobs).
 */
export const AgentPage = () => {
  const [panel, setPanel] = useState<Panel>("chat");
  const [chats, setChats] = useState<AgentChat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [planners, setPlanners] = useState<
    Array<{ id: string; label: string; provider: string }>
  >([]);
  const [plannerConfigured, setPlannerConfigured] = useState(false);
  const [skills, setSkills] = useState<
    Array<{ id: string; name: string; description: string }>
  >([]);
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [text, setText] = useState("");
  const [plannerModel, setPlannerModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [memoryKey, setMemoryKey] = useState("");
  const [memoryValue, setMemoryValue] = useState("");
  const [scheduleExpression, setScheduleExpression] = useState("0 9 * * *");
  const [scheduleInput, setScheduleInput] = useState("");

  /** The caller's characters, so @mentions resolve in the agent too. */
  const [characters, setCharacters] = useState<Influencer[]>([]);
  const reloadChats = useCallback(async () => {
    try {
      const { chats: list } = await api.agentChats();
      setChats(list);
      setActiveChat((current) => current ?? list[0]?.id ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load chats.");
    }
  }, []);

  const reloadJobs = useCallback(async (chatId: string | null) => {
    if (!chatId) {
      setJobs([]);
      return;
    }
    try {
      const { jobs: list } = await api.agentChat(chatId);
      setJobs(list);
    } catch {
      setJobs([]);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [{ models: list }, plannersInfo, skillsInfo, { influencers }] =
          await Promise.all([
            api.models(),
            api.agentPlanners(),
            api.agentSkills(),
            api.influencers(),
          ]);
        setModels(list);
        setPlanners(plannersInfo.models);
        setPlannerConfigured(plannersInfo.configured);
        setSkills(skillsInfo.skills);
        setCharacters(influencers);
        if (plannersInfo.models[0]) setPlannerModel(plannersInfo.models[0].id);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Could not load the agent.",
        );
      }
    })();
    void reloadChats();
  }, [reloadChats]);

  useEffect(() => {
    void reloadJobs(activeChat);
  }, [activeChat, reloadJobs]);

  const reloadMemories = useCallback(async () => {
    try {
      const { memories: list } = await api.agentMemories();
      setMemories(list);
    } catch {
      setMemories([]);
    }
  }, []);

  const reloadSchedules = useCallback(async () => {
    try {
      const { schedules: list } = await api.agentSchedules();
      setSchedules(list);
    } catch {
      setSchedules([]);
    }
  }, []);

  useEffect(() => {
    if (panel === "memories") void reloadMemories();
    if (panel === "schedules") void reloadSchedules();
  }, [panel, reloadMemories, reloadSchedules]);

  const newChat = async () => {
    try {
      const { chat } = await api.createAgentChat("New chat");
      await reloadChats();
      setActiveChat(chat.id);
      setJobs([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create a chat.");
    }
  };

  const send = async () => {
    const input = text.trim();
    if (!input) return;
    setBusy(true);
    setError(null);
    try {
      let chatId = activeChat;
      if (!chatId) {
        const { chat } = await api.createAgentChat(input.slice(0, 60));
        chatId = chat.id;
        await reloadChats();
        setActiveChat(chat.id);
      }
      const { job } = await api.agentPlan({
        chatId,
        input,
        llmModel: plannerModel || undefined,
      });
      setText("");
      await reloadJobs(chatId);
      void pollJob(job.id, chatId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The agent failed.");
    } finally {
      setBusy(false);
    }
  };

  const pollJob = async (jobId: string, chatId: string) => {
    for (let attempt = 0; attempt < 300; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      try {
        const { job } = await api.agentJob(jobId);
        await reloadJobs(chatId);
        if (
          job.status === "completed" ||
          job.status === "failed" ||
          job.status === "stopped"
        ) {
          return;
        }
      } catch {
        return;
      }
    }
  };

  const approve = async (job: AgentJob) => {
    if (!job.plan) return;
    setBusy(true);
    setError(null);
    try {
      await api.approveAgentJob(job.id, {
        model: job.plan.model,
        ...(job.plan.duration ? { duration: job.plan.duration } : {}),
      });
      await reloadJobs(job.chatId);
      void pollJob(job.id, job.chatId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not approve.");
    } finally {
      setBusy(false);
    }
  };

  const stop = async (job: AgentJob) => {
    try {
      await api.stopAgentJob(job.id);
      await reloadJobs(job.chatId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not stop.");
    }
  };

  const modelFor = (key: string): ModelSummary | undefined =>
    models.find((entry) => entry.key === key);

  return (
    <main className="page agent-page">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <span className="eyebrow">Agent</span>
          <h1 style={{ marginTop: 12 }}>Ask for stills and clips</h1>
        </div>
        <button type="button" className="primary" onClick={() => void newChat()}>
          New chat
        </button>
      </div>

      <div className="agent-panels">
        {(["chat", "memories", "skills", "schedules"] as Panel[]).map((name) => (
          <button
            key={name}
            type="button"
            className={`chip outline${panel === name ? " active" : ""}`}
            onClick={() => setPanel(name)}
          >
            {name}
          </button>
        ))}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {panel === "chat" ? (
        <div className="agent-layout">
          <aside className="agent-chats">
            <h3>Chats</h3>
            {chats.length === 0 ? (
              <p className="muted small">No chats yet.</p>
            ) : null}
            {chats.map((chat) => (
              <button
                type="button"
                key={chat.id}
                className={`agent-chat${
                  activeChat === chat.id ? " active" : ""
                }`}
                onClick={() => setActiveChat(chat.id)}
              >
                <span>{chat.title}</span>
              </button>
            ))}
          </aside>

          <section className="agent-main">
            {!plannerConfigured ? (
              <p className="muted small">
                No planner key is set, so the agent reads your request
                directly. Set <code>OPENAI_API_KEY</code> or{" "}
                <code>ANTHROPIC_API_KEY</code> to have an LLM write the plan.
              </p>
            ) : null}

            <div className="agent-log">
              {jobs.map((job) => (
                <div key={job.id} className="agent-entry">
                  <div className="turn you">{job.input}</div>

                  {job.plan ? (
                    <div className="ag-approve-dock">
                      <div className="ag-approve-head">
                        <strong>{job.plan.summary}</strong>
                      </div>
                      <p className="ag-approve-prompt">{job.plan.prompt}</p>
                      <div className="row">
                        <label style={{ marginBottom: 0 }}>
                          Model
                          <select
                            value={job.plan.model}
                            onChange={(event) =>
                              setJobs((previous) =>
                                previous.map((entry) =>
                                  entry.id === job.id && entry.plan
                                    ? {
                                        ...entry,
                                        plan: {
                                          ...entry.plan,
                                          model: event.target.value,
                                        },
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            {models
                              .filter((model) => model.available)
                              .map((model) => (
                                <option key={model.key} value={model.key}>
                                  {model.displayName} · {firstPrice(model)} cr
                                </option>
                              ))}
                          </select>
                        </label>
                        {job.plan.kind === "video" ? (
                          <label style={{ marginBottom: 0 }}>
                            Duration
                            <select
                              value={job.plan.duration ?? ""}
                              onChange={(event) =>
                                setJobs((previous) =>
                                  previous.map((entry) =>
                                    entry.id === job.id && entry.plan
                                      ? {
                                          ...entry,
                                          plan: {
                                            ...entry.plan,
                                            duration: event.target.value,
                                          },
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            >
                              {(modelFor(job.plan.model)?.durations ?? [
                                "5",
                              ]).map((value) => (
                                <option key={value} value={value}>
                                  {value}s
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}
                      </div>
                      {job.steps.length > 0 ? (
                        <ul className="ag-steps">
                          {job.steps.map((step) => (
                            <li key={step.id} className={step.status}>
                              {step.label}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <div className="ag-approve-foot">
                        {job.status === "awaiting_approval" ? (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => void stop(job)}
                            >
                              Skip
                            </button>
                            <button
                              type="button"
                              className="primary"
                              disabled={busy}
                              onClick={() => void approve(job)}
                            >
                              Approve
                            </button>
                          </>
                        ) : (
                          <span className="muted small">
                            {job.status === "running"
                              ? "Working…"
                              : job.status === "completed"
                                ? "Done"
                                : job.status === "failed"
                                  ? (job.error ?? "Failed")
                                  : job.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="turn studio">
                      {job.error ?? "Planning…"}
                    </div>
                  )}

                  {job.outputs.length > 0 ? (
                    <div className="results">
                      {job.outputs.map((output) => (
                        <figure key={output.url} className="result">
                          {output.kind === "video" ? (
                            <video src={output.url} controls playsInline />
                          ) : (
                            <img src={output.url} alt={job.plan?.prompt} />
                          )}
                        </figure>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {jobs.length === 0 ? (
                <p className="muted">
                  Describe what you want. The agent plans it, you approve it, it
                  runs.
                </p>
              ) : null}
            </div>

            <form
              className="row"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              {planners.length > 0 ? (
                <select
                  value={plannerModel}
                  onChange={(event) => setPlannerModel(event.target.value)}
                  style={{ maxWidth: 190 }}
                  aria-label="Planner model"
                >
                  {planners.map((planner) => (
                    <option key={planner.id} value={planner.id}>
                      {planner.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <MentionInput
                value={text}
                onChange={setText}
                characters={characters}
                placeholder="A cozy attic bedroom, burgundy knit, soft window light…"
                rows={2}
              />
              <button
                type="submit"
                className="primary"
                disabled={busy || !text.trim()}
              >
                {busy ? "Planning…" : "Send"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      {panel === "memories" ? (
        <section className="agent-side">
          <h2>Memories</h2>
          <p className="muted">
            Facts the agent keeps. They are included in every plan it writes.
          </p>
          <form
            className="card"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!memoryKey.trim()) return;
              try {
                await api.saveAgentMemory(memoryKey, memoryValue);
                setMemoryKey("");
                setMemoryValue("");
                await reloadMemories();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Could not save.",
                );
              }
            }}
          >
            <div className="grid-2">
              <label>
                Key
                <input
                  value={memoryKey}
                  onChange={(event) => setMemoryKey(event.target.value)}
                  placeholder="brand"
                />
              </label>
              <label>
                Value
                <input
                  value={memoryValue}
                  onChange={(event) => setMemoryValue(event.target.value)}
                  placeholder="always use warm lighting"
                />
              </label>
            </div>
            <button type="submit" className="primary">
              Remember
            </button>
          </form>
          {memories.map((memory) => (
            <div key={memory.id} className="card row">
              <span>
                <strong>{memory.key}</strong> — {memory.value}
              </span>
              <button
                type="button"
                className="ghost sm danger"
                onClick={async () => {
                  await api.deleteAgentMemory(memory.id);
                  await reloadMemories();
                }}
              >
                Forget
              </button>
            </div>
          ))}
        </section>
      ) : null}

      {panel === "skills" ? (
        <section className="agent-side">
          <h2>Skills</h2>
          <p className="muted">What this agent knows how to do.</p>
          {skills.map((skill) => (
            <div key={skill.id} className="card">
              <strong>{skill.name}</strong>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                {skill.description}
              </p>
            </div>
          ))}
        </section>
      ) : null}

      {panel === "schedules" ? (
        <section className="agent-side">
          <h2>Schedules</h2>
          <p className="muted">Recurring jobs the agent runs on its own.</p>
          <form
            className="card"
            onSubmit={async (event) => {
              event.preventDefault();
              try {
                await api.createAgentSchedule(
                  scheduleExpression,
                  scheduleInput,
                );
                setScheduleInput("");
                await reloadSchedules();
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Could not save.",
                );
              }
            }}
          >
            <div className="grid-2">
              <label>
                When
                <input
                  value={scheduleExpression}
                  onChange={(event) => setScheduleExpression(event.target.value)}
                  placeholder="0 9 * * *"
                />
              </label>
              <label>
                What
                <input
                  value={scheduleInput}
                  onChange={(event) => setScheduleInput(event.target.value)}
                  placeholder="a new portrait of Ava"
                />
              </label>
            </div>
            <button type="submit" className="primary">
              Schedule
            </button>
          </form>
          {schedules.map((schedule) => (
            <div key={schedule.id} className="card row">
              <span>
                <code>{schedule.expression}</code> — {schedule.input}
              </span>
              <button
                type="button"
                className="ghost sm"
                onClick={async () => {
                  await api.toggleAgentSchedule(schedule.id);
                  await reloadSchedules();
                }}
              >
                {schedule.enabled ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                className="ghost sm danger"
                onClick={async () => {
                  await api.deleteAgentSchedule(schedule.id);
                  await reloadSchedules();
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
};
