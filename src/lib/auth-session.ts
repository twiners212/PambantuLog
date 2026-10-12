import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "pambantulog_session";

export interface SessionPayload {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "agent" | "karyawan";
  department?: string | null;
}

/**
 * Standard cookie options for security
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60, // 7 days
};

/**
 * Encodes session payload to cookie value
 */
export function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decodes session payload from cookie value
 */
export function decodeSession(cookieValue: string): SessionPayload | null {
  try {
    const json = Buffer.from(cookieValue, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed.id === "string" && typeof parsed.role === "string") {
      return parsed as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Sets session cookie on Next.js NextResponse object
 */
export function setSessionCookie(
  response: NextResponse,
  payload: SessionPayload
): NextResponse {
  response.cookies.set(
    SESSION_COOKIE_NAME,
    encodeSession(payload),
    SESSION_COOKIE_OPTIONS
  );
  return response;
}

/**
 * Clears session cookie on Next.js NextResponse object
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

/**
 * Reads session payload from server-side headers/cookies
 */
export async function getServerSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) return null;
    return decodeSession(cookie.value);
  } catch {
    return null;
  }
}
