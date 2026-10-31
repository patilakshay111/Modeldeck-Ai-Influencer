import { useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * MCP & CLI.
 *
 * The endpoint, the tools it publishes, and the configuration an assistant
 * needs. The same information an MCP client shows when it connects.
 */
export const McpPage = () => {
  const [providers, setProviders] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { providers: list } = await api.models();
        setProviders(list);
      } catch {
        /* the page still renders without them */
      }
    })();
  }, []);

  const origin = window.location.origin;
  const config = JSON.stringify(
    {
      mcpServers: {
        modeldeck: {
          type: "http",
          url: `${origin}/api/mcp`,
          headers: { Authorization: "Bearer <your token>" },
        },
      },
    },
    null,
    2,
  );

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const tools = [
    {
      name: "list_models",
      line: "Every model, its task and what it costs.",
    },
    {
      name: "list_avatars",
      line: "Your characters, with their reference images.",
    },
    {
      name: "generate",
      line: "Start a generation. Returns a job id.",
    },
    { name: "job_status", line: "The state and output of a job." },
    { name: "credit_balance", line: "How much is left to spend." },
  ];

  return (
    <main className="page">
      <span className="eyebrow">MCP & CLI</span>
      <h1 style={{ marginTop: 12 }}>Drive ModelDeck from any assistant</h1>
      <p className="muted">
        One HTTP endpoint speaking the Model Context Protocol. Point Claude,
        Cursor, or any MCP client at it and ask for stills and clips from the
        chat you already use.
      </p>

      <h2 style={{ marginTop: 30 }}>Tools</h2>
      <div className="cards">
        {tools.map((tool) => (
          <article key={tool.name} className="card">
            <div className="body">
              <strong>{tool.name}</strong>
              <span className="muted small">{tool.line}</span>
            </div>
          </article>
        ))}
      </div>

      <h2 style={{ marginTop: 30 }}>Endpoint</h2>
      <div className="card">
        <code className="code">{origin}/api/mcp</code>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="outline sm"
            onClick={() => void copy("endpoint", `${origin}/api/mcp`)}
          >
            {copied === "endpoint" ? "Copied" : "Copy endpoint"}
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 30 }}>Configuration</h2>
      <div className="card">
        <pre className="code">{config}</pre>
        <div className="row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="outline sm"
            onClick={() => void copy("config", config)}
          >
            {copied === "config" ? "Copied" : "Copy configuration"}
          </button>
        </div>
      </div>

      <h2 style={{ marginTop: 30 }}>Providers on this host</h2>
      <div className="row">
        {Object.entries(providers).map(([id, ready]) => (
          <span key={id} className={ready ? "chip ok" : "chip off"}>
            {id}: {ready ? "configured" : "no key on this host"}
          </span>
        ))}
      </div>
    </main>
  );
};
