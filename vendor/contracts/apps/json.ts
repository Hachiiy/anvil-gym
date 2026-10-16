import { z } from "zod";
import { appPlatformLimits as limits } from "../limits.js";

const unsafe = new Set(["__proto__", "prototype", "constructor"]);
export function assertAppJson(
  value: unknown,
  maxBytes: number = limits.manifestBytes,
  shape: { nodes: number; depth: number } = {
    nodes: limits.jsonNodes,
    depth: limits.jsonDepth,
  },
) {
  const pending = [{ value, depth: 0, leave: false }];
  const seen = new Set<object>();
  let nodes = 0;
  let bytes = 0;
  const encoder = new TextEncoder();
  while (pending.length) {
    const item = pending.pop()!;
    if (item.leave) {
      if (item.value && typeof item.value === "object") seen.delete(item.value);
      continue;
    }
    if (++nodes > shape.nodes || item.depth > shape.depth)
      throw new Error("App JSON exceeds the structural budget.");
    if (item.value && typeof item.value === "object") {
      if (seen.has(item.value))
        throw new Error("App JSON must be an acyclic tree.");
      seen.add(item.value);
      pending.push({ ...item, leave: true });
      if (
        !Array.isArray(item.value) &&
        Object.getPrototypeOf(item.value) !== Object.prototype &&
        Object.getPrototypeOf(item.value) !== null
      )
        throw new Error("App JSON requires plain objects.");
      if (Array.isArray(item.value) && item.value.length > shape.nodes)
        throw new Error("App JSON exceeds the array structural budget.");
      const entries = Object.entries(item.value);
      if (
        Array.isArray(item.value) &&
        (entries.length !== item.value.length ||
          entries.some(([key], index) => key !== String(index)))
      )
        throw new Error(
          "App JSON requires dense arrays without custom properties.",
        );
      bytes += 2 + Math.max(0, entries.length - 1);
      for (const [key, child] of entries) {
        if (unsafe.has(key)) throw new Error("Unsafe App JSON property.");
        if (!Array.isArray(item.value))
          bytes += encoder.encode(JSON.stringify(key)).byteLength + 1;
        pending.push({ value: child, depth: item.depth + 1, leave: false });
      }
    } else {
      if (!(
        item.value === null ||
        typeof item.value === "string" ||
        typeof item.value === "boolean" ||
        (typeof item.value === "number" && Number.isFinite(item.value))
      ))
        throw new Error("Only finite JSON values are supported.");
      bytes += encoder.encode(JSON.stringify(item.value)).byteLength;
    }
    if (bytes > maxBytes) throw new Error("App JSON exceeds the byte budget.");
  }
}

export function appJsonValueSchema(maxBytes: number) {
  return z
    .unknown()
    .superRefine((value, context) => {
      try {
        assertAppJson(value, maxBytes);
      } catch {
        context.addIssue({
          code: "custom",
          message:
            "App JSON exceeds its budget or contains an unsupported value.",
        });
      }
    })
    .pipe(z.json());
}
export type AppJsonValue = z.infer<ReturnType<typeof appJsonValueSchema>>;
