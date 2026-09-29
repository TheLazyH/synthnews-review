import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "review_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type Session = {
  sub: string;
  name: string;
  email: string;
  admin: boolean;
};

const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export async function signToken(s: Session): Promise<string> {
  return new SignJWT({ name: s.name, email: s.email, admin: s.admin })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function readToken(token?: string): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      admin: Boolean(payload.admin),
    };
  } catch {
    return null;
  }
}
