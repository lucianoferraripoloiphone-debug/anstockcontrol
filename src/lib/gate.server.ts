import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateSession = { unlocked?: boolean };

function config() {
  return {
    password: process.env["SESSION_SECRET"]!,
    name: "an-stock-gate",
    maxAge: 60 * 60 * 8,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export async function getGateSession() {
  return useSession<GateSession>(config());
}

export async function isUnlocked(): Promise<boolean> {
  const session = await getGateSession();
  return session.data.unlocked === true;
}

export async function requireUnlocked() {
  if (!(await isUnlocked())) {
    throw new Error("Admin access required. Unlock with the password first.");
  }
}

export function passwordMatches(input: string, expected: string): boolean {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
