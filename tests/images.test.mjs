import test from "node:test";
import assert from "node:assert/strict";
import { themeImage, normalizeConfig, uploadedImageId, clearImageReferences, deleteSpeakerImage } from "../dist/beolink-multiroom-card.js";
import { fixture, config } from "./fixtures.mjs";

test("HA's explicit theme wins over the OS, and a missing dark image retains the existing image", () => {
  const old = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    assert.equal(themeImage("light.png", "dark.png", { themes: { darkMode: false } }), "light.png");
    assert.equal(themeImage("light.png", "dark.png", { themes: { darkMode: true } }), "dark.png");
    assert.equal(themeImage("photo.png", "", { themes: { darkMode: true } }), "photo.png");
    assert.equal(themeImage("", "dark.png", { themes: { darkMode: false } }), "");
    assert.equal(themeImage("light.png", "dark.png", {}), "dark.png");
  } finally { globalThis.matchMedia = old; }
});

test("Successful image deletion clears only this HA image's references and preserves layout/audio configuration", () => {
  const { hass } = fixture(); const id = "f".repeat(32);
  const relative = `/api/image/serve/${id}/256x256`;
  const original = normalizeConfig({ ...config, master_image: relative, master_image_dark: "/local/dark.png",
    group_name: "Alle Räume", grid_options: { columns: 24 },
    members: config.members.map((member, i) => ({ ...member, image: i ? `https://other.example${relative}` : hass.hassUrl(relative), image_dark: "/local/level.png" })) });
  assert.equal(uploadedImageId(relative, hass), id);
  assert.equal(uploadedImageId(`https://other.example${relative}`, hass), "");
  assert.equal(uploadedImageId("javascript:alert(1)", hass), "");
  const cleared = clearImageReferences(original, id, hass);
  assert.equal(cleared.master_image, "");
  assert.equal(cleared.members[0].image, "");
  assert.equal(cleared.members[1].image, original.members[1].image);
  assert.equal(cleared.master_image_dark, original.master_image_dark);
  assert.deepEqual(cleared.grid_options, original.grid_options);
  assert.equal(cleared.group_name, "Alle Räume");
  assert.equal(cleared.members[0].jid, original.members[0].jid);
  assert.equal(original.master_image, relative, "input configuration is not mutated");
});

test("Image deletion uses an exact authenticated HA image/delete request and validates the ID first", async () => {
  const requests = []; const hass = { callWS: async payload => { requests.push(payload); } };
  const id = "a".repeat(32);
  await deleteSpeakerImage(hass, id);
  assert.deepEqual(requests, [{ type: "image/delete", image_id: id }]);
  await assert.rejects(deleteSpeakerImage(hass, "../../other"), /Bildkennung/);
  assert.equal(requests.length, 1);
  await assert.rejects(deleteSpeakerImage({}, id), /nicht verfügbar/);
  await assert.rejects(deleteSpeakerImage({ callWS: async () => { throw new Error("denied"); } }, id), /denied/);
});
