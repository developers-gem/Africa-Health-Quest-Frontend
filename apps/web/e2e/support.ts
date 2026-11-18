import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const here = dirname(fileURLToPath(import.meta.url));

/** One database and mail folder per test run (set once in the main process, inherited by workers). */
process.env.E2E_RUN_ID ??= String(Date.now());
export const MAIL_DIR = resolve(here, `../test-results/mail-${process.env.E2E_RUN_ID}`);
export const BACKEND_ENV: Record<string, string> = {
  MONGODB_URI:
    process.env.MONGODB_URI ??
    `mongodb://127.0.0.1:27017/ahq_e2e_${process.env.E2E_RUN_ID}?directConnection=true`,
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "e2e-only-secret-e2e-only-secret-123456",
  DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  WEB_APP_URL: "http://localhost:5173",
  LOG_LEVEL: "warn",
  MAIL_TRANSPORT: "file",
  MAIL_FILE_DIR: MAIL_DIR,
  AI_PROVIDER: "fake",
  // Pinned so a developer's local apps/backend/.env (loaded by the dev server) can't weaken the run.
  MFA_REQUIRED_FOR_STAFF: "true",
  NODE_ENV: "development",
  RATE_LIMIT_AUTH_MAX: "10000",
  RATE_LIMIT_API_MAX: "100000",
  MEDIA_STORAGE_DIR: resolve(here, `../test-results/media-${process.env.E2E_RUN_ID}`),
};
export const PASSWORD = "healthy-nation-1";

/** Latest emailed token (verify-email / reset-password) sent to an address. */
export async function mailToken(to: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    if (existsSync(MAIL_DIR)) {
      const mails = readdirSync(MAIL_DIR)
        .sort()
        .map(
          (f) =>
            JSON.parse(readFileSync(join(MAIL_DIR, f), "utf8")) as { to: string; text: string },
        )
        .filter((m) => m.to === to);
      const token = mails.at(-1)?.text.match(/token=([\w-]+)/)?.[1];
      if (token) return token;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`No mail for ${to}`);
}

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret — what an authenticator app does. */
export function totp(secret: string, offsetSteps = 0) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase())
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

/** Bootstraps an administrator with the real CLI script (there is no UI for the first admin by design). */
export function grantAdmin(email: string) {
  execFileSync("npm", ["run", "admin:grant", "-w", "@ahq/backend", "--", email], {
    cwd: resolve(here, "../../.."),
    env: { ...process.env, ...BACKEND_ENV },
    stdio: "pipe",
  });
}

export async function registerAndVerify(page: Page, email: string, displayName: string) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto(`/verify-email?token=${await mailToken(email)}`);
  await expect(page.getByText("Your email is confirmed.")).toBeVisible();
}

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Completes the staff two-factor setup gate; returns the secret for later challenges. */
export async function setUpMfa(page: Page) {
  await expect(page.getByText("Set up two-factor authentication")).toBeVisible();
  await page.getByText("Can't scan? Enter the key manually").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel("6-digit code").fill(totp(secret));
  await page.getByRole("button", { name: "Verify and turn on" }).click();
  await expect(page.getByTestId("recovery-codes")).toBeVisible();
  await page.getByRole("button", { name: "I've saved them — continue" }).click();
  return secret;
}
