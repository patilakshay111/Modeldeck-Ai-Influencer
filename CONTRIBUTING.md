# Contributing to ModelDeck

Thanks for wanting to contribute! ModelDeck is an open-source AI model studio:
one prompt bar across image, video and upscaling models, with reusable
characters, a node-graph canvas, and an MCP endpoint so an assistant can drive
it.

This is a community-driven project. All contributions are welcome — bug fixes,
new models, new features, documentation, translations, and more.

---

## How we work

- **Issues** — Report bugs, request features, or ask questions in GitHub Issues.
- **Pull requests** — Fork the repo, make your changes, and open a PR against
  `main`.
- **Code review** — Every PR is reviewed by at least one maintainer before
  merging.
- **Discussion** — Use GitHub Discussions for general questions and ideas.

---

## Getting started

### Prerequisites

- Node.js 22.19+, 24.11+ or 26+
- A [fal.ai](https://fal.ai/dashboard/keys) API key (most models run through
  fal.ai)
- An [OpenAI](https://platform.openai.com/api-keys) API key (Sora only)

### Running locally

```powershell
# Clone the repo
git clone https://github.com/patilakshay111/Modeldeck-Ai-Influencer.git
cd Modeldeck-Ai-Influencer

# Backend
cd backend
copy .env.example .env
# Edit .env and add your FAL_KEY (and OPENAI_API_KEY if you want Sora)
npm install
npm run dev   # http://127.0.0.1:8787

# Frontend (new terminal)
cd ../frontend
npm install
npm run dev   # http://127.0.0.1:5173
```

On Windows, you can also double-click `start-modeldeck.bat` at the repo root.

### Verifying your changes

```powershell
cd backend
npm run typecheck
npm test

cd ../frontend
npm run typecheck
npm run build
```

---

## What to work on

Good first issues are labeled `good first issue`. Areas that always need help:

- **New models** — Add an entry to `backend/src/models/registry.ts` (provider,
  upstream id, price, `buildInput`).
- **Provider adapters** — `backend/src/providers/` (fal.ai, OpenAI, WaveSpeed).
- **Frontend components** — `frontend/src/components/` and `frontend/src/pages/`.
- **Canvas** — Node-graph editor in `frontend/src/components/CanvasEditor.tsx`.
- **Agent** — Plan/approve/run pipeline in `backend/src/agent/`.
- **Docs** — `docs/` (API contract, model registry, feature map, assets).
- **Tests** — `backend/test/` and smoke checks in `backend/scripts/`.

---

## Pull request guidelines

1. **Create an issue first** (unless it's a typo or tiny fix) so we can discuss
   the approach.
2. **Fork and branch** — `git checkout -b your-name/feature-description`
3. **Keep it focused** — One PR, one change. Don't bundle unrelated fixes.
4. **Typecheck and test** — Run `npm run typecheck` and `npm test` in both
   backend and frontend.
5. **Update docs** — If your change affects users or developers, update the
   relevant `docs/` file and this README if needed.
6. **Describe your PR** — What it does, why, and how to test it.

### Commit style

We use conventional commits:

```
feat: add fal.ai Seedream 4.5 model
fix: prevent crash on old characters without kit data
docs: update model registry with new prices
```

---

## Code of conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

---

## License

By contributing, you agree that your contributions will be licensed under the
[MIT License](LICENSE).
