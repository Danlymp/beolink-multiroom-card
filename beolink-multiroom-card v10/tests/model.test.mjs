import test from "node:test";
import assert from "node:assert/strict";
import { beolinkEntries, groupState, roomState, buildMembershipCall, normalizeConfig, matchingMozartEntity, safeImageUrl, isJid } from "../dist/beolink-multiroom-card.js";
import { fixture, config, MAIN, MAIN_JID, KITCHEN_JID, LEVEL_JID, LEVEL } from "./fixtures.mjs";

test("ASE expand routes through the selected Mozart master with an explicit JID", () => {
  const { hass } = fixture();
  assert.deepEqual(buildMembershipCall(config, 0, true, hass), {
    domain: "bang_olufsen", service: "beolink_expand",
    data: { entity_id: MAIN, beolink_jids: [KITCHEN_JID] }
  });
});
test("ASE unexpand removes only the requested kitchen", () => {
  const { hass } = fixture([KITCHEN_JID, LEVEL_JID]);
  assert.deepEqual(buildMembershipCall(config, 0, false, hass), {
    domain: "bang_olufsen", service: "beolink_unexpand",
    data: { entity_id: MAIN, beolink_jids: [KITCHEN_JID] }
  });
});
test("Official friendly-name maps preserve exact JIDs, including ASE", () => {
  assert.deepEqual(beolinkEntries({ Küche: KITCHEN_JID }), [{ name: "Küche", jid: KITCHEN_JID }]);
  assert.equal(isJid("source:" + KITCHEN_JID), false);
  assert.equal(isJid(KITCHEN_JID + " garbage"), false);
});
test("Playing alone does not imply membership; an external B&O change does", () => {
  const { hass } = fixture();
  hass.states[config.members[0].entity].state = "playing";
  assert.equal(roomState(config, 0, hass).joined, false);
  hass.states[MAIN].attributes.beolink.listeners = { Küche: KITCHEN_JID };
  assert.equal(roomState(config, 0, hass).joined, true);
  delete hass.states[MAIN].attributes.beolink.listeners;
  assert.equal(roomState(config, 0, hass).joined, false);
});
test("HA ASE listener placeholders cover devices absent from peers", () => {
  const { hass } = fixture([KITCHEN_JID]);
  hass.states[MAIN].attributes.beolink.listeners = {};
  delete hass.states[MAIN].attributes.beolink.peers;
  assert.equal(roomState(config, 0, hass).joined, true);
});
test("Missing or unavailable master state stays unknown, not falsely disconnected", () => {
  const { hass } = fixture([KITCHEN_JID]);
  hass.states[MAIN].state = "unavailable";
  assert.equal(roomState(config, 0, hass).joined, null);
  assert.throws(() => buildMembershipCall(config, 0, true, hass), /nicht verfügbar/);
  hass.states[MAIN].state = "playing";
  delete hass.states[MAIN].attributes.beolink;
  assert.equal(roomState(config, 0, hass).joined, null);
  assert.throws(() => buildMembershipCall(config, 0, true, hass), /Status fehlt/);
});
test("A Mozart following another leader cannot silently control that other group", () => {
  const { hass } = fixture([KITCHEN_JID]);
  hass.states[MAIN].attributes.beolink.leader = { Level: LEVEL_JID };
  assert.equal(groupState(hass, MAIN).follower, true);
  assert.equal(roomState(config, 0, hass).joined, null);
  assert.throws(() => buildMembershipCall(config, 0, true, hass), /folgt einem anderen/);
});
test("Self, duplicate and malformed member JIDs cannot issue group actions", () => {
  const { hass } = fixture();
  for (const jid of [MAIN_JID, "invalid"]) {
    const candidate = normalizeConfig({ ...config, members: [{ jid }] });
    assert.throws(() => buildMembershipCall(candidate, 0, true, hass));
  }
  const duplicate = normalizeConfig({ ...config, members: [{ jid: KITCHEN_JID }, { jid: KITCHEN_JID }] });
  assert.throws(() => buildMembershipCall(duplicate, 0, true, hass), /doppelt/);
});
test("Mozart can be matched by exact self JID; ASE is never guessed from a similar name", () => {
  const { hass } = fixture();
  assert.equal(matchingMozartEntity(hass, LEVEL_JID), LEVEL);
  assert.equal(matchingMozartEntity(hass, KITCHEN_JID), "");
  assert.equal(roomState({ ...config, members: [{ entity: LEVEL }] }, 0, hass).jid, LEVEL_JID);
});
test("A mismatched Mozart volume entity is detected", () => {
  const { hass } = fixture([KITCHEN_JID]);
  const candidate = { ...config, members: [{ jid: KITCHEN_JID, entity: LEVEL }] };
  assert.equal(roomState(candidate, 0, hass).wrongVolume, true);
});
test("Unavailable BeoLink action prevents an invalid request", () => {
  const { hass } = fixture();
  delete hass.services.bang_olufsen.beolink_expand;
  assert.throws(() => buildMembershipCall(config, 0, true, hass), /nicht verfügbar/);
});
test("Artwork accepts HA/http(s) URLs and rejects executable schemes", () => {
  assert.equal(safeImageUrl("/api/media_player_proxy/test", "https://ha.example/"), "https://ha.example/api/media_player_proxy/test");
  assert.equal(safeImageUrl("javascript:alert(1)", "https://ha.example/"), "");
  assert.equal(safeImageUrl("data:text/html,test", "https://ha.example/"), "");
});
test("Partially configured editor rows remain valid without inventing an entity", () => {
  assert.deepEqual(normalizeConfig({}).members, []);
  assert.equal(normalizeConfig({ members: [{}] }).members[0].jid, "");
  assert.throws(() => normalizeConfig({ master: "switch.foo" }));
  assert.throws(() => normalizeConfig({ members: {} }));
});
