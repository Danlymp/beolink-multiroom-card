import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const source = await readFile(resolve(root, "src/beolink-multiroom-card.js"), "utf8");
if (!source.includes(`export const VERSION = "${pkg.version}";`)) throw new Error("Versionen in package.json und src stimmen nicht überein.");
const marker = "/* BUILTIN_SPEAKERS */ []";
if (source.split(marker).length !== 2) throw new Error("Icon-Platzhalter fehlt oder ist mehrfach vorhanden.");
const files = (await readdir(resolve(root, "icons"))).filter(name => name.endsWith(".svg")).sort();
if (!files.length) throw new Error("Keine SVG-Icons gefunden.");
const speakers = [];
const allowedTags = new Set(["svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "title", "desc"]);
for (const file of files) {
  const id = file.slice(0, -4);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Ungültiger Icon-Dateiname: ${file}`);
  const svg = (await readFile(resolve(root, "icons", file), "utf8")).trim();
  const title = svg.match(/<title>([^<]+)<\/title>/)?.[1];
  if (!title || /[&<>]/.test(title)) throw new Error(`${file}: einfacher <title> mit dem Modellnamen erforderlich.`);
  if (!/^<svg\s/.test(svg) || !/<\/svg>$/.test(svg) || !/viewBox="0 0 512 512"/.test(svg)) throw new Error(`${file}: vollständiges SVG mit viewBox="0 0 512 512" erforderlich.`);
  if (!svg.includes("#263238")) throw new Error(`${file}: Linienfarbe #263238 erforderlich.`);
  if (/<!|<\?|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=|url\s*\(/i.test(svg)) throw new Error(`${file}: nur eigenständige Liniengrafiken ohne Links, Stile oder Skripte zulässig.`);
  for (const match of svg.matchAll(/<\/?([\w:-]+)/g)) {
    if (!allowedTags.has(match[1])) throw new Error(`${file}: nicht unterstütztes Element ${match[1]}.`);
  }
  speakers.push({ id, name: title, svg });
}
speakers.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
const output = source.replace(marker, JSON.stringify(speakers));
await mkdir(resolve(root, "dist"), { recursive: true });
await writeFile(resolve(root, "dist/beolink-multiroom-card.js"), output);
console.log(`B&O Multiroom ${pkg.version}: ${speakers.length} Icon-Varianten in einer Kartendatei (${Buffer.byteLength(output)} Bytes).`);
