import { BadRequestError } from './errors';

export type JsonObject = Readonly<Record<string, unknown>>;

export function asObject(value: unknown, what = 'request body'): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestError(`${what} must be a JSON object`);
  }
  return value as JsonObject;
}

export function requireString(body: JsonObject, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new BadRequestError(`${key} must be a string`);
  }
  return value;
}

export function optionalString(body: JsonObject, key: string): string | undefined {
  return body[key] === undefined ? undefined : requireString(body, key);
}

export function requireNumber(body: JsonObject, key: string): number {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestError(`${key} must be a number`);
  }
  return value;
}

export function optionalNumber(body: JsonObject, key: string): number | undefined {
  return body[key] === undefined ? undefined : requireNumber(body, key);
}

export function requireInteger(body: JsonObject, key: string): number {
  const value = requireNumber(body, key);
  if (!Number.isInteger(value)) {
    throw new BadRequestError(`${key} must be a whole number`);
  }
  return value;
}

export function optionalArray(body: JsonObject, key: string): unknown[] | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new BadRequestError(`${key} must be a list`);
  }
  return value;
}

export function requireStringArray(body: JsonObject, key: string): string[] {
  const value = optionalArray(body, key);
  if (value === undefined || !value.every((item) => typeof item === 'string')) {
    throw new BadRequestError(`${key} must be a list of strings`);
  }
  return value as string[];
}

export function optionalStringMap(body: JsonObject, key: string): Record<string, string> {
  const value = body[key];
  if (value === undefined) return {};
  const map = asObject(value, key);
  const entries = Object.entries(map);
  if (!entries.every(([, entry]) => typeof entry === 'string')) {
    throw new BadRequestError(`${key} must only contain strings`);
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

export function parseId(raw: string, name: string): number {
  if (!/^[1-9]\d{0,14}$/.test(raw)) {
    throw new BadRequestError(`${name} must be a positive whole number (got '${raw}')`);
  }
  return Number(raw);
}

export function queryString(query: JsonObject, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new BadRequestError(`${key} must be given once`);
  }
  return value;
}

export function requireQueryString(query: JsonObject, key: string): string {
  const value = queryString(query, key);
  if (value === undefined) {
    throw new BadRequestError(`${key} is required`);
  }
  return value;
}

export function queryNumber(query: JsonObject, key: string): number | undefined {
  const raw = queryString(query, key);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(value)) {
    throw new BadRequestError(`${key} must be a number (got '${raw}')`);
  }
  return value;
}

export function requireQueryInteger(query: JsonObject, key: string): number {
  const value = queryNumber(query, key);
  if (value === undefined) {
    throw new BadRequestError(`${key} is required`);
  }
  if (!Number.isInteger(value)) {
    throw new BadRequestError(`${key} must be a whole number (got '${value}')`);
  }
  return value;
}

export function queryList(query: JsonObject, key: string): string[] | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  const parts = Array.isArray(value) ? value : [value];
  if (!parts.every((part) => typeof part === 'string')) {
    throw new BadRequestError(`${key} must be a list of names`);
  }
  return (parts as string[])
    .flatMap((part) => part.split(','))
    .map((part) => part.trim())
    .filter((part) => part !== '');
}
