import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sql } from "@/lib/db";
import { createSession } from "@/lib/session";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  const rows = await sql`
    SELECT id, name, email, password_hash, is_admin, active, locked_until
    FROM reviewers WHERE email = ${email}
  `;
  const user = rows[0];
  if (!user || !user.active) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return NextResponse.json({ error: "locked" }, { status: 429 });
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    await sql`
      UPDATE reviewers
      SET failed_logins = failed_logins + 1,
          locked_until = CASE
            WHEN failed_logins + 1 >= ${MAX_FAILS}
            THEN now() + make_interval(mins => ${LOCK_MINUTES})
            ELSE locked_until END
      WHERE id = ${user.id}
    `;
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await sql`UPDATE reviewers SET failed_logins = 0, locked_until = NULL WHERE id = ${user.id}`;
  await createSession({
    sub: user.id,
    name: user.name,
    email: user.email,
    admin: user.is_admin,
  });
  return NextResponse.json({ ok: true });
}
