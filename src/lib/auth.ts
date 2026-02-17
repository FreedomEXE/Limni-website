import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "limni_session";
const SESSION_USER_COOKIE_NAME = "limni_user";
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

export async function getSessionUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const username = cookieStore.get(SESSION_USER_COOKIE_NAME)?.value?.trim();
  return username ? username : null;
}

export async function isAuthenticated(): Promise<boolean> {
  const role = await getSessionRole();
  return role !== null;
}

export async function canAccessMt5Source(): Promise<boolean> {
  const role = await getSessionRole();
  const username = await getSessionUsername();
  const sourceAccessUsername = (
    process.env.MT5_SOURCE_ACCESS_USERNAME ||
    process.env.AUTH_USERNAME ||
    "admin"
  )
    .trim()
    .toLowerCase();

  return role === "admin" && Boolean(username) && username.toLowerCase() === sourceAccessUsername;
}

export async function login(username: string, password: string): Promise<boolean> {
  const validUsername = process.env.AUTH_USERNAME || "admin";
  const validPassword = process.env.AUTH_PASSWORD || "password";
  const viewerUsername = process.env.AUTH_VIEWER_USERNAME;
  const viewerPassword = process.env.AUTH_VIEWER_PASSWORD;
  const viewerUsernameAlt = process.env.AUTH_VIEWER_USERNAME_ALT;
  const viewerPasswordAlt = process.env.AUTH_VIEWER_PASSWORD_ALT;
  const viewerUsernameAlt2 = process.env.AUTH_VIEWER_USERNAME_ALT2;
  const viewerPasswordAlt2 = process.env.AUTH_VIEWER_PASSWORD_ALT2;

  if (username === validUsername && password === validPassword) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, SESSION_SECRET_ADMIN, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    cookieStore.set(SESSION_USER_COOKIE_NAME, username, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    return true;
  }

  const viewerLogins = [
    [viewerUsername, viewerPassword],
    [viewerUsernameAlt, viewerPasswordAlt],
    [viewerUsernameAlt2, viewerPasswordAlt2],
  ];

  const isViewerMatch = viewerLogins.some(
    ([u, p]) => !!u && !!p && username === u && password === p,
  );

  if (isViewerMatch) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, SESSION_SECRET_VIEWER, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
    cookieStore.set(SESSION_USER_COOKIE_NAME, username, {
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
  cookieStore.delete(SESSION_USER_COOKIE_NAME);
}
