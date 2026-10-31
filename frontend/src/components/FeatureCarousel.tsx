import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * The landing's featured cards.
 *
 * Each card is a muted, looping video with a title and a line under it. The
 * cards scroll horizontally; the arrows and the dot row move with them.
 */

interface FeatureCard {
  title: string;
  line: string;
  /** A single video. */
  video?: string;
  /** A trio of clips, shown side by side. */
  trio?: string[];
  poster?: string;
  href: string;
}

const FEATURES: FeatureCard[] = [
  {
    title: "Create your AI influencer",
    line: "Chain a face, a still, and a clip on one board.",
    href: "/studio",
  },
  {
    title: "Marketplace",
    line: "Ready-made AI influencers.",
    href: "/templates",
  },
  {
    title: "ModelDeck agent",
    line: "Ask for stills and clips in chat.",
    href: "/studio",
  },
  {
    title: "ModelDeck canvas",
    line: "Moodboard, chain, and share on one board.",
    href: "/canvas",
  },
  {
    title: "Shorts studio",
    line: "Write the scene. ModelDeck returns a clip.",
    href: "/video",
  },
  {
    title: "AI video generator",
    line: "Start from a still and let the shot move.",
    href: "/video",
  },
  {
    title: "ModelDeck x ChatGPT",
    line: "Put a dance onto the model you already trained.",
    href: "/characters",
  },
  {
    title: "Claude MCP",
    line: "Ask for stills and clips from the chat you use.",
    href: "/models",
  },
];

const FeatureVideo = ({ card }: { card: FeatureCard }) => {
  if (!card.video && !card.trio) return null;
  return (
    <div className="fc-media">
      {card.trio ? (
        <div className="fc-trio">
          {card.trio.map((src) => (
            <video
              key={src}
              src={src}
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          ))}
        </div>
      ) : (
        <video
          src={card.video}
          poster={card.poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export const FeatureCarousel = () => {
  const row = useRef<HTMLDivElement | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const element = row.current;
    if (!element) return;
    setAtStart(element.scrollLeft <= 4);
    setAtEnd(
      element.scrollLeft + element.clientWidth >= element.scrollWidth - 4,
    );
  };

  useEffect(() => {
    sync();
    const element = row.current;
    if (!element) return;
    element.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      element.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  const nudge = (direction: -1 | 1) => {
    const element = row.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="fc" aria-label="Featured">
      <button
        type="button"
        className={`fc-arrow is-prev${atStart ? " is-hidden" : ""}`}
        aria-label="Previous"
        onClick={() => nudge(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className={`fc-arrow is-next${atEnd ? " is-hidden" : ""}`}
        aria-label="Next"
        onClick={() => nudge(1)}
      >
        ›
      </button>

      <div className="fc-row" ref={row}>
        {FEATURES.map((card) => (
          <article key={card.title} className="fc-card">
            <Link to={card.href} aria-label={card.title}>
              <FeatureVideo card={card} />
              <h3>{card.title}</h3>
              <p>{card.line}</p>
            </Link>
          </article>
        ))}
      </div>

      <div className="fc-start">
        <Link to="/register" className="primary button-like">
          Start now →
        </Link>
      </div>
    </section>
  );
};
