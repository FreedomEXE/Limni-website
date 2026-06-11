import crypto from "node:crypto";

export type EncryptedPayload = {
  iv: string;
  tag: string;
  data: string;
};

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY ?? "";
  if (!raw) {
    throw new Error("APP_ENCRYPTION_KEY is not configured.");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptJson(value: unknown): EncryptedPayload {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: payload.toString("base64"),
  };
}

export function decryptJson<T = unknown>(payload: EncryptedPayload): T {
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const data = Buffer.from(payload.data, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
  decipher.setAuthTag(tag);
  const raw = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(raw) as T;
}
