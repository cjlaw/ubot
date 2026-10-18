import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export interface CommandEntry {
  file: string;
  module?: unknown;
  loadError?: unknown;
}

type Json = Record<string, unknown>;

const NAME_PATTERN = /^[-_'\p{L}\p{N}\p{sc=Deva}\p{sc=Thai}]+$/u;
const MAX_OPTIONS = 25;
const MAX_CHOICES = 25;
const MAX_NAME = 32;
const MAX_DESCRIPTION = 100;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null;
const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const length = (s: string): number => [...s].length;

const truncate = (v: unknown): string => {
  const s = typeof v === "string" ? JSON.stringify(v) : String(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
};

const describeError = (err: unknown): string => {
  if (!isObject(err)) return String(err);
  let detail = typeof err.message === "string" ? err.message : "unknown error";
  if ("constraint" in err || "expected" in err || "given" in err) {
    const parts = [
      `${asString(err.constraint) || truncate(err.constraint)}`,
      `expected ${truncate(err.expected)}`,
      `given ${truncate(err.given)}`,
    ];
    detail += ` (${parts.join(": ")})`;
  }
  return detail;
};

const baseName = (file: string): string => file.replace(/\.[^.]+$/, "");

function checkOptions(command: string, options: unknown[], path: string, out: string[]): void {
  const where = path ? `${path} > ` : "";
  const scope = path || "command";
  if (options.length > MAX_OPTIONS) {
    out.push(`${command}: too-many-options: ${scope} has ${options.length} options (max ${MAX_OPTIONS})`);
  }

  const seen = new Set<string>();
  let sawOptional = false;
  for (const raw of options) {
    const o: Json = isObject(raw) ? raw : {};
    const name = asString(o.name);
    const isSub = o.type === 1;
    const isGroup = o.type === 2;
    const label = `${isSub ? "subcommand" : isGroup ? "group" : "option"} "${name}"`;
    const at = `${where}${label}`;

    if (seen.has(name)) out.push(`${command}: duplicate-option: ${at} appears more than once in ${scope}`);
    seen.add(name);

    if (!isSub && !isGroup) {
      if (o.required === true) {
        if (sawOptional) out.push(`${command}: required-order: ${at} is required but follows an optional option`);
      } else {
        sawOptional = true;
      }
    }

    const dl = length(asString(o.description));
    if (dl < 1 || dl > MAX_DESCRIPTION) {
      out.push(`${command}: description-length: ${at} description is ${dl} code points (must be 1-${MAX_DESCRIPTION})`);
    }

    const choices = asArray(o.choices);
    if (choices.length > MAX_CHOICES) {
      out.push(`${command}: too-many-choices: ${at} has ${choices.length} choices (max ${MAX_CHOICES})`);
    }
    for (const c of choices) {
      const cn = asString(isObject(c) ? c.name : undefined);
      const cl = length(cn);
      if (cl < 1 || cl > MAX_DESCRIPTION) {
        out.push(`${command}: description-length: choice "${cn}" on ${at} name is ${cl} code points (must be 1-${MAX_DESCRIPTION})`);
      }
    }

    if (isSub || isGroup) {
      checkOptions(command, asArray(o.options), at, out);
    }
  }
}

export function checkCommands(entries: CommandEntry[]): string[] {
  const findings: string[] = [];
  const filesByName = new Map<string, string[]>();

  for (const entry of entries) {
    const fallback = baseName(entry.file);

    if (entry.loadError !== undefined) {
      findings.push(`${fallback}: definition-error: failed to import: ${describeError(entry.loadError)}`);
      continue;
    }

    const mod: Json = isObject(entry.module) ? entry.module : {};
    let command = fallback;
    let json: Json | undefined;

    const data = mod.data;
    if (!isObject(data) || typeof data.toJSON !== "function") {
      findings.push(`${fallback}: missing-definition: module does not export a data builder with toJSON()`);
    } else {
      try {
        const result: unknown = (data.toJSON as () => unknown)();
        json = isObject(result) ? result : {};
        if (isObject(result) && typeof result.name === "string" && result.name !== "") {
          command = result.name;
          filesByName.set(command, [...(filesByName.get(command) ?? []), entry.file]);
        }
      } catch (err) {
        findings.push(`${fallback}: definition-error: data.toJSON() threw: ${describeError(err)}`);
      }
    }

    if (typeof mod.execute !== "function") {
      findings.push(`${command}: missing-handler: module does not export an execute function`);
    }

    if (!json) continue;

    const name = asString(json.name);
    if (length(name) < 1 || length(name) > MAX_NAME || name !== name.toLowerCase() || !NAME_PATTERN.test(name)) {
      findings.push(`${command}: name-format: command name "${name}" is invalid (1-${MAX_NAME} lowercase letters, digits, - _ ')`);
    }
    const dl = length(asString(json.description));
    if (dl < 1 || dl > MAX_DESCRIPTION) {
      findings.push(`${command}: description-length: command description is ${dl} code points (must be 1-${MAX_DESCRIPTION})`);
    }
    checkOptions(command, asArray(json.options), "", findings);
  }

  for (const [name, files] of filesByName) {
    if (files.length > 1) {
      findings.push(`${name}: duplicate-command: defined in ${files.join(" and ")}`);
    }
  }

  return findings;
}

export async function loadCommands(dir: string): Promise<CommandEntry[]> {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"))
    .sort();
  const entries: CommandEntry[] = [];
  for (const file of files) {
    try {
      const module: unknown = await import(pathToFileURL(join(dir, file)).href);
      entries.push({ file, module });
    } catch (loadError) {
      entries.push({ file, loadError });
    }
  }
  return entries;
}
