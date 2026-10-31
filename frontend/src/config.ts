/**
 * Frontend configuration.
 *
 * The product name lives here so it can be changed in one place. The API base
 * is relative in development, where Vite proxies `/api` to the backend.
 */

export const PRODUCT = {
  name: "ModelDeck",
  tagline: "AI model studio — image, video and upscale, with consistent characters.",
} as const;

/**
 * The landing hero's arc of looks.
 *
 * Image paths are served from your own public assets. Point ARC_IMAGE_HOST
 * at your own CDN or static host before serving to real users — see docs/ASSETS.md.
 */
export interface ArcLook {
  /** Path under the image host. */
  file: string;
  name: string;
  /** Card accent colour. */
  accent: string;
}

export const ARC_IMAGE_HOST = "/assets/looks";

export const ARC_LOOKS: readonly ArcLook[] = [
  { file: "sfw/noa", name: "Opal", accent: "rgba(170,40,90,.55)" },
  { file: "sfw/f01", name: "Rhea", accent: "rgba(130,60,220,.55)" },
  { file: "sfw/skye", name: "Skye", accent: "rgba(255,110,170,.5)" },
  { file: "sfw/f04", name: "Liora", accent: "rgba(220,90,40,.5)" },
  { file: "sfw/lily", name: "Nyla", accent: "rgba(200,150,90,.45)" },
  { file: "sfw/f02", name: "Orla", accent: "rgba(255,45,138,.5)" },
  { file: "sfw/f07", name: "Astrid", accent: "rgba(30,150,110,.45)" },
  { file: "sfw/maya", name: "Selene", accent: "rgba(255,140,60,.45)" },
  { file: "sfw/f16", name: "Ines", accent: "rgba(170,40,90,.55)" },
  { file: "sfw/arc-lyra", name: "Lyra", accent: "rgba(130,60,220,.55)" },
  { file: "sfw/reese", name: "Reese", accent: "rgba(255,110,170,.5)" },
  { file: "sfw/arc-brynn", name: "Brynn", accent: "rgba(220,90,40,.5)" },
  { file: "sfw/f15", name: "Paloma", accent: "rgba(200,150,90,.45)" },
  { file: "sfw/lena", name: "Sienna", accent: "rgba(255,45,138,.5)" },
  { file: "sfw/ava", name: "Mila", accent: "rgba(30,150,110,.45)" },
  { file: "sfw/iris", name: "Cora", accent: "rgba(255,140,60,.45)" },
  { file: "sfw/luna", name: "Eden", accent: "rgba(170,40,90,.55)" },
  { file: "sfw/f08", name: "Yara", accent: "rgba(130,60,220,.55)" },
];

/** Where a reference image is uploaded from the browser. */
export const UPLOAD_ENDPOINT = "/api/studio/uploads";

