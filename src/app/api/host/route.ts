import { fail, isHost, json } from "@/lib/server";

/** Checks the host PIN so the host page can unlock. */
export async function POST(req: Request) {
  if (!process.env.HOST_PIN) return fail("Set HOST_PIN in your environment to use the host page.", 503);
  return isHost(req) ? json({ ok: true }) : fail("Wrong PIN.", 401);
}
