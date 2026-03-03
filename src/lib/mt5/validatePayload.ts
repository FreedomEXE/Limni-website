/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: validatePayload.ts
 *
 * Description:
 * Shared Zod payload validation helper for MT5 API routes.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { z, type ZodType } from "zod";

export type Mt5ValidationError = {
  code: "INVALID_PAYLOAD";
  message: string;
  fields: Array<{
    path: string;
    code: string;
    message: string;
  }>;
};

export type Mt5ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Mt5ValidationError };

export function validateMt5Payload<T>(
  schema: ZodType<T>,
  data: unknown,
): Mt5ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: {
      code: "INVALID_PAYLOAD",
      message: "Payload validation failed.",
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    },
  };
}

export function toValidationResponse(error: Mt5ValidationError): {
  error: string;
  code: string;
  fields: Mt5ValidationError["fields"];
} {
  return {
    error: error.message,
    code: error.code,
    fields: error.fields,
  };
}

export { z };
