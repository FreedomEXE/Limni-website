import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "limni_session";
const SESSION_SECRET_ADMIN = "admin";
const SESSION_SECRET_VIEWER = "viewer";
const SESSION_SECRET_LEGACY = "authenticated";

export type UserRole = "admin" | "viewer";

export async function getSessionRole(): Promise<UserRole | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (session === SESSION_SECRET_ADMIN || session === SESSION_SECRET_LEGACY) {
    return "admin";
  }
  if (session === SESSION_SECRET_VIEWER) {
    return "viewer";
  }

  return null;
}

export async function isAuthenticated(): Promise<boolean> {
  const role = await getSessionRole();
  return role !== null;
}

export async function login(username: string, password: string): Promise<boolean> {
  const validUsername = process.env.AUTH_USERNAME || "admin";
  const validPassword = process.env.AUTH_PASSWORD || "password";
  const viewerUsername = process.env.AUTH_VIEWER_USERNAME;
  const viewerPassword = process.env.AUTH_VIEWER_PASSWORD;

  if (username === validUsername && password === validPassword) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, SESSION_SECRET_ADMIN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return true;
  }

  if (
    viewerUsername &&
    viewerPassword &&
    username === viewerUsername &&
    password === viewerPassword
  ) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, SESSION_SECRET_VIEWER, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return true;
  }

  return false;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
