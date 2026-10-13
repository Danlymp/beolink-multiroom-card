import test from "node:test";
import assert from "node:assert/strict";
import { connectedPlayers, groupVolumeSnapshot, buildGroupVolumeCalls, buildGroupMuteCall, buildGroupOffCall, buildPowerCall, fetchSpeakerImages, uploadSpeakerPhoto } from "../dist/beolink-multiroom-card.js";
import { fixture, config, MAIN, KITCHEN, LEVEL, KITCHEN_JID, LEVEL_JID } from "./fixtures.mjs";

test("Group controls target the leader and actual listeners, never a configured but disconnected room", () => {
  const { hass } = fixture([KITCHEN_JID]);
  assert.deepEqual(connectedPlayers(config, hass).targets.map(item => item.entity), [MAIN, KITCHEN]);
  assert.deepEqual(buildGroupMuteCall(config, true, hass).data, { entity_id: [MAIN, KITCHEN], is_volume_muted: true });
  assert.deepEqual(buildGroupOffCall(config, hass), { domain: "media_player", service: "turn_off", data: { entity_id: [MAIN, KITCHEN] } });
  assert.throws(() => buildGroupOffCall(config, fixture().hass), /Kein weiterer/);
});

test("An externally joined Mozart is included by its exact JID; unmapped ASE blocks partial group operations", () => {
  const empty = { ...config, members: [] };
  assert.deepEqual(connectedPlayers(empty, fixture([LEVEL_JID]).hass).targets.map(item => item.entity), [MAIN, LEVEL]);
  const { hass } = fixture([KITCHEN_JID]);
  assert.throws(() => buildGroupOffCall(empty, hass), /Entität/);
  assert.throws(() => buildGroupMuteCall(empty, true, hass), /Entität/);
  assert.throws(() => buildGroupVolumeCalls(empty, 30, hass), /Entität/);
  const wrong = { ...config, members: [{ jid: KITCHEN_JID, entity: LEVEL }] };
  assert.throws(() => buildGroupOffCall(wrong, hass), /Entität/);
});

test("Relative group volume preserves the room balance and clamps safely at both endpoints", () => {
  const { hass } = fixture([KITCHEN_JID]);
  assert.equal(connectedPlayers(config, hass).mean, 28);
  assert.deepEqual(buildGroupVolumeCalls(config, 40, hass).map(call => call.data), [
    { entity_id: MAIN, volume_level: .44 }, { entity_id: KITCHEN, volume_level: .36 }
  ]);
  for (const [value, expected] of [[0, 0], [100, 1]]) assert.ok(buildGroupVolumeCalls(config, value, hass).every(call => call.data.volume_level === expected));
  hass.states[MAIN].attributes.volume_level = .98; hass.states[KITCHEN].attributes.volume_level = .1;
  assert.deepEqual(buildGroupVolumeCalls(config, 90, hass).map(call => call.data.volume_level), [1, .46]);
  for (const value of [-1, 101, NaN, "20"]) assert.throws(() => buildGroupVolumeCalls(config, value, hass), /Ungültige/);
});

test("A room leaving during a drag invalidates the volume capture; unsupported or unavailable targets cannot be silently skipped", () => {
  const start = groupVolumeSnapshot(config, fixture([KITCHEN_JID]).hass);
  assert.throws(() => buildGroupVolumeCalls(config, 40, fixture([LEVEL_JID]).hass, start), /geändert/);
  const { hass } = fixture([KITCHEN_JID]);
  hass.states[KITCHEN].state = "unavailable";
  assert.throws(() => buildGroupMuteCall(config, true, hass), /Küche/);
  hass.states[KITCHEN].state = "playing"; hass.states[KITCHEN].attributes.supported_features = 4;
  assert.throws(() => buildGroupOffCall(config, hass), /Standby/);
  assert.throws(() => buildGroupMuteCall(config, true, hass), /Stummschalten/);
});

test("Mozart power uses explicit standby and resumes playback; ASE supports native power on", () => {
  const { hass } = fixture();
  assert.equal(buildPowerCall(MAIN, false, hass).service, "turn_off");
  assert.equal(buildPowerCall(MAIN, true, hass).service, "media_play");
  assert.equal(buildPowerCall(KITCHEN, true, hass).service, "turn_on");
  hass.states[MAIN].state = "unavailable";
  assert.throws(() => buildPowerCall(MAIN, true, hass), /nicht verfügbar/);
});

test("The HA image list returns portable server URLs and rejects unsafe IDs", async () => {
  const requests = [];
  const list = await fetchSpeakerImages({ callWS: async request => { requests.push(request); return [
    { id: "b".repeat(32), name: "Helles_Dashboard/Level.png" },
    { id: "../unsafe", name: "Invalid" },
    { id: "a".repeat(32), name: "Dunkles_Dashboard/A5.png" }
  ]; } });
  assert.deepEqual(requests, [{ type: "image/list" }]);
  assert.equal(list.length, 2);
  assert.equal(list[0].url, "/api/image/serve/" + "a".repeat(32) + "/256x256");
  await assert.rejects(fetchSpeakerImages({ callWS: async () => { throw new Error("Forbidden"); } }), /Forbidden/);
});

test("Folder upload retains folder names in HA metadata so light and dark icons remain distinguishable", async () => {
  const file = new File([new Uint8Array([1, 2])], "Level.png", { type: "image/png" });
  Object.defineProperty(file, "webkitRelativePath", { value: "Dunkles_Dashboard/Level.png" });
  let uploadedName;
  await uploadSpeakerPhoto({ fetchWithAuth: async (_, options) => {
    uploadedName = options.body.get("file").name;
    return { status: 200, json: async () => ({ id: "c".repeat(32) }) };
  } }, file);
  assert.equal(uploadedName, "Dunkles_Dashboard/Level.png");
});
