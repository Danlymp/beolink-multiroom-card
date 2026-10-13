import test from "node:test";
import assert from "node:assert/strict";
import { fixture, config, MAIN, KITCHEN, LEVEL, KITCHEN_JID, LEVEL_JID } from "./fixtures.mjs";

test("Card and editor DOM, simulated HA callbacks", { skip: !process.env.BO_DOM_MODULE }, async t => {
  const { parseHTML } = await import(process.env.BO_DOM_MODULE);
  const { window } = parseHTML("<html><body></body></html>");
  for (const key of ["document", "HTMLElement", "customElements", "CustomEvent", "Event"]) globalThis[key] = window[key];
  globalThis.location = { origin: "https://homeassistant.example" };
  // LinkeDOM does not implement the select.value setter supplied by real browsers.
  const selectProto = Object.getPrototypeOf(document.createElement("select"));
  if (!Object.getOwnPropertyDescriptor(selectProto, "value")?.set) {
    const getter = Object.getOwnPropertyDescriptor(selectProto, "value")?.get;
    Object.defineProperty(selectProto, "value", {
      configurable: true,
      get() { return getter ? getter.call(this) : [...this.options].find(item => item.selected)?.value || ""; },
      set(value) { for (const option of this.options) option.toggleAttribute("selected", option.value === value); }
    });
  }
  await import("../dist/beolink-multiroom-card.js");
  assert.ok(customElements.get("beolink-multiroom-card-editor"));
  assert.ok(globalThis.customCards.some(card => card.name === "B&O Multiroom"));
  const card = document.createElement("beolink-multiroom-card");
  t.after(() => card.remove());
  document.body.append(card);
  card.setConfig(config);
  let data = fixture(); card.hass = data.hass;
  const kitchen = card._rooms[0]; const bedroom = card._rooms[1];
  assert.equal(kitchen.toggle.checked, false);
  assert.equal(kitchen.volume.element.hidden, true);
  assert.equal(kitchen.row.hidden, true);
  assert.equal(bedroom.row.hidden, true);
  assert.equal(card._ui.roomsToggle.getAttribute("aria-expanded"), "false");
  card._ui.roomsToggle.click();
  assert.equal(kitchen.row.hidden, false); assert.equal(bedroom.row.hidden, false);
  assert.equal(data.calls.length, 0, "opening the list sends no service call");
  // User flips a real native switch; no optimistic joined state before HA confirms.
  kitchen.toggle.checked = true;
  kitchen.toggle.dispatchEvent(new Event("change"));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(data.calls.length, 1);
  assert.equal(data.calls[0].service, "beolink_expand");
  assert.equal(data.calls[0].data.entity_id, MAIN);
  assert.equal(kitchen.toggle.checked, false);
  assert.equal(kitchen.toggle.disabled, true);
  assert.match(kitchen.state.textContent, /Verbinden/);
  card._ui.roomsToggle.click();
  assert.equal(kitchen.row.hidden, false, "pending joins stay visible when collapsed");
  assert.equal(bedroom.row.hidden, true);
  assert.equal(data.calls.length, 1, "collapsing does not affect membership");
  const connected = fixture([KITCHEN_JID]);
  connected.hass.callService = data.hass.callService;
  card.hass = connected.hass;
  assert.equal(kitchen.toggle.checked, true);
  assert.equal(kitchen.toggle.disabled, false);
  assert.equal(kitchen.volume.element.hidden, false);
  assert.equal(kitchen.row.hidden, false, "confirmed room remains visible when collapsed");
  assert.equal(bedroom.toggle.checked, false);
  assert.equal(data.calls.length, 1, "joining must not alter any volume");
  // Volume slider targets the kitchen's Beoplay entity, not the Mozart master.
  kitchen.volume.input.value = "37";
  kitchen.volume.input.dispatchEvent(new Event("input"));
  assert.equal(kitchen.volume.output.textContent, "37 %");
  assert.equal(data.calls.length, 1, "drag must not flood HA with actions");
  kitchen.volume.input.dispatchEvent(new Event("change"));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(data.calls.at(-1), { domain: "media_player", service: "volume_set", data: { entity_id: KITCHEN, volume_level: 0.37 } });
  // Off uses unexpand and confirmation restores the native switch.
  kitchen.toggle.checked = false; kitchen.toggle.dispatchEvent(new Event("change"));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(data.calls.at(-1).service, "beolink_unexpand");
  assert.equal(kitchen.toggle.checked, true);
  card.hass = data.hass;
  assert.equal(kitchen.toggle.checked, false);
  assert.equal(kitchen.volume.element.hidden, true);
  assert.equal(kitchen.row.hidden, true, "unjoined room disappears from the collapsed view after confirmation");
  // External B&O app changes update both on and off without any action call.
  const previousCount = data.calls.length;
  card.hass = fixture([KITCHEN_JID, LEVEL_JID]).hass;
  assert.equal(kitchen.toggle.checked, true);
  assert.equal(bedroom.toggle.checked, true);
  assert.equal(kitchen.row.hidden, false); assert.equal(bedroom.row.hidden, false);
  assert.equal(data.calls.length, previousCount);
  // Explicit service rejection is shown; the switch is usable again.
  const failure = fixture();
  failure.hass.callService = async () => { throw new Error("Quelle nicht teilbar"); };
  card.hass = failure.hass;
  await card._toggle(0, true);
  assert.match(card._ui.error.textContent, /Quelle nicht teilbar/);
  assert.equal(kitchen.toggle.disabled, false);
  assert.equal(kitchen.toggle.checked, false);
  // Successful HTTP/service completion alone is not treated as a joined room.
  card.hass = fixture().hass;
  await card._toggle(0, true);
  card._pending.get("0").deadline = Date.now() - 1;
  card._update();
  assert.match(card._ui.error.textContent, /keine Bestätigung/);
  assert.equal(kitchen.toggle.checked, false);
  // Text from entities/config cannot become markup.
  card.setConfig({ ...config, name: '<img src=x onerror="alert(1)">' });
  card.hass = fixture().hass;
  assert.match(card._ui.name.textContent, /<img/);
  assert.equal(card._ui.name.children.length, 0);
  // Rebuilding the card in the editor must retain an unchanged album cover.
  const artwork = fixture();
  artwork.hass.states[MAIN].attributes.entity_picture = "/local/cover.jpg";
  card.hass = artwork.hass;
  assert.equal(card._ui.image.hidden, false);
  card.setConfig({ ...config, name: "Wohnzimmer" });
  assert.equal(card._ui.image.hidden, false);
  assert.equal(card._ui.image.getAttribute("src"), "https://homeassistant.example/local/cover.jpg");
  // Editor lifecycle + main selector, repeatable rows, exact JIDs and volume mapping.
  const editor = document.createElement("beolink-multiroom-card-editor");
  document.body.append(editor);
  const editData = fixture(); editor.hass = editData.hass;
  editor.setConfig({ master: MAIN, members: [] });
  let emitted;
  editor.addEventListener("config-changed", event => { emitted = event.detail.config; });
  const add = editor.shadowRoot.querySelector("button.add"); add.click();
  assert.equal(editor._memberRows.length, 1);
  assert.equal(emitted.members.length, 1);
  const row = editor._memberRows[0];
  row.peer.value = KITCHEN_JID; row.peer.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[0].jid, KITCHEN_JID);
  assert.equal(emitted.members[0].entity, "", "ASE entity requires explicit user selection");
  row.entity.value = KITCHEN; row.entity.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[0].entity, KITCHEN);
  row.name.value = "Küche"; row.name.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[0].name, "Küche");
  editor.shadowRoot.querySelector("button.add").click();
  assert.equal(editor._memberRows.length, 2);
  const room2 = editor._memberRows[1];
  room2.peer.value = LEVEL_JID; room2.peer.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[1].entity, "media_player.level");
  editor._move(1, -1);
  assert.equal(emitted.members[0].jid, LEVEL_JID);
  editor._remove(0);
  assert.equal(emitted.members[0].jid, KITCHEN_JID);
  assert.equal(editData.calls.length, 0, "editing must not send audio actions");
  // Factory model selection affects artwork only and preserves uploaded files.
  editor.setConfig({ ...config, master_image: "/local/old-main.png", master_image_dark: "/local/old-main-dark.png" });
  editor.hass = editData.hass;
  editor._masterPhoto.modelSelect.value = "beosound-balance";
  editor._masterPhoto.modelSelect.dispatchEvent(new Event("change"));
  assert.equal(emitted.master_model, "beosound-balance");
  assert.equal(emitted.master_image, "/local/old-main.png");
  assert.match(editor._masterPhoto.picture.image.src, /^data:image\/svg\+xml/);
  assert.ok(decodeURIComponent(editor._masterPhoto.dark.picture.image.src).includes("#F4F6F7"));
  editor._memberRows[0].photo.modelSelect.value = "beolab-8";
  editor._memberRows[0].photo.modelSelect.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[0].model, "beolab-8");
  card.setConfig(emitted);
  card.hass = { ...editData.hass, themes: { darkMode: false } };
  assert.ok(decodeURIComponent(card._mainPicture.image.src).includes("#263238"));
  card.hass = { ...editData.hass, themes: { darkMode: true } };
  assert.ok(decodeURIComponent(card._mainPicture.image.src).includes("#F4F6F7"));
  assert.ok(decodeURIComponent(card._rooms[0].picture.image.src).includes("#F4F6F7"));
  editor._masterPhoto.modelSelect.value = "";
  editor._masterPhoto.modelSelect.dispatchEvent(new Event("change"));
  assert.equal(emitted.master_image, "/local/old-main.png");
  assert.match(editor._masterPhoto.picture.image.src, /old-main\.png$/);
  assert.equal(editData.calls.length, 0, "selecting artwork sends no playback or upload actions");
  editor.setConfig({ ...config, master_model: "beosound-balance" });
  editor._changeMain(LEVEL);
  assert.equal(editor._config.master_model, "", "a different player does not inherit the old model");
  editor.setConfig({ ...config, members: [{ ...config.members[0], model: "beolab-8" }] });
  editor._changeMember(0, { jid: LEVEL_JID });
  assert.equal(editor._config.members[0].model, "");
  editor.setConfig(config);
  // A state update must not discard user configuration.
  editor.hass = fixture([KITCHEN_JID]).hass;
  assert.equal(editor._config.members[0].entity, KITCHEN);
  // A freshly loaded editor retains card layout fields and manual JID.
  editor.setConfig({ ...emitted, grid_options: { columns: 12 } });
  editor._add();
  assert.deepEqual(editor._config.grid_options, { columns: 12, rows: "auto" });

  // New player controls use native events, exact sources and all four stored slots.
  const playerData = fixture();
  // All visibility combinations survive the editor and keep the selected rooms,
  // image and layout. Changing display settings must not send playback actions.
  const withImages = { ...config, master_image: "/local/beolab.png", master_image_dark: "/local/beolab-dark.png", grid_options: { columns: 12 },
    members: config.members.map(member => ({ ...member, image: "/local/room.png", image_dark: "/local/room-dark.png" })) };
  for (const [showSource, showFavorites] of [[false, true], [true, false], [false, false], [true, true]]) {
    editor.setConfig(withImages); editor.hass = playerData.hass;
    for (const [key, value] of [["show_source", showSource], ["show_favorites", showFavorites]]) {
      const toggle = editor.shadowRoot.querySelector('[data-config="' + key + '"]');
      toggle.checked = value; toggle.dispatchEvent(new Event("change"));
    }
    editor.setConfig(emitted);
    assert.equal(editor.shadowRoot.querySelector('[data-config="show_source"]').checked, showSource);
    assert.equal(editor.shadowRoot.querySelector('[data-config="show_favorites"]').checked, showFavorites);
    assert.deepEqual(emitted.members, withImages.members);
    assert.equal(emitted.master_image, withImages.master_image);
    assert.equal(emitted.master_image_dark, withImages.master_image_dark);
    assert.deepEqual(emitted.grid_options, { ...withImages.grid_options, rows: "auto" });
    card.setConfig(emitted); card.hass = playerData.hass;
    assert.equal(card._ui.sourceField.hidden, !showSource);
    assert.equal(card._ui.favorites.hidden, !showFavorites);
    card.hass = fixture([KITCHEN_JID]).hass;
    assert.equal(card._ui.sourceField.hidden, !showSource, "HA updates retain visibility");
    assert.equal(card._ui.favorites.hidden, !showFavorites);
  }
  assert.equal(playerData.calls.length, 0);
  // Existing saved cards with no new keys still show both controls.
  card.setConfig({ ...config, master_image: "/local/beolab.png", members: config.members.map((member, i) => ({ ...member, image: i === 0 ? "/local/kitchen.png" : "" })) });
  card.hass = playerData.hass;
  assert.equal(card._ui.sourceField.hidden, false);
  assert.equal(card._ui.favorites.hidden, false);
  for (const [index, favorite] of card._ui.favoriteButtons.entries()) {
    assert.equal(favorite.querySelectorAll("circle").length, index + 1);
    assert.equal(favorite.querySelector("ha-icon"), null);
    assert.equal(favorite.getAttribute("aria-label"), "Favorit " + (index + 1) + " starten");
  }
  assert.equal(card._ui.sourceSelect.value, "Deezer");
  card._ui.sourceSelect.value = "Line-in";
  card._ui.sourceSelect.dispatchEvent(new Event("change"));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(playerData.calls.at(-1), { domain: "media_player", service: "select_source", data: { entity_id: MAIN, source: "Line-in" } });
  assert.equal(card._ui.sourceSelect.value, "Deezer", "display waits for HA source state");
  playerData.hass.states[MAIN].attributes.source = "Line-in"; card.hass = playerData.hass;
  assert.equal(card._ui.sourceSelect.value, "Line-in");
  assert.equal(card._ui.favoriteButtons.length, 4);
  for (const [index, favorite] of card._ui.favoriteButtons.entries()) {
    favorite.click(); await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(playerData.calls.at(-1), { domain: "media_player", service: "play_media", data: { entity_id: MAIN, media_content_type: "favourite", media_content_id: String(index + 1) } });
  }
  playerData.hass.states[MAIN].attributes.source = "Spotify"; card.hass = playerData.hass;
  assert.equal(card._ui.sourceSelect.value, "Spotify");
  assert.equal([...card._ui.sourceSelect.options].find(option => option.value === "Spotify").disabled, true, "unselectable current sources remain visible");
  playerData.hass.states[MAIN].state = "unavailable"; card.hass = playerData.hass;
  assert.equal(card._ui.sourceSelect.disabled, true);
  assert.ok(card._ui.favoriteButtons.every(button => button.disabled));

  // Configured speaker photos are separate from cover art and fail back to icons.
  const photo = card._rooms[0].picture;
  assert.match(photo.image.getAttribute("src"), /kitchen.png$/);
  assert.match(card._mainPicture.image.getAttribute("src"), /beolab.png$/);
  photo.image.dispatchEvent(new Event("load"));
  assert.equal(photo.fallback.hidden, true);
  photo.image.dispatchEvent(new Event("error"));
  assert.equal(photo.image.hidden, true); assert.equal(photo.fallback.hidden, false);
  assert.equal(card._rooms[1].picture.image.hidden, true);
  assert.equal(card._rooms[1].picture.fallback.hidden, false);

  // Direct editor upload persists the returned image path, not file bytes/tokens.
  const file = new File([new Uint8Array([1, 2, 3])], "speaker.png", { type: "image/png" });
  const uploadedPath = "/api/image/serve/" + "b".repeat(32) + "/256x256";
  const imageData = fixture(); let uploadCalls = 0;
  imageData.hass.fetchWithAuth = async (path, options) => {
    uploadCalls++; assert.equal(path, "/api/image/upload");
    assert.equal(options.body.get("file").name, "speaker.png");
    return { status: 200, json: async () => ({ id: "b".repeat(32) }) };
  };
  editor.hass = imageData.hass;
  Object.defineProperty(editor._masterPhoto.file, "files", { value: [file], configurable: true });
  editor._masterPhoto.file.dispatchEvent(new Event("change"));
  assert.equal(editor._fieldset.disabled, true);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(uploadCalls, 1); assert.equal(editor._fieldset.disabled, false);
  assert.equal(emitted.master_image, uploadedPath);
  editor._masterPhoto.remove.click(); assert.equal(emitted.master_image, "");
  editor._memberRows[0].photo.input.value = "/local/kitchen.png";
  editor._memberRows[0].photo.input.dispatchEvent(new Event("change"));
  assert.equal(emitted.members[0].image, "/local/kitchen.png");
  imageData.hass.fetchWithAuth = async () => ({ status: 403 });
  await editor._uploadPhoto(0, file);
  assert.match(editor._uploadNotice.textContent, /Berechtigung/);
  assert.equal(editor._config.members[0].image, "/local/kitchen.png");
  assert.equal(editor._fieldset.disabled, false);
  // A late upload must not attach to a different room after an external config update.
  let finishUpload;
  imageData.hass.fetchWithAuth = () => new Promise(resolve => { finishUpload = resolve; });
  const pendingUpload = editor._uploadPhoto(0, file);
  editor.setConfig({ master: MAIN, members: [{ jid: LEVEL_JID, entity: "media_player.level" }] });
  finishUpload({ status: 200, json: async () => ({ id: "c".repeat(32) }) });
  await pendingUpload;
  assert.equal(editor._config.members[0].image, "");
  assert.match(editor._uploadNotice.textContent, /Zuordnung|zuordnung/);
  // New group controls follow HA membership and include the leader.
  card.setConfig(config);
  const controls = fixture([KITCHEN_JID]);
  controls.hass.callService = async (domain, service, payload) => {
    controls.calls.push({ domain, service, data: payload });
    const ids = Array.isArray(payload.entity_id) ? payload.entity_id : [payload.entity_id];
    if (service === "volume_set") for (const id of ids) controls.hass.states[id].attributes.volume_level = payload.volume_level;
    if (service === "volume_mute") for (const id of ids) controls.hass.states[id].attributes.is_volume_muted = payload.is_volume_muted;
    if (service === "turn_off") {
      for (const id of ids) controls.hass.states[id].state = "off";
      delete controls.hass.states[MAIN].attributes.beolink.listeners;
      controls.hass.states[MAIN].attributes.group_members = [];
    }
    if (service === "media_play") controls.hass.states[MAIN].state = "playing";
    if (service === "beolink_expand") {
      controls.hass.states[MAIN].attributes.beolink.listeners = { Küche: KITCHEN_JID };
      controls.hass.states[MAIN].attributes.group_members = [MAIN, "listener_not_in_hass-" + KITCHEN_JID];
      controls.hass.states[KITCHEN].state = "playing";
    }
    card.hass = controls.hass;
  };
  card.hass = controls.hass;
  assert.equal(card._ui.groupControls.hidden, false);
  assert.equal(card.shadowRoot.querySelector(".toggle-text"), null);
  assert.equal(card._mainVolume.input.style.getPropertyValue("--volume-fill"), "32%");
  card._powerBusy = true; card._update();
  assert.equal(card._groupVolume.input.disabled, true, "power and volume commands must not overlap");
  card._powerBusy = false; card._update();
  assert.equal(card._groupVolume.input.disabled, false);
  card._groupVolume.input.dispatchEvent(new Event("pointerdown"));
  card._groupVolume.input.value = "40"; card._groupVolume.input.dispatchEvent(new Event("input"));
  await card._groupVolume._commit();
  assert.equal(controls.hass.states[MAIN].attributes.volume_level, .44);
  assert.equal(controls.hass.states[KITCHEN].attributes.volume_level, .36);
  await card._groupMute();
  assert.equal(card._ui.groupMute.getAttribute("aria-pressed"), "true");
  await card._groupMute();
  assert.equal(card._ui.groupMute.getAttribute("aria-pressed"), "false");
  await card._groupPower();
  assert.deepEqual(controls.calls.at(-1).data.entity_id, [MAIN, KITCHEN]);
  assert.equal(card._ui.groupControls.hidden, false, "retain a way to restore the just-stopped group");
  assert.equal(card._ui.groupPower.getAttribute("aria-label"), "Letzte Gruppe einschalten");
  await card._groupPower();
  assert.equal(controls.calls.at(-2).service, "media_play");
  assert.equal(controls.calls.at(-1).service, "beolink_expand");
  assert.deepEqual(controls.calls.at(-1).data.beolink_jids, [KITCHEN_JID]);
  assert.equal(card._groupRecall, null);
  await card._mainPower();
  assert.deepEqual(controls.calls.at(-1), { domain: "media_player", service: "turn_off", data: { entity_id: MAIN } });
  await card._mainPower();
  assert.equal(controls.calls.at(-1).service, "media_play");
  assert.equal(card._ui.groupControls.hidden, true);

  // A mid-request membership change stops subsequent volume calls.
  const changing = fixture([KITCHEN_JID]);
  changing.hass.callService = async (domain, service, payload) => {
    changing.calls.push({ domain, service, data: payload });
    delete changing.hass.states[MAIN].attributes.beolink.listeners;
    changing.hass.states[MAIN].attributes.group_members = [];
    card.hass = changing.hass;
  };
  card.hass = changing.hass;
  assert.equal(await card._setGroupVolume(40), false);
  assert.equal(changing.calls.length, 1);
  assert.equal(changing.calls[0].data.entity_id, MAIN);
  assert.match(card._ui.error.textContent, /geändert/);

  // Uploaded images can be reused by another editor; imports never send audio actions.
  editor.setConfig(config);
  const library = fixture();
  const catalog = [{ id: "d".repeat(32), name: "Helles_Dashboard/Level.png" }];
  library.hass.callWS = async request => { assert.equal(request.type, "image/list"); return catalog; };
  let imageImports = 0;
  library.hass.fetchWithAuth = async (_, options) => {
    imageImports++;
    const item = { id: String(imageImports).padStart(32, "0"), name: options.body.get("file").name };
    catalog.push(item); return { status: 200, json: async () => item };
  };
  editor.hass = library.hass;
  await editor._openLibrary(0, "Küche");
  editor._galleryGrid.querySelector("button").click();
  assert.equal(emitted.members[0].image, "/api/image/serve/" + "d".repeat(32) + "/256x256");
  const folderFile = new File([new Uint8Array([1])], "A5.png", { type: "image/png" });
  Object.defineProperty(folderFile, "webkitRelativePath", { value: "Helles_Dashboard/A5.png" });
  await editor._importImages([folderFile, new File(["<svg/>"], "A5.svg", { type: "image/svg+xml" })]);
  assert.equal(imageImports, 1); assert.equal(catalog.at(-1).name, "Helles_Dashboard/A5.png");
  assert.match(editor._uploadNotice.textContent, /1 Bilder auf HA gespeichert/);
  assert.equal(editor._fieldset.disabled, false);
  await editor._openLibrary(0, "Küche");
  editor.setConfig({ master: MAIN, members: [{ jid: LEVEL_JID, entity: "media_player.level" }] });
  editor._galleryGrid.querySelector("button").click();
  assert.equal(editor._config.members[0].image, "");
  assert.match(editor._galleryStatus.textContent, /Zuordnung|zuordnung/);
  assert.equal(library.calls.length, 0);

  // HA theme changes swap the selected images without modifying membership or playing audio.
  const themed = fixture([KITCHEN_JID]); themed.hass.themes = { darkMode: false };
  card.setConfig({ ...withImages, group_name: "Musik im ganzen Haus" }); card.hass = themed.hass;
  assert.match(card._mainPicture.image.src, /beolab\.png$/);
  assert.match(card._rooms[0].picture.image.src, /room\.png$/);
  themed.hass.themes = { darkMode: true }; card.hass = themed.hass;
  assert.match(card._mainPicture.image.src, /beolab-dark\.png$/);
  assert.match(card._rooms[0].picture.image.src, /room-dark\.png$/);
  assert.equal(card._rooms[0].toggle.checked, true);
  assert.equal(card._ui.groupHeading.textContent, "Musik im ganzen Haus");
  assert.equal(card.shadowRoot.querySelector(".group-note"), null);
  assert.equal(themed.calls.length, 0);

  // Width changes leave the main player's height and all speaker settings intact.
  editor.hass = themed.hass;
  editor.setConfig({ ...withImages, grid_options: { columns: 24, rows: "auto" } });
  const groupTitle = editor.shadowRoot.querySelector('[data-config="group_name"]');
  groupTitle.value = "  Zuhause  "; groupTitle.dispatchEvent(new Event("change"));
  assert.deepEqual(emitted.grid_options, { columns: 24, rows: "auto" });
  editor.setConfig(emitted);
  assert.equal(editor.shadowRoot.querySelector('[data-config="group_name"]').value, "Zuhause");
  assert.equal(editor._config.master_image_dark, withImages.master_image_dark);
  const originalHeight = editor._config.player_height;
  const widthChoice = editor.shadowRoot.querySelector('.width-choice[data-columns="18"]');
  widthChoice.click();
  assert.deepEqual(emitted.grid_options, { columns: 18, rows: "auto" });
  assert.equal(emitted.player_height, originalHeight);
  assert.equal(emitted.master_image_dark, withImages.master_image_dark);
  editor.shadowRoot.querySelector('.width-choice[data-columns="full"]').click();
  assert.deepEqual(emitted.grid_options, { columns: "full", rows: "auto" });
  assert.equal(emitted.player_height, originalHeight);
  editor.setConfig({ ...withImages, player_height: 800, grid_options: { columns: 24, rows: 2 } });
  editor.shadowRoot.querySelector('[data-action="apply-size"]').click();
  assert.deepEqual(emitted.grid_options, { columns: 24, rows: "auto" });
  assert.equal(emitted.player_height, 800, "size correction preserves a deliberately enlarged player");
  assert.deepEqual(emitted.members, withImages.members);
  assert.equal(emitted.master_image_dark, withImages.master_image_dark);
  assert.equal(editor.shadowRoot.querySelector(".source-hint").textContent, "Zum Hinzufügen von Räumen zuerst eine BeoLink-fähige Quelle auf dem Hauptspieler starten.");
  assert.equal(card._ui.wrap.textContent.includes("Zum Hinzufügen von Räumen zuerst"), false);
  assert.equal(themed.calls.length, 0);

  // The same uploaded library serves both themes. Picking dark does not replace light.
  const imageId = "e".repeat(32); const imageUrl = "/api/image/serve/" + imageId + "/256x256";
  const imageList = [{ id: imageId, name: "Dunkles_Dashboard/Beolab_8.png" }];
  const imageRequests = []; let rejectDelete = false;
  themed.hass.callWS = async request => {
    imageRequests.push(request);
    if (request.type === "image/list") return imageList;
    assert.deepEqual(request, { type: "image/delete", image_id: imageId });
    if (rejectDelete) throw new Error("Keine Berechtigung");
    imageList.splice(0); return null;
  };
  editor.hass = themed.hass;
  await editor._openLibrary(null, "Hauptspieler", "dark");
  editor._galleryGrid.querySelector(".gallery-choice").click();
  assert.equal(editor._config.master_image, withImages.master_image);
  assert.equal(editor._config.master_image_dark, imageUrl);
  await editor._openLibrary(0, "Küche", "dark");
  editor._galleryGrid.querySelector(".gallery-choice").click();
  assert.equal(editor._config.members[0].image, withImages.members[0].image);
  assert.equal(editor._config.members[0].image_dark, imageUrl);

  // Opening/cancelling deletion has no effect; failure keeps configuration; success clears exact references.
  await editor._openImageManager();
  editor._galleryGrid.querySelector(".image-delete").click();
  assert.equal(editor._deleteConfirm.hidden, false);
  assert.match(editor._deleteConfirm.textContent, /anderen Stellen/);
  assert.equal(imageRequests.filter(r => r.type === "image/delete").length, 0);
  editor._deleteConfirm.querySelector(".cancel-delete").click();
  assert.equal(editor._deletePending, null);
  editor._galleryGrid.querySelector(".image-delete").click();
  rejectDelete = true; await editor._deleteImage();
  assert.equal(editor._config.master_image_dark, imageUrl);
  assert.equal(editor._images.length, 1);
  assert.match(editor._galleryStatus.textContent, /Keine Berechtigung/);
  rejectDelete = false; await editor._deleteImage();
  assert.equal(editor._config.master_image_dark, "");
  assert.equal(editor._config.members[0].image_dark, "");
  assert.equal(editor._config.master_image, withImages.master_image);
  assert.equal(editor._config.members[0].image, withImages.members[0].image);
  assert.equal(editor._images.length, 0);
  assert.equal(themed.calls.length, 0);

  // Sizing edits persist without changing pictures, group identity or audio.
  editor.setConfig({ ...withImages, group_name: "Zuhause", grid_options: { columns: "full", rows: 2 } });
  const playerHeight = editor.shadowRoot.querySelector('[data-config="player_height"]');
  playerHeight.value = "700"; playerHeight.dispatchEvent(new Event("input"));
  assert.equal(editor._config.player_height, 560, "drag updates the readout before committing configuration");
  playerHeight.dispatchEvent(new Event("change"));
  assert.equal(emitted.player_height, 700);
  assert.equal(emitted.master_image_dark, withImages.master_image_dark);
  assert.equal(emitted.group_name, "Zuhause");
  assert.deepEqual(emitted.grid_options, { columns: "full", rows: "auto" });
  card.setConfig(emitted); card.hass = themed.hass;
  assert.equal(card.hasAttribute("data-expanded-player"), true);
  assert.equal(card.style.getPropertyValue("--bo-player-height"), "700px");
  editor.setConfig({ ...emitted, grid_options: { columns: 24, rows: "auto" } });
  assert.equal(editor.shadowRoot.querySelector('[data-config="player_height"]').value, "700");
  assert.equal(themed.calls.length, 0);

  // A configurable inactivity timeout must survive HA polling without closing
  // on a held control or an unconfirmed join.
  const delay = editor.shadowRoot.querySelector('[data-config="auto_close_seconds"]');
  assert.equal(delay.value, "5");
  delay.value = "9"; delay.dispatchEvent(new Event("change"));
  assert.equal(emitted.auto_close_seconds, 9);
  assert.equal(emitted.player_height, 700);
  assert.equal(emitted.grid_options.columns, 24);
  delay.value = "1.5"; delay.dispatchEvent(new Event("change"));
  assert.equal(delay.value, "9", "invalid delays keep the previous value");
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  t.after(() => t.mock.timers.reset());
  card.setConfig({ ...config, auto_close_seconds: 5 });
  const idleData = fixture([KITCHEN_JID]); card.hass = idleData.hass;
  card._ui.roomsToggle.click(); t.mock.timers.tick(4900);
  assert.equal(card._roomsExpanded, true);
  card.hass = idleData.hass; t.mock.timers.tick(100);
  assert.equal(card._roomsExpanded, false, "HA polling does not postpone closing");
  assert.equal(card._rooms[0].row.hidden, false, "connected rooms stay visible after timeout");
  assert.equal(card._rooms[1].row.hidden, true);
  card._ui.roomsToggle.click(); t.mock.timers.tick(4000);
  card._ui.roomList.dispatchEvent(new Event("wheel", { bubbles: true }));
  t.mock.timers.tick(4000); assert.equal(card._roomsExpanded, true, "interaction restarts the full delay");
  t.mock.timers.tick(1000); assert.equal(card._roomsExpanded, false);
  card._ui.roomsToggle.click();
  const down = new Event("pointerdown", { bubbles: true }); down.pointerId = 21;
  card._rooms[0].volume.input.dispatchEvent(down);
  t.mock.timers.tick(8000); assert.equal(card._roomsExpanded, true, "a held volume control keeps the list open");
  const up = new Event("pointerup"); up.pointerId = 21; window.dispatchEvent(up);
  t.mock.timers.tick(4999); assert.equal(card._roomsExpanded, true);
  t.mock.timers.tick(1); assert.equal(card._roomsExpanded, false);
  card._ui.roomsToggle.click(); await card._toggle(1, true);
  t.mock.timers.tick(6000); card._update();
  assert.equal(card._roomsExpanded, true, "pending membership blocks automatic closing");
  const confirmed = fixture([KITCHEN_JID, LEVEL_JID]); confirmed.hass.callService = idleData.hass.callService;
  card.hass = confirmed.hass;
  t.mock.timers.tick(4999); assert.equal(card._roomsExpanded, true);
  t.mock.timers.tick(1); assert.equal(card._roomsExpanded, false, "full delay starts after confirmation");
  assert.equal(idleData.calls.length, 1, "only the explicit join sends an audio request");
  card.setConfig({ ...config, auto_close_seconds: 0 }); card._ui.roomsToggle.click();
  t.mock.timers.tick(30000); assert.equal(card._roomsExpanded, true, "zero disables automatic closing");
  card.setConfig({ ...config, auto_close_seconds: 5 }); card.remove();
  t.mock.timers.tick(10000); assert.equal(card._roomsExpanded, true, "disconnect cancels the timer");
  card.remove(); editor.remove();
  assert.equal(card._timer, null);
});
