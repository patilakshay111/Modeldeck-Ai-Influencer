/**
 * Terms and privacy.
 *
 * One page, two documents. These are placeholders with the structure filled
 * in — they are not legal advice, and they are not a substitute for having
 * a lawyer write them for your jurisdiction and your business.
 */
const TERMS = `
<h3>Who you are</h3>
<p>You need an account. You are responsible for what is made with it, and for
keeping your token to yourself.</p>

<h3>What you may make</h3>
<p>You may generate images, video and upscaled media using the models this
service exposes. You may not generate anything that depicts a real person
without that person's consent, anything that depicts a minor, or anything
that is unlawful where you are.</p>

<h3>Your character likenesses</h3>
<p>A character is a likeness reference. You confirm that you have the right to
use the face you upload and the likeness you create. Do not train a character
on a real person's likeness without their consent.</p>

<h3>Credits</h3>
<p>Credits are a unit of this service. A credit balance is spent when a
generation starts, at the price shown for that model. The price reflects the
model provider's cost. Credits are not money, carry no cash value, and cannot
be redeemed for cash.</p>

<h3>Acceptable use</h3>
<p>No unlawful content, no non-consensual intimate imagery, no content that
harms a real person, no attempts to circumvent the model providers' own terms,
and no automated abuse of the service.</p>

<h3>Availability</h3>
<p>The service depends on third-party model providers. Their outages, rate
limits and changes affect what you can run and when. A generation that fails
may still have consumed a credit; ask for a refund if it did.</p>
`;

const PRIVACY = `
<h3>What is stored</h3>
<p>Your account (email, display name, a salted password hash), your credit
balance, your characters (a handle, a name, a reference image URL), your
canvases, and the metadata of your generations.</p>

<h3>What is sent to model providers</h3>
<p>When you generate, your prompt and any reference images are sent to the
provider that serves that model — fal.ai or OpenAI — and are subject to that
provider's privacy policy. This service does not keep a copy of the media a
provider returns; finished media is copied into this service's own storage so
it stays reachable.</p>

<h3>What is not collected</h3>
<p>No advertising pixels, no affiliate tracking, and no third-party analytics.
The service does not build an advertising profile of you.</p>

<h3>Removal</h3>
<p>Ask and your account and everything on it is deleted: characters, canvases,
library entries and the stored media.</p>
`;

export const LegalPage = ({ kind }: { kind: "terms" | "privacy" }) => (
  <main className="page legal">
    <span className="eyebrow">{kind === "terms" ? "Terms" : "Privacy"}</span>
    <h1 style={{ marginTop: 12 }}>
      {kind === "terms" ? "Terms of use" : "Privacy"}
    </h1>
    <p className="muted">
      {kind === "terms"
        ? "The rules for using this service."
        : "What this service stores, and what it sends elsewhere."}
    </p>
    <div
      className="card legal-body"
      dangerouslySetInnerHTML={{
        __html: kind === "terms" ? TERMS : PRIVACY,
      }}
    />
  </main>
);
