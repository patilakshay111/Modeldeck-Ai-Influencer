# Assets

All assets in ModelDeck are local — nothing is borrowed from any other application.

## What is local

| Asset | Where it is used | Source |
|---|---|---|
| 98 character look images | `backend/data/character-templates.json` | `frontend/public/assets/influencers/*.svg` |
| 18 landing hero images | `frontend/src/config.ts` → `ARC_LOOKS` | `frontend/public/assets/looks/*.jpg` |

Everything else — the design system, the components, the layout, the canvas,
the studio — is written for this project.

## Character looks

`backend/data/character-templates.json` is data, not code:

```json
{
  "version": 1,
  "count": 98,
  "templates": [
    { "id": "tpl_001", "label": "Ava", "handle": "ava", "src": "/assets/influencers/ava.svg" }
  ]
}
```

Point `src` at your own images. Keep `id` and `handle` stable if you want
existing characters to keep working — a claimed character stores the image URL
it was given, so changing the template does not change characters already
claimed.

To generate your own set, render them with the models this service already
calls: pick a model, generate a portrait, save it into your public assets, and
write the list.

## Landing hero

`frontend/src/config.ts`:

```ts
export const ARC_IMAGE_HOST = "/assets/looks";
export const ARC_LOOKS = [
  { file: "ava", name: "Ava", accent: "rgba(170,40,90,.55)" },
  // ...
];
```

Replace the SVG files with your own images before serving to real users.

---

## Third-party models

The model names in the catalogue are the model providers' trademarks
(Sora, Kling, Veo, FLUX, Seedream, Nano Banana, Wan, Hailuo, PixVerse, Topaz,
SeedVR, LTX, Bagel, Z-Image, Qwen). They are used here to name the models
this service calls, which is nominative use. Their logos are **not**
reproduced; the catalogue shows the name and the price only.
