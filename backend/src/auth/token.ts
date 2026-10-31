/**
 * Session tokens.
 *
 * A compact HS256 JWT signed with HMAC-SHA256 from `node:crypto`. Keeping it
 * in-tree avoids a dependency and keeps the token format auditable in one
 * file.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface TokenClaims {
  /** User id. */
  sub: string;
  /** Issued-at, seconds since the epoch. */
  iat: number;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

const base64Url = (value: Buffer | string): string =>
  Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const fromBase64Url = (value: string): Buffer =>
  Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");

const sign = (data: string, secret: string): string =>
  base64Url(createHmac("sha256", secret).update(data).digest());

export const issueToken = (
  claims: TokenClaims,
  secret: string,
): string => {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify(claims));
  const body = `${header}.${payload}`;
  return `${body}.${sign(body, secret)}`;
};

export type VerifyResult =
  | { ok: true; claims: TokenClaims }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

export const verifyToken = (
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifyResult => {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "malformed" };
  const [header, payload, signature] = parts;
  if (!header || !payload || !signature) {
    return { ok: false, reason: "malformed" };
  }
  const expected = sign(`${header}.${payload}`, secret);
  const provided = Buffer.from(signature);
  const computed = Buffer.from(expected);
  if (
    provided.length !== computed.length ||
    !timingSafeEqual(provided, computed)
  ) {
    return { ok: false, reason: "bad-signature" };
  }
  let claims: TokenClaims;
  try {
    claims = JSON.parse(fromBase64Url(payload).toString("utf8")) as TokenClaims;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof claims.sub !== "string" ||
    typeof claims.exp !== "number" ||
    typeof claims.iat !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }
  if (claims.exp <= nowSeconds) return { ok: false, reason: "expired" };
  return { ok: true, claims };
};
