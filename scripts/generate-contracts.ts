/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: generate-contracts.ts
 *
 * Description:
 * Generates TypeScript and MQL5 contract artifacts from
 * contracts/mt5_event_contract.json.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  values?: Array<string | number | boolean>;
  anyOf?: JsonSchema[];
  ref?: string;
  additionalProperties?: boolean;
};

type ContractSpec = {
  _meta: Record<string, unknown>;
  enums: {
    reason_code: string[];
    event_type: string[];
    state_key: string[];
  };
  payloads: Record<string, JsonSchema>;
};

const ROOT = process.cwd();
const CONTRACT_PATH = path.resolve(ROOT, "contracts/mt5_event_contract.json");
const TS_OUT = path.resolve(ROOT, "src/lib/mt5/contracts.ts");
const MQH_OUT = path.resolve(ROOT, "mt5/Experts/Include/Generated/Contract.mqh");

function toConstName(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toUpperCase();
}

function toPascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function enumExpr(values: Array<string | number | boolean>): string {
  if (values.length === 0) return "z.never()";
  if (values.every((v) => typeof v === "string")) {
    return `z.enum([${values.map((v) => quote(String(v))).join(", ")}] as const)`;
  }
  return `z.union([${values.map((v) => `z.literal(${JSON.stringify(v)})`).join(", ")}])`;
}

function buildZodExpr(schema: JsonSchema): string {
  const kind = schema.type ?? "object";

  if (kind === "string") return "z.string()";
  if (kind === "number") return "z.number()";
  if (kind === "integer") return "z.number().int()";
  if (kind === "boolean") return "z.boolean()";
  if (kind === "null") return "z.null()";

  if (kind === "enum") {
    return enumExpr(schema.values ?? []);
  }

  if (kind === "enum_ref") {
    const ref = String(schema.ref ?? "").trim();
    if (!ref) return "z.never()";
    return `${toPascalCase(ref)}Schema`;
  }

  if (kind === "union") {
    const members = (schema.anyOf ?? []).map((child) => buildZodExpr(child));
    if (members.length === 0) return "z.never()";
    return `z.union([${members.join(", ")}])`;
  }

  if (kind === "array") {
    const itemExpr = buildZodExpr(schema.items ?? { type: "object", additionalProperties: true });
    return `z.array(${itemExpr})`;
  }

  if (kind === "object") {
    const props = schema.properties ?? {};
    const requiredSet = new Set(schema.required ?? []);
    const keys = Object.keys(props);

    if (keys.length === 0 && schema.additionalProperties) {
      return "z.record(z.string(), z.unknown())";
    }

    const entries = keys
      .map((key) => {
        const valueExpr = buildZodExpr(props[key]);
        const withOptional = requiredSet.has(key) ? valueExpr : `${valueExpr}.optional()`;
        return `  ${JSON.stringify(key)}: ${withOptional}`;
      })
      .join(",\n");

    let obj = `z.object({\n${entries}\n})`;
    // Keep validation additive and backward-compatible.
    obj += ".passthrough()";
    return obj;
  }

  return "z.unknown()";
}

function buildTs(spec: ContractSpec): string {
  const reasonValues = JSON.stringify(spec.enums.reason_code, null, 2)
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");
  const eventValues = JSON.stringify(spec.enums.event_type, null, 2)
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");
  const stateValues = JSON.stringify(spec.enums.state_key, null, 2)
    .split("\n")
    .map((line) => (line.length > 0 ? `  ${line}` : line))
    .join("\n");

  const payloadEntries = Object.entries(spec.payloads)
    .map(([name, schema]) => `export const ${name} = ${buildZodExpr(schema)};`)
    .join("\n\n");

  const typeEntries = Object.keys(spec.payloads)
    .map((name) => `export type ${name.replace(/Schema$/, "")} = z.infer<typeof ${name}>;`)
    .join("\n");

  return `/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: contracts.ts
 *
 * Description:
 * AUTO-GENERATED FROM contracts/mt5_event_contract.json.
 * DO NOT EDIT MANUALLY.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { z } from "zod";

export const ReasonCodeValues = ${reasonValues} as const;
export const EventTypeValues = ${eventValues} as const;
export const StateKeyValues = ${stateValues} as const;

export const ReasonCodeSchema = z.enum(ReasonCodeValues);
export const EventTypeSchema = z.enum(EventTypeValues);
export const StateKeySchema = z.enum(StateKeyValues);

export type ReasonCode = z.infer<typeof ReasonCodeSchema>;
export type EventType = z.infer<typeof EventTypeSchema>;
export type StateKey = z.infer<typeof StateKeySchema>;

${payloadEntries}

export const Mt5PushPayloadSchema = z.union([
  EventPushSchema,
  HeartbeatPushSchema,
  PositionSnapshotPushSchema,
  LegacyPushSchema,
]);

export type Mt5PushPayload = z.infer<typeof Mt5PushPayloadSchema>;
${typeEntries}
`;
}

function buildMqh(spec: ContractSpec): string {
  const lines: string[] = [];
  lines.push("/*-----------------------------------------------");
  lines.push("  Property of Freedom_EXE  (c) 2026");
  lines.push("-----------------------------------------------*/");
  lines.push("// AUTO-GENERATED FROM contracts/mt5_event_contract.json - DO NOT EDIT MANUALLY");
  lines.push("#ifndef __LIMNI_CONTRACT_MQH__");
  lines.push("#define __LIMNI_CONTRACT_MQH__");
  lines.push("");

  const writeGroup = (name: string, values: string[]) => {
    lines.push(`// ${name}`);
    for (const value of values) {
      const constName = `LIMNI_${name}_${toConstName(value)}`;
      lines.push(`static const string ${constName} = \"${value}\";`);
    }
    lines.push("");
  };

  writeGroup("REASON_CODE", spec.enums.reason_code);
  writeGroup("EVENT_TYPE", spec.enums.event_type);
  writeGroup("STATE_KEY", spec.enums.state_key);

  lines.push("#endif // __LIMNI_CONTRACT_MQH__");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const raw = await readFile(CONTRACT_PATH, "utf8");
  const spec = JSON.parse(raw) as ContractSpec;

  const ts = buildTs(spec);
  const mqh = buildMqh(spec);

  await mkdir(path.dirname(TS_OUT), { recursive: true });
  await mkdir(path.dirname(MQH_OUT), { recursive: true });

  await writeFile(TS_OUT, ts, "utf8");
  await writeFile(MQH_OUT, mqh, "utf8");

  console.log("[contracts] Generated:");
  console.log(` - ${path.relative(ROOT, TS_OUT)}`);
  console.log(` - ${path.relative(ROOT, MQH_OUT)}`);
}

main().catch((error) => {
  console.error("[contracts] generation failed:", error);
  process.exitCode = 1;
});
