import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = (process.argv[2] || "").replace(/^v/, "");
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error("Version als drei Zahlen angeben, zum Beispiel 0.10.1.");
const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
const lockPath = resolve(root, "package-lock.json");
const lock = JSON.parse(await readFile(lockPath, "utf8"));
const current = pkg.version.split(".").map(Number);
const requested = version.split(".").map(Number);
const different = requested.findIndex((part, index) => part !== current[index]);
if (different !== -1 && requested[different] < current[different]) throw new Error("Die neue Version darf nicht kleiner als die aktuelle sein.");
const srcPath = resolve(root, "src/beolink-multiroom-card.js");
const src = await readFile(srcPath, "utf8");
if (!src.includes(`export const VERSION = "${pkg.version}";`)) throw new Error("Quellversion stimmt nicht mit package.json überein.");
await writeFile(srcPath, src.replace(`B&O Multiroom Card ${pkg.version}`, `B&O Multiroom Card ${version}`)
  .replace(`export const VERSION = "${pkg.version}";`, `export const VERSION = "${version}";`));
pkg.version = version;
await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
await writeFile(lockPath, JSON.stringify(lock, null, 2) + "\n");
await import("./build.mjs");
