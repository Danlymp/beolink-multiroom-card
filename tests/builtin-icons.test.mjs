import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { BUILTIN_SPEAKERS, VERSION, normalizeConfig, safeImageUrl, speakerImage } from "../dist/beolink-multiroom-card.js";

test("All shipped models and Stage variants resolve locally in both HA themes", async () => {
  const files = (await readdir(new URL("../icons/", import.meta.url))).filter(name => name.endsWith(".svg"));
  assert.equal(BUILTIN_SPEAKERS.length, files.length);
  assert.equal(new Set(BUILTIN_SPEAKERS.map(item => item.id)).size, files.length);
  assert.ok(BUILTIN_SPEAKERS.some(item => item.id === "beosound-balance"));
  for (const item of BUILTIN_SPEAKERS) {
    const svg = (await readFile(new URL(`../icons/${item.id}.svg`, import.meta.url), "utf8")).trim();
    for (const dark of [false, true]) {
      const token = speakerImage(item.id, "/old.png", "/old-dark.png", { themes: { darkMode: dark } });
      const url = safeImageUrl(token, "https://ha.example/");
      assert.match(url, /^data:image\/svg\+xml;charset=utf-8,/);
      const rendered = decodeURIComponent(url.split(",").slice(1).join(","));
      assert.equal(rendered, dark ? svg.replaceAll("#263238", "#F4F6F7") : svg);
    }
  }
});

test("Old configuration and unknown model IDs retain their uploaded/custom images", () => {
  const old = { master: "media_player.main", master_image: "/local/old.png", master_image_dark: "/local/old-dark.png",
    members: [{ entity: "media_player.room", jid: "", name: "Room", image: "/local/room.png", image_dark: "" }] };
  const normalized = normalizeConfig(old);
  assert.deepEqual(normalized.members, old.members);
  assert.equal(speakerImage(undefined, old.master_image, old.master_image_dark, { themes: { darkMode: true } }), "/local/old-dark.png");
  assert.equal(speakerImage("future-model", old.master_image, old.master_image_dark, { themes: { darkMode: false } }), "/local/old.png");
  const selected = normalizeConfig({ ...old, master_model: "beosound-balance", members: [{ ...old.members[0], model: "beolab-8" }] });
  assert.equal(selected.master_image, old.master_image);
  assert.equal(selected.members[0].image, old.members[0].image);
  assert.equal(selected.members[0].model, "beolab-8");
  assert.throws(() => normalizeConfig({ master_model: {} }), /Modellname/);
});

test("Only packaged icon IDs resolve; arbitrary data, scripts, and traversal remain rejected", () => {
  for (const value of ["beolink-icon:../beolab-8:light", "beolink-icon:missing:light", "beolink-icon:beolab-8:custom",
    "data:image/svg+xml,<svg onload=alert(1)>", "javascript:alert(1)", "file:///etc/passwd"]) {
    assert.equal(safeImageUrl(value, "https://ha.example/"), "");
  }
});

test("HACS package targets a single matching self-contained distribution file", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const hacs = JSON.parse(await readFile(new URL("../hacs.json", import.meta.url), "utf8"));
  const distFiles = await readdir(new URL("../dist/", import.meta.url));
  assert.equal(pkg.version, VERSION);
  assert.equal(hacs.filename, pkg.name + ".js");
  assert.deepEqual(distFiles, [hacs.filename]);
  assert.equal(hacs.zip_release, undefined);
  const source = await readFile(new URL("../dist/beolink-multiroom-card.js", import.meta.url), "utf8");
  assert.equal(source.includes("/* BUILTIN_SPEAKERS */"), false);
  assert.doesNotMatch(source, /^\s*import\s/m);
});
