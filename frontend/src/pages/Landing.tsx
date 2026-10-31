import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ARC_IMAGE_HOST, ARC_LOOKS, PRODUCT } from "../config";
import { FeatureCarousel } from "../components/FeatureCarousel";

/**
 * The landing page.
 *
 * The hero's arc of looks follows this layout: the
 * focused card is centred and full size, its neighbours step away and shrink,
 * and the arc rotates around a large radius.
 */
const ARC_RADIUS = 1500;
const ARC_STEP_DEG = 10.5;
/** Cards further out than this are hidden, as the reference does. */
const ARC_VISIBLE = 3;

const arcPlace = (index: number, current: number) => {
  const count = ARC_LOOKS.length;
  let offset = current - index;
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;
  const away = Math.abs(offset);
  const angle = (offset * ARC_STEP_DEG * Math.PI) / 180;
  return {
    x: (Math.sin(angle) * ARC_RADIUS) / 7,
    y: ((Math.cos(angle) - 1) * ARC_RADIUS) / 14,
    scale: away === 0 ? 1 : away === 1 ? 0.82 : away === 2 ? 0.7 : 0.6,
    offset,
    opacity:
      away > ARC_VISIBLE
        ? 0
        : away === 0
          ? 1
          : away === 1
            ? 0.95
            : away === 2
              ? 0.8
              : 0.6,
    z: 100 - away,
  };
};



const STEPS = [
  {
    n: "01",
    title: "Pick a character",
    line: "Claim a ready-made look, or bring your own face.",
  },
  {
    n: "02",
    title: "Describe the shot",
    line: "Name them with @ in the prompt to keep the face locked.",
  },
  {
    n: "03",
    title: "Generate",
    line: "Image, video and upscale, behind one prompt bar.",
  },
];

const FAQ = [
  {
    q: "How much does a generation cost?",
    a: "What the model provider charges. There is no subscription and no credit pack in between — the price you see is the provider's price.",
  },
  {
    q: "Can I use one character across models?",
    a: "Yes. A character is one reference image. Any model that takes a reference image will use it, and naming @character in a prompt attaches it automatically.",
  },
  {
    q: "What models are available?",
    a: "Image, video, upscale and image-understanding models from fal.ai and OpenAI — see the Models tab for every model and its price.",
  },
  {
    q: "Can an assistant drive it?",
    a: "Yes. There is an MCP endpoint, so Claude, Cursor or any MCP client can list models, start a generation and check the result.",
  },
];

