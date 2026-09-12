/**
 * Shared normalisation for zero-code tool form parameters.
 *
 * The API returns a tool's `parameters` in three shapes, and both forms that
 * can launch a scan — the tool detail page and the scan execution page — had
 * grown their own copy of the logic that flattens them. Measured against the
 * live catalogue:
 *
 *   470 tools  `{ form: [ {name,label,type,required,options,default} ],
 *                 danger_level, target_types }`   (every ht_* and seeded tool)
 *   600 tools  a plain object — 528 of them empty `{}`, 72 carrying a single
 *              `{ target: { type, required } }`
 *   440 tools  null
 *
 * Keeping two copies cost us two live defects, both fixed by moving to this
 * module (see the page diffs):
 *
 *   1. The scan page normalised by *overwriting* `tool.parameters` with the
 *      flattened map, which deleted `target_types` and `danger_level` from the
 *      object it read them back out of. The "Accepted Target Types" panel could
 *      therefore never render for any of the 470 tools that have them.
 *   2. The scan page had no notion of a secret field, so the 11 tools with a
 *      credential input rendered it as plain text with autofill enabled —
 *      while the tool detail page masked the same field.
 *
 * So `secret` and `group` are part of this contract, not an afterthought: a
 * caller that flattens parameters gets the masking decision with them.
 */

/** A parameter whose value must never be shown, logged or autofilled. */
export const SECRET_NAME_RE = /pass|secret|token|api[_-]?key|credential/i;

/** Keys that live alongside the fields in a form-shaped object, not in it. */
const META_KEYS = new Set(['form', 'danger_level', 'target_types']);

export function isSecretParam(name: unknown, type: unknown): boolean {
  return type === 'password' || SECRET_NAME_RE.test(String(name ?? ''));
}

export interface NormalizedParam {
  name: string;
  /** Always '' for form-shaped tools: the backend substitutes `{placeholders}`. */
  flag: string;
  type: string;
  required: boolean;
  default?: string;
  placeholder: string;
  options?: unknown[];
  description: string;
  group: string;
  secret: boolean;
  min?: number;
  max?: number;
}

export interface ToolFormMeta {
  target_types?: string[];
  danger_level?: string;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The metadata that sits beside the fields. Read this *before* flattening, and
 * never flatten over the object you read it from.
 */
export function getFormMeta(parameters: unknown): ToolFormMeta {
  if (!isPlainObject(parameters)) return {};
  const target_types = Array.isArray(parameters.target_types)
    ? (parameters.target_types as unknown[]).map(String)
    : undefined;
  const danger_level =
    typeof parameters.danger_level === 'string' ? parameters.danger_level : undefined;
  return { target_types, danger_level };
}

/** An `<input type="number">` bound to a non-numeric min/max renders nothing useful. */
const numberOrUndefined = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Flatten the `{ form: [...] }` shape.
 * Returns `null` when the tool is not form-shaped, so a caller can tell
 * "not this shape" apart from "this shape, no fields" — the two take different
 * branches in the tool detail page's precedence chain.
 */
export function parseFormParameters(parameters: unknown): NormalizedParam[] | null {
  if (!isPlainObject(parameters) || !Array.isArray(parameters.form)) return null;

  const out: NormalizedParam[] = [];
  for (const raw of parameters.form) {
    if (!isPlainObject(raw)) continue;
    const name = String(raw.name ?? '');
    if (!name) continue;

    const rawType = String(raw.type ?? 'text');
    const hasDefault = raw.default !== undefined;
    out.push({
      name,
      flag: '',
      // url/email/password are input hints, not renderer types. password in
      // particular must stay a text input so `secret` drives the masking and
      // one code path decides it.
      type: rawType === 'url' || rawType === 'email' || rawType === 'password' ? 'text' : rawType,
      required: !!raw.required,
      default: hasDefault ? String(raw.default) : undefined,
      placeholder: String(raw.placeholder ?? (hasDefault ? String(raw.default) : '')),
      options: Array.isArray(raw.options) ? raw.options : undefined,
      description: String(raw.label ?? name),
      group: String(raw.group ?? 'Parameters'),
      secret: isSecretParam(name, rawType),
      min: numberOrUndefined(raw.min),
      max: numberOrUndefined(raw.max),
    });
  }
  return out;
}

/**
 * Flatten the plain-object shape, `{ target: { type, required } }`.
 * `description || key` for the name is deliberate and matches what the tool
 * detail page has always done; no tool in the catalogue carries a description
 * here, so every one of them resolves to the key the command template expects.
 */
export function parseObjectParameters(parameters: unknown): NormalizedParam[] {
  if (!isPlainObject(parameters)) return [];

  const out: NormalizedParam[] = [];
  for (const [key, value] of Object.entries(parameters)) {
    if (META_KEYS.has(key)) continue;
    if (!isPlainObject(value)) continue;

    const name = String(value.description ?? key);
    const type = String(value.type ?? 'text');
    const hasDefault = value.default !== undefined;
    out.push({
      name,
      flag: String(value.flag ?? ''),
      type,
      required: !!value.required,
      default: hasDefault ? String(value.default) : undefined,
      placeholder: String(value.placeholder ?? (hasDefault ? String(value.default) : '')),
      options: Array.isArray(value.options) ? value.options : undefined,
      description: String(value.description ?? key),
      group: String(value.group ?? 'General'),
      secret: isSecretParam(name, type) || isSecretParam(key, type),
      min: numberOrUndefined(value.min),
      max: numberOrUndefined(value.max),
    });
  }
  return out;
}

/** Keyed by `name`, for renderers that iterate a map rather than a list. */
export function toParameterMap(params: NormalizedParam[]): Record<string, NormalizedParam> {
  const out: Record<string, NormalizedParam> = {};
  for (const p of params) out[p.name] = p;
  return out;
}

/**
 * A `<select>` option arrives either as a bare string or as `{ label, value }`.
 * The live catalogue has 493 of the latter and 21 of the former, and rendering
 * the object straight into JSX throws React error #31.
 *
 * Legacy string options carry a trailing explanation ("aws  Amazon Web
 * Services"), so the value is the first word while the label keeps the rest.
 */
export function resolveSelectOption(
  opt: unknown,
  index: number,
): { value: string; label: string; key: string } {
  if (isPlainObject(opt)) {
    const value = String(opt.value ?? '');
    return { value, label: String(opt.label ?? opt.value ?? ''), key: `${value}-${index}` };
  }
  const text = String(opt);
  const value = text.split(' ')[0];
  return { value, label: text, key: `${value}-${index}` };
}

/** Seed a form field from a parameter default, including `{label,value}` selects. */
export function coerceParamDefault(raw: unknown): string | number | boolean | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'boolean' || typeof raw === 'number') return raw;
  if (typeof raw === 'object') {
    const v = (raw as { value?: unknown }).value;
    return v !== undefined && v !== null ? String(v) : undefined;
  }
  return String(raw);
}
