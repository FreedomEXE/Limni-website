/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/auth.ts
 *
 * Description:
 * Central owner-only auth helpers for cookie-backed access control.
 * Supports a local AUTH_BYPASS mode for Playwright/Codex automation in dev.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "limni_session";
const SESSION_USER_COOKIE_NAME = "limni_user";
const SESSION_SECRET_ADMIN = "admin";

export type UserRole = "admin";

function isAuthBypassed() {
  return process.env.AUTH_BYPASS === "true";
}

export async function getSessionRole(): Promise<UserRole | null> {
  if (isAuthBypassed()) {
    return "admin";
  }

  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (session === SESSION_SECRET_ADMIN) {
    return "admin";
  }

  return null;
}

export async function getSessionUsername(): Promise<string | null> {
  if (isAuthBypassed()) {
    return "codex";
  }

  const cookieStore = await cookies();
  const username = cookieStore.get(SESSION_USER_COOKIE_NAME)?.value?.trim();
  return username ? username : null;
}

export async function isAuthenticated(): Promise<boolean> {
  const role = await getSessionRole();
  return role !== null;
}

export async function login(username: string, password: string): Promise<boolean> {
  if (isAuthBypassed()) {
    return true;
  }

  const validUsername = process.env.AUTH_USERNAME || "admin";
  const validPassword = process.env.AUTH_PASSWORD || "password";

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

  return false;
}

export async function logout(): Promise<void> {
  if (isAuthBypassed()) {
    return;
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(SESSION_USER_COOKIE_NAME);
}
