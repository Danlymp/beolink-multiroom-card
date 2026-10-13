import test from "node:test";
import assert from "node:assert/strict";
import { sourceOptions, buildSourceCall, buildFavouriteCall, uploadSpeakerPhoto, normalizeConfig, editorSizeConfig } from "../dist/beolink-multiroom-card.js";
import { fixture, config, MAIN, LEVEL } from "./fixtures.mjs";

test("Sources come from HA, preserve exact labels and target the configured main player", () => {
  const { hass } = fixture();
  assert.deepEqual(sourceOptions(hass.states[MAIN]), ["Deezer", "Line-in", "Bluetooth"]);
  assert.deepEqual(buildSourceCall(config, "Line-in", hass), { domain: "media_player", service: "select_source", data: { entity_id: MAIN, source: "Line-in" } });
  hass.states[LEVEL].attributes.source_list = ["Radio", "Radio", null, 23, ""];
  hass.states[LEVEL].attributes.supported_features |= 2048;
  assert.deepEqual(sourceOptions(hass.states[LEVEL]), ["Radio"]);
  assert.equal(buildSourceCall({ ...config, master: LEVEL }, "Radio", hass).data.entity_id, LEVEL);
  assert.deepEqual(sourceOptions({ attributes: { source_list: "Line-in" } }), []);
});

test("Unreported sources, unavailable players and missing services cannot send a source request", () => {
  const { hass } = fixture();
  assert.throws(() => buildSourceCall(config, "Spotify", hass), /nicht zur Auswahl/);
  hass.states[MAIN].state = "unavailable";
  assert.throws(() => buildSourceCall(config, "Line-in", hass), /nicht verfügbar/);
  hass.states[MAIN].state = "idle";
  delete hass.services.media_player.select_source;
  assert.throws(() => buildSourceCall(config, "Line-in", hass), /nicht verfügbar/);
});

test("Four favourite slots invoke the speaker's stored presets through play_media", () => {
  const { hass } = fixture();
  for (const slot of [1, 2, 3, 4]) assert.deepEqual(buildFavouriteCall(config, slot, hass), {
    domain: "media_player", service: "play_media",
    data: { entity_id: MAIN, media_content_type: "favourite", media_content_id: String(slot) }
  });
  hass.states[LEVEL].attributes.supported_features |= 512;
  assert.equal(buildFavouriteCall({ ...config, master: LEVEL }, 4, hass).data.entity_id, LEVEL);
  for (const slot of [0, 5, 1.5, "1"]) assert.throws(() => buildFavouriteCall(config, slot, hass), /1 bis 4/);
  delete hass.services.media_player.play_media;
  assert.throws(() => buildFavouriteCall(config, 1, hass), /nicht verfügbar/);
});

test("Speaker images are optional and old configurations retain their rooms and layout", () => {
  const normalized = normalizeConfig({ ...config, grid_options: { columns: 12 } });
  assert.equal(normalized.master_image, "");
  assert.equal(normalized.members[0].image, "");
  assert.equal(normalized.members[0].jid, config.members[0].jid);
  assert.deepEqual(normalized.grid_options, { columns: 12 });
});

test("Safe sizing migrates fixed total heights without mutating speaker configuration or reducing an enlarged player", () => {
  const original = { ...config, player_height: 0, master_image: "/local/beolab.png", grid_options: { columns: 24, rows: 2 } };
  const before = JSON.stringify(original);
  const corrected = editorSizeConfig(original);
  assert.deepEqual(corrected.grid_options, { columns: 24, rows: "auto" });
  assert.equal(corrected.player_height, 560);
  assert.equal(corrected.master_image, original.master_image);
  assert.equal(corrected.members[0].jid, original.members[0].jid);
  assert.equal(JSON.stringify(original), before, "migration does not mutate HA's current dashboard object");
  assert.equal(editorSizeConfig({ ...original, player_height: 900 }).player_height, 900);
  assert.equal(normalizeConfig({ ...config, player_height: 1 }).player_height, 560);
  assert.equal(editorSizeConfig({ ...config, layout_options: { grid_columns: "full", grid_rows: 2 } }).grid_options.columns, "full");
  assert.throws(() => normalizeConfig({ ...config, player_height: -1 }), /player_height/);
});

test("Photo upload uses HA authentication, multipart form and a portable local thumbnail URL", async () => {
  const file = new File([new Uint8Array([1, 2, 3])], "speaker.png", { type: "image/png" });
  let seen;
  const url = await uploadSpeakerPhoto({ fetchWithAuth: async (path, options) => {
    seen = { path, options };
    return { status: 200, json: async () => ({ id: "a".repeat(32) }) };
  } }, file);
  assert.equal(seen.path, "/api/image/upload");
  assert.equal(seen.options.method, "POST");
  assert.equal(seen.options.body.get("file").name, "speaker.png");
  assert.equal(seen.options.body.get("file").type, "image/png");
  assert.equal(url, "/api/image/serve/" + "a".repeat(32) + "/256x256");
});

test("Invalid and oversized photo inputs fail before any network request", async () => {
  let calls = 0;
  const hass = { fetchWithAuth: async () => { calls++; } };
  await assert.rejects(uploadSpeakerPhoto(hass, { type: "image/heic", size: 50 }), /HEIC/);
  await assert.rejects(uploadSpeakerPhoto(hass, { type: "image/svg+xml", size: 50 }), /PNG/);
  await assert.rejects(uploadSpeakerPhoto(hass, { type: "image/png", size: 9 * 1024 * 1024 }), /8 MB/);
  await assert.rejects(uploadSpeakerPhoto(hass, { type: "image/png", size: 0 }), /8 MB/);
  assert.equal(calls, 0);
});

test("Upload failures and malformed response IDs produce actionable errors", async () => {
  const file = new File([new Uint8Array([1])], "speaker.jpg", { type: "image/jpeg" });
  await assert.rejects(uploadSpeakerPhoto({}, file), /Bildadresse/);
  for (const [status, message] of [[403, /Berechtigung/], [404, /nicht aktiv/], [413, /zu groß/]]) {
    await assert.rejects(uploadSpeakerPhoto({ fetchWithAuth: async () => ({ status }) }, file), message);
  }
  await assert.rejects(uploadSpeakerPhoto({ fetchWithAuth: async () => ({ status: 200, json: async () => ({ id: "../../other" }) }) }, file), /Bildkennung/);
});
