/**
 * User accounts.
 *
 * Accounts live in a JSON file so a fresh checkout runs with no external
 * service. Passwords are stored as a salted scrypt hash; the plaintext is
 * never written and never logged.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export interface User {
  id: string;
  email: string;
  name: string;
  /** `scrypt$<saltHex>$<hashHex>` */
  passwordHash: string;
  createdAt: number;
  /** Millicredits available to spend. */
  balanceMillicredits: number;
  /** Whether the account passed the age attestation. */
  ageAttestedAt: number | null;
}

export type PublicUser = Omit<User, "passwordHash">;

interface UserFile {
  version: 1;
  users: User[];
}

const KEY_LENGTH = 64;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
};

export const verifyPassword = async (
  password: string,
  stored: string,
): Promise<boolean> => {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
};

export class UserStore {
  private readonly path: string;
  private file: UserFile;

  constructor(path: string) {
    this.path = path;
    try {
      this.file = JSON.parse(readFileSync(path, "utf8")) as UserFile;
    } catch {
      this.file = { version: 1, users: [] };
    }
    if (!Array.isArray(this.file.users)) this.file.users = [];
  }

  private persist(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(this.file, null, 1), "utf8");
  }

  findByEmail(email: string): User | undefined {
    const needle = email.trim().toLowerCase();
    return this.file.users.find((user) => user.email === needle);
  }

  findById(id: string): User | undefined {
    return this.file.users.find((user) => user.id === id);
  }

  async create(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const email = input.email.trim().toLowerCase();
    if (this.findByEmail(email)) {
      throw new Error("An account with that email already exists.");
    }
    const user: User = {
      id: `usr_${randomBytes(12).toString("hex")}`,
      email,
      name: input.name?.trim() || email.split("@")[0] || "user",
      passwordHash: await hashPassword(input.password),
      createdAt: Date.now(),
      // 500 credits. At the default multipliers that is about 60 image
      // generations or a few video clips of real provider spend.
      balanceMillicredits: 500_000,
      ageAttestedAt: null,
    };
    this.file.users.push(user);
    this.persist();
    return user;
  }

  update(id: string, patch: Partial<User>): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;
    Object.assign(user, patch);
    this.persist();
    return user;
  }

  addBalance(id: string, deltaMillicredits: number): User | undefined {
    const user = this.findById(id);
    if (!user) return undefined;
    user.balanceMillicredits = Math.max(
      0,
      user.balanceMillicredits + deltaMillicredits,
    );
    this.persist();
    return user;
  }
}

export const publicUser = (user: User): PublicUser => {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
};
