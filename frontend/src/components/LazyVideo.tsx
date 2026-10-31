import { memo, useEffect, useRef, useState } from "react";

/**
 * A Cloudflare Stream video that only loads when it nears the viewport.
 *
 * The embed is an iframe with autoplay, loop and no controls; the poster is
 * served from the same video host so the first paint is cheap. Priority
 * videos load immediately.
 */
export const LazyVideo = memo(function LazyVideo({
  videoId,
  className = "",
  priority = false,
  thumbnailTime = "1s",
  rootMargin = "200px",
}: {
  videoId: string;
  className?: string;
  priority?: boolean;
  thumbnailTime?: string;
  rootMargin?: string;
}) {
  const [visible, setVisible] = useState(priority);
  const [loaded, setLoaded] = useState(false);
  const container = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (priority) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    if (container.current) observer.observe(container.current);
    return () => {
      if (container.current) observer.unobserve(container.current);
    };
  }, [priority, rootMargin]);

  const thumbnailUrl = `https://videodelivery.net/${videoId}/thumbnails/thumbnail.jpg?time=${thumbnailTime}`;
  const iframeUrl = priority
    ? `https://iframe.cloudflarestream.com/${videoId}?muted=true&autoplay=true&loop=true&controls=false&preload=true&poster=${encodeURIComponent(thumbnailUrl)}`
    : `https://iframe.cloudflarestream.com/${videoId}?muted=true&autoplay=true&loop=true&controls=false&preload=true`;

  return (
    <div
      ref={container}
      className={`lazy-video ${className}`}
      style={{
        aspectRatio: "16 / 9",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        background: `url(${thumbnailUrl}) center/cover no-repeat`,
        position: "relative",
      }}
    >
      {visible ? (
        <iframe
          title={`video ${videoId}`}
          src={iframeUrl}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
            opacity: loaded ? 1 : 0,
            transition: "opacity .4s ease",
          }}
        />
      ) : null}
    </div>
  );
});
