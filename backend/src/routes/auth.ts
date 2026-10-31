/**
 * Authentication routes.
 *
 *   POST /api/auth/register    { email, password, name }
 *   POST /api/auth/login       { email, password }
 *   GET  /api/auth/me
 *   POST /api/auth/logout
 *   POST /api/users/age-check  { confirmed }
 *
 * The session token is a short-lived JWT. The account must pass the age
 * attestation before any generation route will accept it.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context.js";
import { issueToken, verifyToken } from "../auth/token.js";
import { publicUser, verifyPassword, type User } from "../auth/users.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(200),
  name: z.string().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const ageCheckSchema = z.object({ confirmed: z.literal(true) });

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

/** Attach `request.user` when a valid bearer token is present. */
export const authenticate = (
  context: AppContext,
  request: FastifyRequest,
  reply: FastifyReply,
  done: (error?: Error) => void,
): void => {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    done();
    return;
  }
  const token = header.slice("Bearer ".length).trim();
  const verified = verifyToken(token, context.config.JWT_SECRET);
  if (!verified.ok) {
    done();
    return;
  }
  const user = context.users.findById(verified.claims.sub);
  if (!user) {
    done();
    return;
  }
  (request as FastifyRequest & { user?: unknown }).user = user;
  void reply;
  done();
};

/** Require a signed-in user. Replies 401 and returns undefined when absent. */
export const requireUser = (
  request: FastifyRequest,
  reply: FastifyReply,
): User | undefined => {
  const user = (request as FastifyRequest & { user?: unknown }).user as
    | User
    | undefined;
  if (!user) {
    void reply.code(401).send({ error: "unauthorized", message: "Sign in required." });
  }
  return user;
};

export const registerAuthRoutes = (
  app: FastifyInstance,
  context: AppContext,
): void => {
  const issue = (userId: string): string => {
    const now = Math.floor(Date.now() / 1000);
    return issueToken(
      { sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS },
      context.config.JWT_SECRET,
    );
  };

  app.post("/api/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: "invalid_input", message: parsed.error.issues[0]?.message });
    }
    try {
      const user = await context.users.create(parsed.data);
      return reply.code(201).send({ token: issue(user.id), user: publicUser(user) });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Registration failed.";
      const conflict = message.includes("already exists");
      return reply
        .code(conflict ? 409 : 400)
        .send({ error: conflict ? "conflict" : "invalid_input", message });
    }
  });

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid_input", message: "Invalid credentials." });
    }
    const user = context.users.findByEmail(parsed.data.email);
    const ok = user
      ? await verifyPassword(parsed.data.password, user.passwordHash)
      : false;
    if (!user || !ok) {
      return reply
        .code(401)
        .send({ error: "unauthorized", message: "Invalid credentials." });
    }
    return reply.send({ token: issue(user.id), user: publicUser(user) });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    return reply.send({ user: publicUser(user) });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    // Tokens are stateless and short-lived. The client drops the token; the
    // endpoint exists so a client has one place to call.
    void requireUser(request, reply);
    return reply.send({ ok: true });
  });

  app.post("/api/users/age-check", async (request, reply) => {
    const user = requireUser(request, reply);
    if (!user) return reply;
    const parsed = ageCheckSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "invalid_input",
        message: "An explicit age confirmation is required.",
      });
    }
    const updated = context.users.update(user.id, { ageAttestedAt: Date.now() });
    return reply.send({ user: updated ? publicUser(updated) : publicUser(user) });
  });
};
