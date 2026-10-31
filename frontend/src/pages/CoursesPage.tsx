import { Link } from "react-router-dom";

/**
 * Courses.
 *
 * Short guides, one per thing you can do. Each one is a route plus a few
 * sentences, because the studio explains itself.
 */
const GUIDES = [
  {
    to: "/studio",
    title: "Your first image",
    body: "Pick a model, describe what you want, press Generate. The result lands in your library.",
  },
  {
    to: "/templates",
    title: "Claim a ready-made look",
    body: "The Templates tab holds 98 characters. Claim one and it becomes yours, with its handle and its reference image.",
  },
  {
    to: "/avatar",
    title: "Build your own avatar",
    body: "Upload one face, give it a handle. Then type @handle in any prompt and the face travels with the request.",
  },
  {
    to: "/canvas",
    title: "Chain nodes on a canvas",
    body: "A canvas is a graph. Wire one node's output into the next and it becomes the next node's reference image.",
  },
  {
    to: "/video",
    title: "Still to video",
    body: "The Video tab takes an image and a prompt and returns a clip. Reference images keep the character consistent.",
  },
  {
    to: "/upscale",
    title: "Upscale a result",
    body: "Topaz and SeedVR, for stills and for clips, at the cost the provider charges.",
  },
  {
    to: "/agent",
    title: "Ask instead of click",
    body: "The Agent tab runs the same MCP endpoint an external assistant uses. Describe the shot; it does the rest.",
  },
  {
    to: "/mcp",
    title: "Connect Claude or Cursor",
    body: "One HTTP endpoint and one bearer token. Copy the configuration and paste it into your client.",
  },
];

export const CoursesPage = () => {
  return (
    <main className="page">
      <span className="eyebrow">Courses</span>
      <h1 style={{ marginTop: 12 }}>Guides</h1>
      <p className="muted">
        One guide per thing you can do. Each one takes you to the place it
        happens.
      </p>

      <div className="cards" style={{ marginTop: 20 }}>
        {GUIDES.map((guide) => (
          <article key={guide.to} className="card">
            <div className="body">
              <strong>{guide.title}</strong>
              <span className="muted small">{guide.body}</span>
              <Link to={guide.to} className="muted small">
                Open →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
};
