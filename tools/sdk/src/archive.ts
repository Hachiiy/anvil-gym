import { gzipSync, gunzipSync } from "node:zlib";
import { appPathSchema } from "../contracts/apps/index.js";
import { appPlatformLimits as limits } from "../contracts/limits.js";

export type AppArchiveFiles = ReadonlyMap<string, Uint8Array>;
const block = 512;
const maxTarBytes =
  limits.expandedBytes + (limits.archiveFiles * 2 + 2) * block;

export function validateArchivePaths(files: AppArchiveFiles) {
  if (!files.size || files.size > limits.archiveFiles)
    throw new Error("Invalid package file count.");
  const names = new Set<string>();
  let total = 0;
  for (const [name, bytes] of files) {
    appPathSchema.parse(name);
    const normalized = name.toLowerCase();
    if (names.has(normalized))
      throw new Error("Duplicate normalized package path.");
    names.add(normalized);
    if (
      bytes.byteLength > limits.fileBytes ||
      (total += bytes.byteLength) > limits.expandedBytes
    )
      throw new Error("Package exceeds the expanded size budget.");
  }
}

function splitPath(path: string): [string, string] {
  if (path.length <= 100) return [path, ""];
  for (
    let index = path.lastIndexOf("/");
    index > 0;
    index = path.lastIndexOf("/", index - 1)
  )
    if (index <= 155 && path.length - index - 1 <= 100)
      return [path.slice(index + 1), path.slice(0, index)];
  throw new Error("Package path cannot be represented as USTAR.");
}
function octal(header: Buffer, value: number, start: number, length: number) {
  const encoded = value.toString(8).padStart(length - 1, "0");
  if (encoded.length >= length)
    throw new Error("USTAR number exceeds the field width.");
  header.write(`${encoded}\0`, start, length, "ascii");
}
function checksum(header: Uint8Array) {
  return header.reduce(
    (sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value),
    0,
  );
}

// Canonical gzip + USTAR: regular files, fixed mode/owner/time and sorted names.
export function packAppArchive(files: AppArchiveFiles): Uint8Array {
  validateArchivePaths(files);
  const chunks: Uint8Array[] = [];
  for (const [path, bytes] of [...files].sort(([left], [right]) =>
    left.localeCompare(right, "en"),
  )) {
    const [name, prefix] = splitPath(path);
    const header = Buffer.alloc(block);
    header.write(name, 0, 100, "ascii");
    octal(header, 0o644, 100, 8);
    octal(header, 0, 108, 8);
    octal(header, 0, 116, 8);
    octal(header, bytes.byteLength, 124, 12);
    octal(header, 0, 136, 12);
    header.write("0", 156, 1, "ascii");
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    header.write(prefix, 345, 155, "ascii");
    header.write(
      `${checksum(header).toString(8).padStart(6, "0")}\0 `,
      148,
      8,
      "ascii",
    );
    chunks.push(
      header,
      bytes,
      new Uint8Array((block - (bytes.byteLength % block)) % block),
    );
  }
  chunks.push(new Uint8Array(block * 2));
  const archive = gzipSync(Buffer.concat(chunks), { level: 9 });
  if (archive.byteLength > limits.archiveBytes)
    throw new Error("Package exceeds the compressed size budget.");
  return archive;
}

export function readAppArchive(archive: Uint8Array): AppArchiveFiles {
  if (!archive.byteLength || archive.byteLength > limits.archiveBytes)
    throw new Error("Invalid archive size.");
  const tar = gunzipSync(archive, { maxOutputLength: maxTarBytes });
  const files = new Map<string, Uint8Array>();
  const names = new Set<string>();
  let offset = 0,
    total = 0;
  const text = (header: Buffer, start: number, length: number) => {
    const field = header.subarray(start, start + length);
    const end = field.indexOf(0);
    const value = end < 0 ? field : field.subarray(0, end);
    if (
      [...value].some((byte) => byte > 127) ||
      (end >= 0 && field.subarray(end).some((byte) => byte !== 0))
    )
      throw new Error("Ambiguous USTAR text field.");
    return value.toString("ascii");
  };
  const number = (header: Buffer, start: number, length: number) => {
    const field = header.subarray(start, start + length).toString("ascii");
    if (!/^[0-7]+[\0 ]*$/.test(field))
      throw new Error("Invalid USTAR numeric field.");
    const value = Number.parseInt(field, 8);
    if (!Number.isSafeInteger(value)) throw new Error("Unsafe USTAR number.");
    return value;
  };
  while (offset + block <= tar.byteLength) {
    const header = tar.subarray(offset, offset + block);
    if (header.every((byte) => byte === 0)) {
      if (
        tar.byteLength - offset < block * 2 ||
        tar.subarray(offset).some((byte) => byte !== 0)
      )
        throw new Error("Invalid archive terminator or trailing content.");
      validateArchivePaths(files);
      return files;
    }
    if (
      number(header, 148, 8) !== checksum(header) ||
      text(header, 257, 6) !== "ustar" ||
      header.toString("ascii", 263, 265) !== "00"
    )
      throw new Error("Unsupported or corrupt USTAR header.");
    if (header[156] !== 48 || text(header, 157, 100))
      throw new Error("Only regular package files are permitted.");
    const prefix = text(header, 345, 155),
      name = text(header, 0, 100);
    const path = prefix ? `${prefix}/${name}` : name;
    appPathSchema.parse(path);
    if (names.has(path.toLowerCase()))
      throw new Error("Duplicate normalized archive entry.");
    names.add(path.toLowerCase());
    const size = number(header, 124, 12);
    if (
      size > limits.fileBytes ||
      (total += size) > limits.expandedBytes ||
      files.size >= limits.archiveFiles
    )
      throw new Error("Archive expansion budget exceeded.");
    offset += block;
    const padded = Math.ceil(size / block) * block;
    if (offset + padded > tar.byteLength)
      throw new Error("Truncated archive entry.");
    if (tar.subarray(offset + size, offset + padded).some((byte) => byte !== 0))
      throw new Error("Invalid archive padding.");
    files.set(path, tar.subarray(offset, offset + size));
    offset += padded;
  }
  throw new Error("Missing archive terminator.");
}
