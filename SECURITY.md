# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in
ModelDeck, please report it responsibly.

### How to report

Send details to **opensource@modeldeck.example** with:

- A clear description of the vulnerability
- Steps to reproduce it
- The affected version(s) and component(s)
- Any suggested fix or mitigation

### What to expect

- We will acknowledge your report within **3 business days**.
- We will keep you informed of our progress toward a fix.
- We will credit you in our release notes (unless you prefer to remain
  anonymous).

## Responsible disclosure

Please do not publicly disclose a vulnerability until we have had a reasonable
time to investigate and patch it. We will work with you on a coordinated
disclosure timeline.

## Security best practices for operators

If you are self-hosting ModelDeck:

- Never commit `.env` files — they contain your provider API keys and JWT secret.
- Use a strong, randomly generated `JWT_SECRET` (at least 16 characters).
- Keep `FAL_KEY` and `OPENAI_API_KEY` out of your frontend code; they belong in
  the backend `.env` only.
- In production, set `PUBLIC_ORIGIN`, `CORS_ORIGINS`, and serve media over HTTPS.
- Enable the age gate and content moderation hooks before serving real users
  (see `docs/FEATURE-MAP.md`).