export const Landing = () => {
  const { signIn } = useAuth();
  const [current, setCurrent] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const step = (delta: number) =>
    setCurrent(
      (value) => (value + delta + ARC_LOOKS.length) % ARC_LOOKS.length,
    );

  return (
    <div className="landing">
      <header className="landing-top">
        <span className="brand">
          <span className="mark" />
          {PRODUCT.name}
        </span>
        <div className="row">
          <Link to="/signin" className="muted small">
            Sign in
          </Link>
          <Link to="/register" className="primary button-like">
            Create account
          </Link>
        </div>
      </header>

      {/* ── Arc hero ─────────────────────────────────────────────────── */}
      <main className="hero dot-grid">
        <div className="arc" aria-hidden="true">
          {ARC_LOOKS.map((look, index) => {
            const place = arcPlace(index, current);
            return (
              <div
                key={look.file}
                className="arc-card"
                style={{
                  transform: `translate(${place.x}px, ${place.y}px) scale(${place.scale})`,
                  opacity: place.opacity,
                  zIndex: place.z,
                  background: look.accent,
                  visibility: place.opacity === 0 ? "hidden" : "visible",
                }}
              >
                <img
                  src={`${ARC_IMAGE_HOST}/${look.file}.jpg`}
                  alt={look.name}
                  decoding="async"
                  fetchPriority={index === current ? "high" : "auto"}
                />
                <span className="arc-shade" />
                <span className="arc-name">{look.name}</span>
              </div>
            );
          })}
        </div>

        <div className="row" style={{ justifyContent: "center" }}>
          <button type="button" className="outline sm" onClick={() => step(-1)}>
            ‹
          </button>
          {ARC_LOOKS.map((look, index) => (
            <button
              key={look.file}
              type="button"
              aria-label={`Show ${look.name}`}
              onClick={() => setCurrent(index)}
              style={{
                width: index === current ? 24 : 7,
                height: 7,
                padding: 0,
                borderRadius: 9,
                border: 0,
                background:
                  index === current ? "var(--pink)" : "rgba(255,255,255,.25)",
              }}
            />
          ))}
          <button type="button" className="outline sm" onClick={() => step(1)}>
            ›
          </button>
        </div>

        <span className="eyebrow" style={{ marginTop: 18 }}>
          AI Studio
        </span>
        <h1 style={{ marginTop: 14 }}>
          One studio. <span className="grad-text">Every model.</span>
        </h1>
        <p className="lead">{PRODUCT.tagline}</p>

        <div className="hero-cta">
          <Link to="/register" className="primary button-like">
            Start creating
          </Link>
          <Link to="/templates" className="outline button-like">
            Browse looks
          </Link>
        </div>

        <ul className="hero-points">
          <li>Image, video and upscale behind one prompt</li>
          <li>Save a character, reuse them everywhere</li>
          <li>Pay the model provider, nothing else</li>
          <li>Drive it from Claude or Cursor over MCP</li>
        </ul>

        <form className="hero-signin" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error ? <p className="error">{error}</p> : null}
        </form>

        <p className="muted small" style={{ marginTop: 18 }}>
          No account? <Link to="/register">Create one</Link>
        </p>
      </main>

      {/* ── Featured ─────────────────────────────────────────────────── */}
      <FeatureCarousel />

      {/* ── MCP ──────────────────────────────────────────────────────── */}
      <section className="sec">
        <div className="wrap">
          <span className="eyebrow">MCP & CLI</span>
          <h2 style={{ marginTop: 14 }}>
            Make videos without opening <span className="grad-text">ModelDeck.</span>
          </h2>
          <p className="lead">
            ModelDeck speaks the Model Context Protocol. Point Claude, Cursor or
            any MCP client at it and ask for stills and clips from the chat you
            already use.
          </p>
          <div className="hero-cta" style={{ justifyContent: "flex-start" }}>
            <Link to="/mcp" className="primary button-like">
              Set it up
            </Link>
            <Link to="/courses" className="outline button-like">
              Read the guide
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────── */}
      <section className="sec">
        <div className="wrap">
          <div style={{ textAlign: "center" }}>
            <span className="eyebrow">How it works</span>
            <h2 style={{ marginTop: 14 }}>
              From idea to <span className="grad-text">clip.</span>
            </h2>
          </div>
          <div className="steps">
            {STEPS.map((stepItem) => (
              <div key={stepItem.n} className="step">
                <span className="step-n">{stepItem.n}</span>
                <h3>{stepItem.title}</h3>
                <p className="muted">{stepItem.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tools ────────────────────────────────────────────────────── */}
      <section className="sec">
        <div className="wrap">
          <div style={{ textAlign: "center" }}>
            <span className="eyebrow">Everything in one place</span>
            <h2 style={{ marginTop: 14 }}>
              One studio. <span className="grad-text">Every tool.</span>
            </h2>
          </div>
          <div className="tool-grid">
            {[
              { to: "/studio", title: "Image", line: "Text to image and image to image." },
              { to: "/video", title: "Video", line: "Still to video, with audio." },
              { to: "/upscale", title: "Upscale", line: "Topaz and SeedVR for stills and clips." },
              { to: "/characters", title: "Influencers", line: "Your cast, reusable everywhere." },
              { to: "/templates", title: "Marketplace", line: "Ready-made looks to claim." },
              { to: "/canvas", title: "Canvas", line: "Chain nodes on one board." },
              { to: "/agent", title: "Agent", line: "Ask for stills and clips in chat." },
              { to: "/mcp", title: "MCP & CLI", line: "Drive it from any assistant." },
            ].map((tool) => (
              <Link key={tool.to} to={tool.to} className="tool">
                <h3>{tool.title}</h3>
                <p className="muted small">{tool.line}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────── */}
      <section className="sec pricing">
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Pricing</span>
          <h2 style={{ marginTop: 14 }}>
            Pay for the model. <span className="grad-text">Nothing else.</span>
          </h2>
          <p className="lead" style={{ margin: "0 auto" }}>
            No subscription, no credit pack, no markup on the provider's
            price. Every model in the catalogue shows what it costs.
          </p>
          <div className="hero-cta" style={{ justifyContent: "center" }}>
            <Link to="/models" className="primary button-like">
              See every model's price
            </Link>
            <Link to="/register" className="outline button-like">
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div style={{ textAlign: "center" }}>
            <span className="eyebrow">Questions</span>
            <h2 style={{ marginTop: 14 }}>Things people ask</h2>
          </div>
          <div className="faq">
            {FAQ.map((item, index) => (
              <div key={item.q} className="faq-item">
                <button
                  type="button"
                  className="faq-q"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  {item.q}
                  <span>{openFaq === index ? "−" : "+"}</span>
                </button>
                {openFaq === index ? (
                  <p className="muted faq-a">{item.a}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="landing-foot">
        <span className="brand">
          <span className="mark" />
          {PRODUCT.name}
        </span>
        <div className="row">
          <Link to="/terms" className="muted small">
            Terms
          </Link>
          <Link to="/privacy" className="muted small">
            Privacy
          </Link>
          <Link to="/mcp" className="muted small">
            MCP
          </Link>
        </div>
      </footer>
    </div>
  );
};
