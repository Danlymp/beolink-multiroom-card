/**
 * B&O Multiroom Card 0.10.0
 * Local, dependency-free Home Assistant custom card.
 * Main player: official Bang & Olufsen integration (Mozart).
 * Membership: bang_olufsen.beolink_expand / beolink_unexpand with explicit JID.
 * Volume: independently selected media_player entity (Mozart or Beoplay).
 */
export const VERSION = "0.10.0";
// Replaced by scripts/build.mjs; the distributed card contains every SVG.
export const BUILTIN_SPEAKERS = Object.freeze(/* BUILTIN_SPEAKERS */ [].map(item => Object.freeze(item)));
const builtInSpeakers = new Map(BUILTIN_SPEAKERS.map(item => [item.id, item]));
const builtInImageUrls = new Map();
export const MIN_PLAYER_HEIGHT = 560;
const MIN_GRID_ROWS = 11;
const TYPE = "beolink-multiroom-card";
const TIMEOUT = 15000;
const FEATURES = { PAUSE: 1, VOLUME: 4, MUTE: 8, PREVIOUS: 16, NEXT: 32, TURN_ON: 128, TURN_OFF: 256, PLAY_MEDIA: 512, SELECT_SOURCE: 2048, PLAY: 16384 };
const BaseElement = globalThis.HTMLElement || class {};
export const isJid = value =>
  typeof value === "string" && /^\d+\.\d+\.\d+@products\.bang-olufsen\.com$/i.test(value.trim());
const mediaId = value => typeof value === "string" && /^media_player\.[a-z0-9_]+$/.test(value);
const available = state => Boolean(state && !["unavailable", "unknown"].includes(state.state));
const supports = (state, feature) => Boolean(Number(state?.attributes?.supported_features || 0) & feature);
const volumeOf = state => {
  const value = state?.attributes?.volume_level;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.min(1, Math.max(0, value)) * 100) : null;
};
const displayName = (state, fallback) => state?.attributes?.friendly_name || fallback || "Lautsprecher";
const powered = state => available(state) && !["off", "standby"].includes(state.state);

/** Official HA shape: { "friendly name": "type.item.serial@products..." }. */
export function beolinkEntries(value) {
  const result = new Map();
  const add = (name, jid) => {
    if (isJid(jid)) result.set(jid.trim(), { name: String(name || jid), jid: jid.trim() });
  };
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string") add(entry, entry);
      else if (entry && typeof entry === "object") add(entry.friendly_name || entry.friendlyName || entry.name, entry.jid);
    }
  } else if (value && typeof value === "object") {
    if (isJid(value.jid)) add(value.friendly_name || value.friendlyName || value.name, value.jid);
    else for (const [name, entry] of Object.entries(value)) {
      if (typeof entry === "string") add(name, entry);
      else if (entry && typeof entry === "object") add(entry.friendly_name || entry.name || name, entry.jid);
    }
  }
  return [...result.values()];
}
export const selfJid = state => beolinkEntries(state?.attributes?.beolink?.self)[0]?.jid || "";

export function groupState(hass, masterId) {
  const state = hass?.states?.[masterId];
  const own = selfJid(state);
  const link = state?.attributes?.beolink;
  const leaders = beolinkEntries(link?.leader);
  const follower = leaders.some(item => item.jid !== own);
  const known = available(state) && Boolean(own);
  const members = new Set(beolinkEntries(link?.listeners).map(item => item.jid));
  // HA includes listener_not_in_hass-JID for ASE devices in group_members.
  // This also covers listeners omitted from the peers/name mapping.
  if (known && !follower) {
    const groups = Array.isArray(state?.attributes?.group_members) ? state.attributes.group_members : [];
    for (const member of groups) {
      if (typeof member !== "string" || member === masterId) continue;
      const marker = "listener_not_in_hass-";
      const jid = member.startsWith(marker) ? member.slice(marker.length) : selfJid(hass?.states?.[member]);
      if (isJid(jid) && jid !== own) members.add(jid);
    }
  }
  return { state, own, known, follower, leader: leaders[0], members };
}
export function discoveredPeers(hass, masterId) {
  const master = hass?.states?.[masterId];
  const own = selfJid(master);
  const result = new Map();
  for (const item of [
    ...beolinkEntries(master?.attributes?.beolink?.peers),
    ...beolinkEntries(master?.attributes?.beolink?.listeners)
  ]) if (item.jid !== own) result.set(item.jid, item);
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
}
export const effectiveJid = (member, hass) =>
  member?.jid?.trim() || selfJid(hass?.states?.[member?.entity]) || "";

export function normalizeConfig(config) {
  if (!config || typeof config !== "object") throw new Error("Bitte die Karte konfigurieren.");
  if (config.master && !mediaId(config.master)) throw new Error("Der Hauptspieler muss eine media_player-Entität sein.");
  if (config.members !== undefined && !Array.isArray(config.members)) throw new Error("members muss eine Liste sein.");
  if (config.master_model !== undefined && typeof config.master_model !== "string") throw new Error("master_model muss ein Modellname sein.");
  for (const key of ["show_source", "show_favorites"]) {
    if (config[key] !== undefined && typeof config[key] !== "boolean") throw new Error(key + " muss true oder false sein.");
  }
  if (config.player_height !== undefined && (typeof config.player_height !== "number" || !Number.isFinite(config.player_height) || config.player_height < 0 || config.player_height > 2000)) {
    throw new Error("player_height muss eine Höhe von 0 bis 2000 Pixel sein. Werte unter 560 werden auf die sichere Mindesthöhe angehoben.");
  }
  if (config.auto_close_seconds !== undefined && (!Number.isInteger(config.auto_close_seconds) || config.auto_close_seconds < 0 || config.auto_close_seconds > 300)) {
    throw new Error("auto_close_seconds muss eine ganze Zahl von 0 bis 300 sein; 0 lässt die Lautsprecherauswahl offen.");
  }
  return {
    ...config, type: "custom:" + TYPE,
    master: config.master || "", name: String(config.name || ""), master_image: String(config.master_image || ""),
    master_image_dark: String(config.master_image_dark || ""), group_name: String(config.group_name || "").trim(),
    player_height: Math.max(MIN_PLAYER_HEIGHT, config.player_height ?? MIN_PLAYER_HEIGHT), auto_close_seconds: config.auto_close_seconds ?? 5,
    show_source: config.show_source ?? true, show_favorites: config.show_favorites ?? true,
    members: (config.members || []).map(member => {
      if (!member || typeof member !== "object") throw new Error("Ungültiger Lautsprechereintrag.");
      if (member.model !== undefined && typeof member.model !== "string") throw new Error("model muss ein Modellname sein.");
      return {
        ...member, name: String(member.name || ""), entity: String(member.entity || ""),
        jid: String(member.jid || "").trim(), image: String(member.image || ""), image_dark: String(member.image_dark || "")
      };
    })
  };
}
export function editorSizeConfig(config) {
  const normalized = normalizeConfig(config);
  return { ...normalized, grid_options: {
    columns: config.grid_options?.columns ?? config.layout_options?.grid_columns ?? 12,
    ...(config.grid_options || {}), rows: "auto"
  } };
}
export function coverSizeForSpace(width, height, captionHeight) {
  if (![width, height, captionHeight].every(Number.isFinite) || width <= 0 || height <= 0) return 88;
  return Math.floor(Math.min(width, Math.max(72, height - Math.max(0, captionHeight) - 12)));
}
export function roomState(config, index, hass) {
  const group = groupState(hass, config.master);
  const member = config.members[index] || {};
  const jid = effectiveJid(member, hass);
  const peer = discoveredPeers(hass, config.master).find(item => item.jid === jid);
  const entity = hass?.states?.[member.entity];
  const name = member.name || peer?.name || displayName(entity, "Lautsprecher " + (index + 1));
  const duplicate = isJid(jid) && config.members.some((other, i) => i !== index && effectiveJid(other, hass) === jid);
  const wrongVolume = Boolean(selfJid(entity) && jid && selfJid(entity) !== jid);
  let problem = "";
  if (!config.master) problem = "Hauptspieler auswählen";
  else if (!available(group.state)) problem = "Hauptspieler nicht verfügbar";
  else if (!group.known) problem = "BeoLink-Status fehlt";
  else if (group.follower) problem = "Hauptspieler folgt einem anderen Gerät";
  else if (!isJid(jid)) problem = "BeoLink-Gerät oder gültige JID auswählen";
  else if (jid === group.own) problem = "Hauptspieler ist bereits enthalten";
  else if (duplicate) problem = "Dieser Lautsprecher ist doppelt eingetragen";
  const joined = group.known && !group.follower ? group.members.has(jid) : null;
  const service = joined ? "beolink_unexpand" : "beolink_expand";
  if (!problem && hass?.services && !hass.services.bang_olufsen?.[service]) {
    problem = "BeoLink-Aktion in Home Assistant nicht verfügbar";
  }
  return { ...member, jid, name, entityState: entity, joined, problem, wrongVolume, group };
}
export function buildMembershipCall(config, index, desired, hass) {
  const room = roomState(config, index, hass);
  if (room.problem) throw new Error(room.problem);
  const service = desired ? "beolink_expand" : "beolink_unexpand";
  if (hass?.services && !hass.services.bang_olufsen?.[service]) throw new Error("Die Aktion " + service + " ist nicht verfügbar.");
  if (typeof desired !== "boolean") throw new Error("Ungültiger Schalterzustand.");
  return {
    domain: "bang_olufsen", service,
    data: { entity_id: config.master, beolink_jids: [room.jid] }
  };
}
export function matchingMozartEntity(hass, jid) {
  const matches = Object.entries(hass?.states || {}).filter(([id, state]) => mediaId(id) && selfJid(state) === jid);
  return matches.length === 1 ? matches[0][0] : "";
}
export function safeImageUrl(value, base) {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("beolink-icon:")) {
    const match = /^beolink-icon:([a-z0-9-]+):(light|dark)$/.exec(value);
    const speaker = match && builtInSpeakers.get(match[1]);
    if (!speaker) return "";
    if (!builtInImageUrls.has(value)) {
      const svg = match[2] === "dark" ? speaker.svg.replaceAll("#263238", "#F4F6F7") : speaker.svg;
      builtInImageUrls.set(value, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    }
    return builtInImageUrls.get(value);
  }
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}

export function themeImage(light, dark, hass) {
  // Follow HA's selected mode, including its automatic light/dark setting.
  // The operating-system preference is only a fallback before HA has loaded.
  const darkMode = typeof hass?.themes?.darkMode === "boolean" ? hass.themes.darkMode :
    typeof hass?.selectedTheme?.dark === "boolean" ? hass.selectedTheme.dark :
    Boolean(globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);
  return darkMode && dark ? dark : light || "";
}

export function speakerImage(model, light, dark, hass) {
  return builtInSpeakers.has(model)
    ? themeImage("beolink-icon:" + model + ":light", "beolink-icon:" + model + ":dark", hass)
    : themeImage(light, dark, hass);
}

export function uploadedImageId(value, hass) {
  if (typeof value !== "string" || !value) return "";
  try {
    const base = hass?.hassUrl ? hass.hassUrl("/") : globalThis.location?.origin;
    const url = new URL(value, base);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== new URL(base).origin) return "";
    return url.pathname.match(/^\/api\/image\/serve\/([a-f0-9]{32})(?:\/|$)/i)?.[1] || "";
  } catch { return ""; }
}

export function clearImageReferences(config, id, hass) {
  const clear = value => uploadedImageId(value, hass) === id ? "" : value;
  return { ...config, master_image: clear(config.master_image), master_image_dark: clear(config.master_image_dark),
    members: config.members.map(member => ({ ...member, image: clear(member.image), image_dark: clear(member.image_dark) })) };
}

export function sourceOptions(state) {
  const list = state?.attributes?.source_list;
  return Array.isArray(list) ? [...new Set(list.filter(value => typeof value === "string" && value.trim()))] : [];
}
const hasService = (hass, domain, service) => !hass?.services || Boolean(hass.services[domain]?.[service]);
export function buildSourceCall(config, source, hass) {
  const state = hass?.states?.[config.master];
  if (!available(state)) throw new Error("Hauptspieler nicht verfügbar.");
  if (!supports(state, FEATURES.SELECT_SOURCE) || !hasService(hass, "media_player", "select_source")) throw new Error("Quellenauswahl nicht verfügbar.");
  if (!sourceOptions(state).includes(source)) throw new Error("Diese Quelle wird vom Hauptspieler nicht zur Auswahl angeboten.");
  return { domain: "media_player", service: "select_source", data: { entity_id: config.master, source } };
}
export function buildFavouriteCall(config, slot, hass) {
  const state = hass?.states?.[config.master];
  if (!available(state) || !selfJid(state)) throw new Error("Mozart-Hauptspieler nicht verfügbar.");
  if (!Number.isInteger(slot) || slot < 1 || slot > 4) throw new Error("Bitte Favorit 1 bis 4 auswählen.");
  if (!supports(state, FEATURES.PLAY_MEDIA) || !hasService(hass, "media_player", "play_media")) throw new Error("Favoritenaufruf nicht verfügbar.");
  return { domain: "media_player", service: "play_media", data: { entity_id: config.master, media_content_type: "favourite", media_content_id: String(slot) } };
}
export function buildPowerCall(entityId, on, hass) {
  const state = hass?.states?.[entityId];
  if (!mediaId(entityId) || !available(state)) throw new Error("Lautsprecher nicht verfügbar.");
  let service;
  if (!on && supports(state, FEATURES.TURN_OFF)) service = "turn_off";
  else if (on && supports(state, FEATURES.TURN_ON)) service = "turn_on";
  // Mozart exposes standby and playback, but no TURN_ON feature.
  else if (on && selfJid(state) && supports(state, FEATURES.PLAY)) service = "media_play";
  if (!service || !hasService(hass, "media_player", service)) throw new Error(on ? "Einschalten wird nicht unterstützt." : "Standby wird nicht unterstützt.");
  return { domain: "media_player", service, data: { entity_id: entityId } };
}
export function connectedPlayers(config, hass) {
  const group = groupState(hass, config.master);
  const jids = [...group.members].filter(jid => jid !== group.own).sort();
  const targets = [{ entity: config.master, jid: group.own, name: displayName(group.state, "Hauptspieler"), state: group.state }];
  const missing = []; const used = new Set([config.master]);
  for (const jid of jids) {
    const entries = config.members.filter(member => effectiveJid(member, hass) === jid);
    const peer = discoveredPeers(hass, config.master).find(item => item.jid === jid);
    const name = entries[0]?.name || peer?.name || "Weiterer Lautsprecher";
    let entity = entries.length === 1 ? entries[0].entity : "";
    if (entries.length > 1) { missing.push(name + ": mehrfach eingetragen"); continue; }
    if (!entity) entity = matchingMozartEntity(hass, jid);
    const state = hass?.states?.[entity];
    if (!mediaId(entity) || used.has(entity) || (selfJid(state) && selfJid(state) !== jid)) {
      missing.push(name + ": passende Lautstärke-Entität im Editor auswählen"); continue;
    }
    used.add(entity); targets.push({ entity, jid, name, state });
  }
  const problem = !group.known ? "BeoLink-Status fehlt." : group.follower ? "Der Hauptspieler folgt einem anderen Gerät." : !jids.length ? "Kein weiterer Lautsprecher verbunden." : "";
  const values = targets.map(item => volumeOf(item.state)).filter(value => value !== null);
  return { group, targets, missing, jids, problem, mean: values.length === targets.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null,
    signature: JSON.stringify(targets.map(item => [item.jid, item.entity]).sort()) };
}
function groupProblem(info, feature, label) {
  if (info.problem) return info.problem;
  if (info.missing.length) return info.missing.join("; ");
  const unsupported = info.targets.filter(item => !available(item.state) || !supports(item.state, feature) || (feature === FEATURES.VOLUME && volumeOf(item.state) === null));
  return unsupported.length ? label + " nicht verfügbar: " + unsupported.map(item => item.name).join(", ") : "";
}
export function groupVolumeSnapshot(config, hass) {
  const info = connectedPlayers(config, hass); const problem = groupProblem(info, FEATURES.VOLUME, "Lautstärke");
  if (problem) throw new Error(problem);
  return { signature: info.signature, mean: info.mean, levels: info.targets.map(item => ({ entity: item.entity, level: volumeOf(item.state) })) };
}
export function buildGroupVolumeCalls(config, value, hass, start) {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Ungültige Gruppenlautstärke.");
  const current = groupVolumeSnapshot(config, hass); const snapshot = start || current;
  if (snapshot.signature !== current.signature) throw new Error("Die Gruppe hat sich geändert. Bitte den Lautstärkebalken erneut bedienen.");
  if (!hasService(hass, "media_player", "volume_set")) throw new Error("Lautstärkeregelung nicht verfügbar.");
  const delta = value - snapshot.mean;
  return snapshot.levels.map(item => ({ domain: "media_player", service: "volume_set", data: {
    entity_id: item.entity, volume_level: (value === 0 ? 0 : value === 100 ? 100 : Math.round(Math.max(0, Math.min(100, item.level + delta)))) / 100
  } }));
}
export function buildGroupMuteCall(config, mute, hass) {
  const info = connectedPlayers(config, hass); const problem = groupProblem(info, FEATURES.MUTE, "Stummschalten");
  if (problem) throw new Error(problem);
  if (typeof mute !== "boolean" || !hasService(hass, "media_player", "volume_mute")) throw new Error("Stummschalten nicht verfügbar.");
  return { domain: "media_player", service: "volume_mute", data: { entity_id: info.targets.map(item => item.entity), is_volume_muted: mute } };
}
export function buildGroupOffCall(config, hass) {
  const info = connectedPlayers(config, hass); const problem = groupProblem(info, FEATURES.TURN_OFF, "Standby");
  if (problem) throw new Error(problem);
  if (!hasService(hass, "media_player", "turn_off")) throw new Error("Standby nicht verfügbar.");
  // Explicit targets only; beolink_allstandby can have a wider scope.
  return { domain: "media_player", service: "turn_off", data: { entity_id: info.targets.map(item => item.entity) } };
}
export async function fetchSpeakerImages(hass) {
  if (typeof hass?.callWS !== "function") throw new Error("HA-Bildsammlung ist noch nicht verfügbar.");
  const images = await hass.callWS({ type: "image/list" });
  if (!Array.isArray(images)) throw new Error("HA hat keine gültige Bildliste zurückgegeben.");
  return images.filter(item => typeof item?.id === "string" && /^[a-f0-9]{32}$/i.test(item.id))
    .map(item => ({ id: item.id, name: String(item.name || "Bild"), url: "/api/image/serve/" + item.id + "/256x256" }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
export async function deleteSpeakerImage(hass, id) {
  if (typeof id !== "string" || !/^[a-f0-9]{32}$/i.test(id)) throw new Error("Ungültige HA-Bildkennung.");
  if (typeof hass?.callWS !== "function") throw new Error("HA-Bildsammlung ist noch nicht verfügbar.");
  await hass.callWS({ type: "image/delete", image_id: id });
}
export async function uploadSpeakerPhoto(hass, file) {
  if (!file || !["image/jpeg", "image/png", "image/gif"].includes(file.type)) throw new Error("Bitte ein JPG-, PNG- oder GIF-Bild auswählen. HEIC vorher als JPG exportieren.");
  if (!file.size || file.size > 8 * 1024 * 1024) throw new Error("Bitte ein Bild bis 8 MB auswählen.");
  if (typeof hass?.fetchWithAuth !== "function") throw new Error("Bild-Upload ist hier nicht verfügbar. Alternativ eine Bildadresse unter /local/ eintragen.");
  const data = new FormData(); data.append("file", file, file.webkitRelativePath || file.name);
  const response = await hass.fetchWithAuth("/api/image/upload", { method: "POST", body: data });
  if (response.status !== 200) {
    const reason = response.status === 413 ? "Das Bild ist zu groß." :
      [401, 403].includes(response.status) ? "Keine Berechtigung zum Hochladen. Bitte deine HA-Anmeldung prüfen." :
      response.status === 404 ? "Die Bild-Upload-Funktion von Home Assistant ist nicht aktiv. Alternativ eine Bildadresse unter /local/ verwenden." : "Home Assistant konnte das Bild nicht speichern (HTTP " + response.status + ").";
    throw new Error(reason);
  }
  const result = await response.json();
  if (typeof result?.id !== "string" || !/^[a-f0-9]{32}$/i.test(result.id)) throw new Error("Home Assistant hat keine gültige Bildkennung zurückgegeben.");
  // HA's thumbnail endpoint preserves proportions and handles EXIF orientation.
  return "/api/image/serve/" + result.id + "/256x256";
}

class SpeakerPicture {
  constructor() {
    this.element = node("div", "speaker-picture");
    this.fallback = icon("mdi:speaker");
    this.image = node("img"); this.image.alt = ""; this.image.hidden = true;
    this.image.referrerPolicy = "no-referrer";
    this.image.addEventListener("load", () => { this.image.hidden = false; this.fallback.hidden = true; });
    this.image.addEventListener("error", () => { this.image.hidden = true; this.fallback.hidden = false; });
    this.element.append(this.fallback, this.image);
  }
  update(value, hass) {
    const base = hass?.hassUrl ? hass.hassUrl("/") : globalThis.location?.origin;
    const url = safeImageUrl(value, base);
    if (url === this.url) return;
    this.url = url; this.image.hidden = true; this.fallback.hidden = false;
    if (url) this.image.src = url; else this.image.removeAttribute("src");
  }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function icon(name) {
  const element = node("ha-icon");
  element.setAttribute("icon", name);
  element.setAttribute("aria-hidden", "true");
  return element;
}
function favouriteIcon(slot) {
  // B&O's four preset marks: one dot, a pair, a mirrored L and a square.
  const dots = [
    [[12, 12]],
    [[8.5, 12], [15.5, 12]],
    [[15.5, 8.5], [8.5, 15.5], [15.5, 15.5]],
    [[8.5, 8.5], [15.5, 8.5], [8.5, 15.5], [15.5, 15.5]]
  ];
  const ns = "http://www.w3.org/2000/svg";
  const element = document.createElementNS(ns, "svg");
  element.setAttribute("viewBox", "0 0 24 24");
  element.setAttribute("class", "favorite-symbol");
  element.setAttribute("aria-hidden", "true");
  element.setAttribute("focusable", "false");
  element.setAttribute("fill", "currentColor");
  for (const [x, y] of dots[slot - 1]) {
    const circle = document.createElementNS(ns, "circle");
    circle.setAttribute("cx", String(x)); circle.setAttribute("cy", String(y)); circle.setAttribute("r", "1.8");
    element.append(circle);
  }
  return element;
}
function button(label, iconName, handler, className = "") {
  const element = node("button", className);
  element.type = "button";
  element.setAttribute("aria-label", label);
  if (iconName) element.append(icon(iconName));
  else element.textContent = label;
  element.addEventListener("click", handler);
  return element;
}
const errorMessage = error => error?.message || error?.error?.message || String(error);
const pictureCss = `
  .speaker-picture{background:var(--secondary-background-color,#edf0f2);border-radius:10px;width:46px;height:48px;display:flex;align-items:center;justify-content:center;flex:0 0 46px;color:var(--secondary-text-color,#68747a);overflow:hidden}
  .speaker-picture img{display:block;width:100%;height:100%;object-fit:contain;padding:3px}.speaker-picture [hidden]{display:none!important}
`;
const css = `
  ${pictureCss}
  :host{--bo-accent:#F3C644;--bo-on-accent:#28220D;display:block;min-width:0;width:100%;height:auto;color:var(--primary-text-color,#202428);font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif)}
  *{box-sizing:border-box} [hidden]{display:none!important}
  :host([data-fixed-rows]){height:calc(var(--bo-grid-rows) * (var(--ha-section-grid-row-height,56px) + var(--ha-section-grid-row-gap,8px)) - var(--ha-section-grid-row-gap,8px))}
  ha-card{display:block;height:auto;background:var(--ha-card-background,var(--card-background-color,#fff));border-radius:var(--ha-card-border-radius,16px);overflow:hidden}
  .wrap{padding:20px;height:auto;min-height:0;display:flex;flex-direction:column;overflow:visible}.wrap>*{flex-shrink:0}.player{display:flex;flex-direction:column;flex:1 0 auto;min-height:var(--bo-player-height,560px)}.player-controls{flex:none} .head,.room-top,.volume-label,.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
  :host([data-fixed-rows]) ha-card{height:100%}
  :host([data-fixed-rows]) .wrap{height:100%;overflow:auto;overflow-x:hidden}
  h2,h3,p{margin:0}h2{font-size:20px;font-weight:500;overflow-wrap:anywhere}h3{font-size:15px;font-weight:500}
  .small{font-size:12px;color:var(--secondary-text-color,#68747a);line-height:1.5}
  .head-name{min-width:0}.head-left{display:flex;align-items:center;gap:12px;min-width:0}.track{display:flex;gap:16px;align-items:center;margin:20px 0 8px;flex:1 0 88px;min-height:88px}
  .cover{width:88px;height:88px;flex:0 0 88px;border-radius:10px;position:relative;overflow:hidden;background:var(--secondary-background-color,#edf0f2);display:flex;align-items:center;justify-content:center}
  .cover img{height:100%;width:100%;object-fit:cover;position:absolute;inset:0}
  .cover ha-icon{--mdc-icon-size:36px;color:var(--secondary-text-color,#68747a)}
  .track-copy{min-width:0}.title{font-size:18px;font-weight:500;line-height:1.35;overflow-wrap:anywhere}
  :host([data-expanded-player]:not([data-rooms-expanded])) .track{flex-direction:column;justify-content:center;gap:12px;flex-basis:190px;min-height:190px}
  :host([data-expanded-player]:not([data-rooms-expanded])) .cover{width:var(--bo-cover-size,160px);height:var(--bo-cover-size,160px);flex:0 0 auto;max-width:100%}
  :host([data-expanded-player]:not([data-rooms-expanded])) .track-copy{width:100%;flex:none;text-align:center}
  :host([data-rooms-expanded]) .player{flex:0 0 auto;min-height:0}
  :host([data-rooms-expanded]) .track{flex:0 0 auto;min-height:64px;gap:12px;margin:14px 0 6px}
  :host([data-rooms-expanded]) .cover{width:64px;height:64px;flex:0 0 64px}
  :host([data-rooms-expanded]) .room-list{flex:1 0 auto}
  .artist{margin-top:5px;overflow-wrap:anywhere}.source{margin-top:8px;overflow-wrap:anywhere}
  button{font:inherit;border:0;background:transparent;color:inherit;cursor:pointer;border-radius:50%;min-height:44px;min-width:44px;display:inline-flex;align-items:center;justify-content:center}
  button:disabled{opacity:.4;cursor:default}button:hover:not(:disabled){background:var(--secondary-background-color,#edf0f2)}
  button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--bo-accent,#F3C644);outline-offset:3px}
  ha-icon{--mdc-icon-size:22px;display:inline-flex;align-items:center;justify-content:center}
  .player-controls{container-type:inline-size}
  .transport{display:grid;grid-template-columns:minmax(44px,1fr) 44px 50px 44px minmax(44px,1fr);align-items:center;column-gap:clamp(0px,calc((100% - 226px) / 4),15px);padding:10px 0 18px}
  .transport>button{width:44px;height:44px}
  .transport .previous{grid-column:2}.transport .next{grid-column:4}.transport .power{grid-column:5;justify-self:end}
  .transport .primary{grid-column:3;background:var(--bo-accent,#F3C644);color:var(--bo-on-accent,#28220D);height:50px;width:50px}
  .transport .primary:hover:not(:disabled){filter:brightness(.93);background:var(--bo-accent,#F3C644)}
  @container(max-width:240px){.transport{grid-template-columns:minmax(0,1fr) 44px 50px 44px minmax(0,1fr);row-gap:6px}.transport .power{grid-row:2}}
  .source-field{display:grid;gap:6px;margin-bottom:12px}.source-select{font:inherit;font-size:14px;width:100%;min-width:0;min-height:44px;padding:10px;border:1px solid var(--divider-color,#dce3e7);border-radius:9px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#202428)}
  .source-select:disabled{opacity:.5}.favorites{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:6px 0 18px}
  .favorite{border:1px solid var(--divider-color,#dce3e7);border-radius:10px;display:flex;min-width:0;min-height:46px}.favorite-symbol{display:block;width:28px;height:28px;flex:none}
  .player-action-status{margin:-6px 0 14px}
  .volume-label{font-size:12px;color:var(--secondary-text-color,#68747a);margin-bottom:1px;flex-wrap:wrap;column-gap:8px;row-gap:2px}.volume-label span{min-width:0;overflow-wrap:anywhere}.volume-label output{margin-left:auto}
  output{font-variant-numeric:tabular-nums;color:var(--primary-text-color,#202428);white-space:nowrap}
  input[type=range]{appearance:none;-webkit-appearance:none;width:100%;height:38px;margin:5px 0 0;border:0;border-radius:7px;cursor:pointer;background:linear-gradient(to right,var(--bo-accent) 0%,var(--bo-accent) var(--volume-fill,0%),var(--secondary-background-color,#e8ecef) var(--volume-fill,0%),var(--secondary-background-color,#e8ecef) 100%)}
  input[type=range]::-webkit-slider-runnable-track{height:38px;border:0;background:transparent}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:24px;height:38px;background:transparent;border:0;box-shadow:none}
  input[type=range]::-moz-range-track{height:38px;background:transparent;border:0}
  input[type=range]::-moz-range-progress{background:transparent}
  input[type=range]::-moz-range-thumb{width:24px;height:38px;background:transparent;border:0;border-radius:0;box-shadow:none}
  input:disabled{cursor:default;opacity:.45}.volume-note{font-size:12px;color:var(--secondary-text-color,#68747a)}
  .section-head{border-top:1px solid var(--divider-color,#e3e7ea);margin-top:17px;padding-top:18px;padding-bottom:2px;flex-wrap:wrap}.section-head>h3{flex:1 1 95px;min-width:0}
  .section-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:auto}.rooms-toggle{width:44px;height:44px}.rooms-toggle[aria-expanded=true]{color:var(--bo-accent)}
  .room{border-bottom:1px solid var(--divider-color,#e3e7ea);padding:15px 0}.room:last-child,.room[data-last-visible=true]{border-bottom:0;padding-bottom:0}
  .room[data-joined=true] .speaker-picture{color:var(--bo-accent,#F3C644)}
  .room-copy{min-width:0;flex:1}.room-name{font-size:15px;font-weight:500;overflow-wrap:anywhere}
  .room-state{font-size:12px;color:var(--secondary-text-color,#68747a);line-height:1.4;overflow-wrap:anywhere;margin-top:3px}
  .toggle-label{display:flex;align-items:center;gap:8px;min-height:44px;flex-shrink:0;cursor:pointer}
  .toggle{appearance:none;-webkit-appearance:none;width:46px;height:27px;border-radius:16px;margin:0;background:var(--disabled-color,#9da7ad);position:relative;cursor:pointer;transition:background .15s}
  .toggle:before{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;background:var(--card-background-color,#fff);border-radius:50%;transition:transform .15s}
  .toggle:checked{background:var(--bo-accent,#F3C644)}.toggle:checked:before{transform:translateX(19px)}
  .room-volume{margin:12px 0 0 52px}
  .head-actions{display:flex;gap:3px;align-items:center;flex-shrink:0}.power[data-on=true],.group-mute[aria-pressed=true]{background:var(--bo-accent);color:var(--bo-on-accent)}
  .group-controls{border-top:1px solid var(--divider-color,#e3e7ea);margin-top:18px;padding-top:18px}.group-controls h3{margin-bottom:12px;overflow-wrap:anywhere}.group-controls-row{display:flex;align-items:flex-end;gap:8px}.group-volume{flex:1;min-width:0}.group-buttons{display:flex;gap:2px;flex-shrink:0}.group-buttons button{border-radius:50%;width:44px;height:44px;flex:0 0 44px}
  .message{font-size:13px;line-height:1.5;padding:12px 0;overflow-wrap:anywhere}
  .notice{color:var(--secondary-text-color,#68747a)}
  .error-box{display:flex;align-items:flex-start;gap:8px;border-top:1px solid var(--divider-color,#e3e7ea);margin-top:16px}
  .error{color:var(--error-color,#db4437);flex:1}.empty{padding:18px 0 0}
  @media(max-width:350px){.wrap{padding:16px}.room .speaker-picture{width:34px;height:40px;flex-basis:34px}.room-volume{margin-left:43px}.cover{width:74px;height:74px;flex-basis:74px}.track{gap:12px}.title{font-size:16px}.room-top{gap:9px}.favorites{gap:6px}}
  @media(prefers-reduced-motion:reduce){.toggle,.toggle:before{transition:none}}
`;

class VolumeControl {
  constructor(owner, entityId, name) {
    this.owner = owner; this.entityId = entityId; this.name = name;
    this.element = node("div", "volume-control");
    const label = node("label");
    const heading = node("div", "volume-label");
    this.label = node("span", "", "Lautstärke · " + name);
    this.output = node("output", "", "—");
    heading.append(this.label, this.output);
    this.input = node("input");
    this.input.type = "range"; this.input.min = "0"; this.input.max = "100"; this.input.step = "1";
    this.input.setAttribute("aria-label", "Lautstärke " + name);
    label.append(heading, this.input);
    this.note = node("p", "volume-note");
    this.element.append(label, this.note);
    this.input.addEventListener("input", () => {
      this.editing = true; this._display(Number(this.input.value));
    });
    this.input.addEventListener("change", () => this._commit());
    this.input.addEventListener("blur", () => { this.editing = false; this.update(this.state); });
  }
  _display(value) {
    this.output.textContent = value === null ? "—" : value + " %";
    this.input.style.setProperty("--volume-fill", Math.max(0, Math.min(100, value ?? 0)) + "%");
    if (value !== null) {
      this.input.value = String(value);
      this.input.setAttribute("aria-valuetext", value + " Prozent");
    }
  }
  async _commit() {
    this.editing = false;
    if (this.input.disabled || !available(this.state) || !supports(this.state, FEATURES.VOLUME)) return;
    const value = Math.min(100, Math.max(0, Number(this.input.value)));
    if (!Number.isFinite(value)) return;
    const token = {};
    this.draft = { token, value, until: Date.now() + 5000 };
    const epoch = this.owner._epoch;
    try {
      await this.owner._call("media_player", "volume_set", { entity_id: this.entityId, volume_level: value / 100 });
    } catch (error) {
      if (this.draft?.token === token && this.owner._epoch === epoch) {
        this.draft = null;
        this.owner._setError(this.name + ": " + errorMessage(error));
        this.update(this.state);
      }
    }
  }
  update(state, mismatch = false) {
    this.state = state;
    const value = volumeOf(state);
    const canSet = available(state) && supports(state, FEATURES.VOLUME) && value !== null && !mismatch;
    this.input.disabled = !canSet || Boolean(this.owner._groupBusy || this.owner._powerBusy);
    this.note.textContent = mismatch ? "Lautstärke-Entität gehört zu einem anderen BeoLink-Gerät." :
      !this.entityId ? "Für die Lautstärke bitte im Karteneditor eine Entität auswählen." :
      !available(state) ? "Lautstärke-Entität nicht verfügbar." :
      !canSet ? "Lautstärkeregelung wird nicht gemeldet." : "";
    this.note.hidden = !this.note.textContent;
    if (this.draft && (Math.abs((value ?? -100) - this.draft.value) <= 1 || Date.now() > this.draft.until || !canSet)) this.draft = null;
    if (!this.editing) this._display(this.draft ? this.draft.value : value);
  }
}

class GroupVolumeControl extends VolumeControl {
  constructor(owner) {
    super(owner, "", "Gruppe");
    this.element.classList.add("group-volume"); this.label.textContent = "Lautstärke";
    this.input.setAttribute("aria-label", "Lautstärke aller verbundenen Lautsprecher");
    const capture = () => {
      if (this.start) return;
      try { this.start = groupVolumeSnapshot(owner._config, owner._hass); } catch { this.start = null; }
    };
    this.input.addEventListener("pointerdown", capture);
    this.input.addEventListener("keydown", capture);
    this.input.addEventListener("input", capture);
    this.input.addEventListener("blur", () => { this.start = null; });
  }
  async _commit() {
    this.editing = false;
    if (this.input.disabled) { this.start = null; return; }
    const value = Number(this.input.value); const start = this.start; this.start = null;
    const token = {}; this.draft = { token, value, until: Date.now() + 5000 };
    const ok = await this.owner._setGroupVolume(value, start);
    if (!ok && this.draft?.token === token) this.draft = null;
    this.owner._update();
  }
  update(info) {
    if (!info) return;
    this.state = info;
    const problem = groupProblem(info, FEATURES.VOLUME, "Lautstärke");
    this.input.disabled = Boolean(problem || this.owner._groupBusy || this.owner._powerBusy || !hasService(this.owner._hass, "media_player", "volume_set"));
    this.note.textContent = ""; this.note.hidden = true;
    if (this.draft && (Math.abs((info.mean ?? -100) - this.draft.value) <= 1 || Date.now() > this.draft.until || problem)) this.draft = null;
    if (!this.editing) this._display(this.draft?.value ?? info.mean);
  }
}

export class BeolinkMultiroomCard extends BaseElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pending = new Map(); this._epoch = 0; this._error = ""; this._config = normalizeConfig({}); this._roomsExpanded = false;
    this._roomPointers = new Set(); this._roomKeys = new Set(); this._roomCloseTimer = null;
    this._releaseRoomPointer = event => { if (this._roomPointers.delete(event.pointerId)) this._syncRoomAutoClose(true); };
    this._releaseRoomKey = event => { if (this._roomKeys.delete(event.key)) this._syncRoomAutoClose(true); };
    this._releaseRoomInput = () => { this._roomPointers.clear(); this._roomKeys.clear(); this._syncRoomAutoClose(true); };
    this._onDashboardScroll = () => { if (this._roomsExpanded) this._syncRoomAutoClose(true); };
  }
  static getConfigElement() { return document.createElement(TYPE + "-editor"); }
  static getStubConfig(hass) {
    const master = Object.keys(hass?.states || {}).find(id => mediaId(id) && selfJid(hass.states[id])) || "";
    return { master, members: [] };
  }
  setConfig(config) {
    const next = normalizeConfig(config);
    this._clearRoomAutoClose(); this._roomPointers.clear(); this._roomKeys.clear();
    const scope = value => JSON.stringify([value.master, value.members.map(member => [member.jid, member.entity])]);
    if (scope(next) !== scope(this._config)) this._groupRecall = null;
    if (next.master !== this._config.master) this._roomsExpanded = false;
    this._config = next; this._epoch++; this._pending.clear(); this._error = "";
    this._groupBusy = null; this._powerBusy = false;
    this._playerRequest = null; this._playerFeedback = null;
    this._build(); this._update();
  }
  set hass(value) { this._hass = value; this._update(); }
  get hass() { return this._hass; }
  connectedCallback() {
    if (!this._ui) this._build();
    this._autoCloseWindow = this.ownerDocument?.defaultView;
    this._autoCloseWindow?.addEventListener("pointerup", this._releaseRoomPointer, true);
    this._autoCloseWindow?.addEventListener("pointercancel", this._releaseRoomPointer, true);
    this._autoCloseWindow?.addEventListener("keyup", this._releaseRoomKey, true);
    this._autoCloseWindow?.addEventListener("blur", this._releaseRoomInput);
    this._autoCloseWindow?.addEventListener("scroll", this._onDashboardScroll, { capture: true, passive: true });
    this._observeSize();
    if (!this._timer) this._timer = setInterval(() => this._update(), 1000);
    this._update();
  }
  disconnectedCallback() {
    this._clearRoomAutoClose(); this._roomPointers.clear(); this._roomKeys.clear();
    this._autoCloseWindow?.removeEventListener("pointerup", this._releaseRoomPointer, true);
    this._autoCloseWindow?.removeEventListener("pointercancel", this._releaseRoomPointer, true);
    this._autoCloseWindow?.removeEventListener("keyup", this._releaseRoomKey, true);
    this._autoCloseWindow?.removeEventListener("blur", this._releaseRoomInput);
    this._autoCloseWindow?.removeEventListener("scroll", this._onDashboardScroll, true);
    this._autoCloseWindow = null;
    clearInterval(this._timer); this._timer = null; this._epoch++; this._pending.clear();
    this._playerRequest = null;
    this._groupBusy = null; this._powerBusy = false;
    this._sizeObserver?.disconnect(); this._sizeObserver = null;
    this._resizeTicket = null;
  }
  getCardSize() {
    const rows = this._config.grid_options?.rows;
    if (typeof rows === "number" && Number.isFinite(rows) && rows > 0) return Math.ceil((Math.max(MIN_GRID_ROWS, rows) * 64 - 8) / 50);
    const visible = this._rooms?.filter(room => !room.row.hidden).length || 0;
    const playerHeight = this._roomsExpanded ? 0 : this._config.player_height;
    return 6 + Number(this._config.show_source) + Number(this._config.show_favorites) + visible * 2 + Math.ceil(Math.max(0, playerHeight - 350) / 50);
  }
  getGridOptions() { return { columns: 12, min_columns: 6, max_columns: 24, rows: "auto", min_rows: MIN_GRID_ROWS }; }
  _clearRoomAutoClose() {
    if (this._roomCloseTimer !== null) clearTimeout(this._roomCloseTimer);
    this._roomCloseTimer = null;
  }
  _roomAutoCloseBlocked() {
    return Boolean(this._roomPointers.size || this._roomKeys.size || this._pending.size || this._groupBusy || this._powerBusy || this._playerRequest ||
      this._mainVolume?.editing || this._groupVolume?.editing || this._rooms?.some(room => room.volume.editing));
  }
  _syncRoomAutoClose(reset = false) {
    if (reset) this._clearRoomAutoClose();
    if (!this._roomsExpanded || !this.isConnected || !this._config.auto_close_seconds || this._roomAutoCloseBlocked()) {
      this._clearRoomAutoClose(); return;
    }
    // HA state updates must not restart an inactivity timer every second.
    if (this._roomCloseTimer !== null) return;
    this._roomCloseTimer = setTimeout(() => {
      this._roomCloseTimer = null;
      if (this._roomAutoCloseBlocked()) { this._syncRoomAutoClose(); return; }
      this._setRoomsExpanded(false);
    }, this._config.auto_close_seconds * 1000);
  }
  _setRoomsExpanded(expanded) {
    this._roomsExpanded = expanded;
    this._updateRoomVisibility();
  }
  _updateRoomVisibility() {
    if (!this._ui) return;
    this.toggleAttribute("data-rooms-expanded", this._roomsExpanded);
    // Temporarily release the enlarged cover's measured minimum. Keep the
    // configured player height intact so closing the list restores it.
    if (this._roomsExpanded) {
      this._ui.track.style.removeProperty("min-height");
      this.style.removeProperty("--bo-cover-size");
    }
    const toggle = this._ui.roomsToggle;
    toggle.setAttribute("aria-expanded", String(this._roomsExpanded));
    toggle.setAttribute("aria-label", this._roomsExpanded ? "Nur verbundene Lautsprecher anzeigen" : "Alle Lautsprecher anzeigen");
    toggle.title = toggle.getAttribute("aria-label");
    toggle.firstElementChild.setAttribute("icon", this._roomsExpanded ? "mdi:chevron-up" : "mdi:chevron-down");
    this._rooms.forEach((room, index) => {
      const hide = !this._roomsExpanded && room.row.dataset.joined !== "true" && !this._pending.has(String(index));
      if (hide && room.row.contains(this.shadowRoot.activeElement)) toggle.focus();
      room.row.hidden = hide;
      delete room.row.dataset.lastVisible;
    });
    const visible = this._rooms.filter(room => !room.row.hidden);
    if (visible.length) visible[visible.length - 1].row.dataset.lastVisible = "true";
    this._ui.empty.hidden = !this._roomsExpanded || this._rooms.length > 0;
    this._syncRoomAutoClose();
    this._scheduleArtworkResize();
  }
  _observeSize() {
    this._sizeObserver?.disconnect(); this._sizeObserver = null;
    if (!this._ui || !this.isConnected) return;
    if (typeof globalThis.ResizeObserver === "function") {
      this._sizeObserver = new ResizeObserver(() => this._scheduleArtworkResize());
      for (const element of [this._ui.track, this._ui.trackCopy, this._ui.playerControls, this._ui.wrap]) this._sizeObserver.observe(element);
    }
    this._scheduleArtworkResize();
  }
  _scheduleArtworkResize() {
    if (this._resizeTicket || !this.isConnected) return;
    const ticket = {}; this._resizeTicket = ticket;
    const run = () => {
      if (this._resizeTicket !== ticket) return;
      this._resizeTicket = null; this._resizeArtwork();
    };
    if (typeof globalThis.requestAnimationFrame === "function") globalThis.requestAnimationFrame(run);
    else setTimeout(run, 0);
  }
  _resizeArtwork() {
    if (!this._ui || !this.isConnected || this._roomsExpanded || !this.hasAttribute("data-expanded-player")) return;
    const { track, trackCopy } = this._ui;
    const width = track.clientWidth; const captionHeight = trackCopy.offsetHeight;
    if (!width) return;
    const minimum = Math.max(190, Math.ceil(captionHeight + 172)) + "px";
    if (track.style.minHeight !== minimum) track.style.minHeight = minimum;
    const size = coverSizeForSpace(width, track.clientHeight, captionHeight) + "px";
    if (this.style.getPropertyValue("--bo-cover-size") !== size) this.style.setProperty("--bo-cover-size", size);
  }
  _call(domain, service, data) {
    if (!this._hass?.callService) return Promise.reject(new Error("Home Assistant ist noch nicht verbunden."));
    return Promise.resolve().then(() => this._hass.callService(domain, service, data));
  }
  _setError(message) { this._error = message; this._updateError(); }
  _updateError() {
    if (!this._ui) return;
    this._ui.error.textContent = this._error;
    this._ui.errorBox.hidden = !this._error;
    this._scheduleArtworkResize();
  }
  _moreInfo() {
    if (!this._config.master) return;
    this.dispatchEvent(new CustomEvent("hass-more-info", {
      detail: { entityId: this._config.master }, bubbles: true, composed: true
    }));
  }
  async _transport(service) {
    const state = this._hass?.states?.[this._config.master];
    if (!available(state)) return;
    const epoch = this._epoch;
    try { await this._call("media_player", service, { entity_id: this._config.master }); }
    catch (error) { if (epoch === this._epoch) this._setError(errorMessage(error)); }
  }
  async _playerAction(kind, value) {
    if (this._playerRequest) return;
    let call;
    try { call = kind === "source" ? buildSourceCall(this._config, value, this._hass) : buildFavouriteCall(this._config, value, this._hass); }
    catch (error) { this._setError(errorMessage(error)); this._update(); return; }
    const token = {}; const epoch = this._epoch;
    this._playerRequest = token;
    this._playerFeedback = { text: kind === "source" ? "Quelle wird gewählt …" : "Favorit " + value + " wird aufgerufen …", until: Infinity };
    this._error = ""; this._update();
    try {
      await this._call(call.domain, call.service, call.data);
      if (epoch === this._epoch) this._playerFeedback = { text: kind === "source" ? "Quellenauswahl gesendet." : "Favorit " + value + " aufgerufen.", until: Date.now() + 3000 };
    } catch (error) {
      if (epoch === this._epoch) { this._playerFeedback = null; this._setError(errorMessage(error)); }
    } finally {
      if (epoch === this._epoch && this._playerRequest === token) { this._playerRequest = null; this._update(); }
    }
  }
  async _mainPower() {
    if (this._powerBusy || this._groupBusy) return;
    const epoch = this._epoch;
    try {
      const call = buildPowerCall(this._config.master, !powered(this._hass?.states?.[this._config.master]), this._hass);
      this._powerBusy = true; this._error = ""; this._update();
      await this._call(call.domain, call.service, call.data);
    } catch (error) { if (epoch === this._epoch) this._setError(errorMessage(error)); }
    finally { if (epoch === this._epoch) { this._powerBusy = false; this._update(); } }
  }
  async _setGroupVolume(value, start) {
    if (this._groupBusy || this._powerBusy) return false;
    const epoch = this._epoch;
    try {
      const calls = buildGroupVolumeCalls(this._config, value, this._hass, start);
      this._groupBusy = "Lautstärke wird eingestellt …"; this._error = ""; this._update();
      const scope = connectedPlayers(this._config, this._hass).signature;
      // Each relative level has a distinct value. Recheck membership before every call.
      const errors = [];
      for (const call of calls) {
        const current = connectedPlayers(this._config, this._hass);
        if (epoch !== this._epoch) return false;
        if (current.problem || current.missing.length || current.signature !== scope) throw new Error("Gruppe hat sich geändert; weitere Lautstärkebefehle wurden gestoppt.");
        try { await this._call(call.domain, call.service, call.data); }
        catch (error) { errors.push(displayName(this._hass.states[call.data.entity_id], call.data.entity_id) + ": " + errorMessage(error)); }
      }
      if (errors.length) throw new Error(errors.join("; "));
      return true;
    } catch (error) { if (epoch === this._epoch) this._setError(errorMessage(error)); return false; }
    finally { if (epoch === this._epoch) { this._groupBusy = null; this._update(); } }
  }
  async _groupMute() {
    if (this._groupBusy || this._powerBusy) return;
    const epoch = this._epoch;
    try {
      const info = connectedPlayers(this._config, this._hass);
      const mute = !info.targets.every(item => item.state?.attributes?.is_volume_muted === true);
      const call = buildGroupMuteCall(this._config, mute, this._hass);
      this._groupBusy = mute ? "Gruppe wird stummgeschaltet …" : "Stummschaltung wird aufgehoben …"; this._error = ""; this._update();
      await this._call(call.domain, call.service, call.data);
    } catch (error) { if (epoch === this._epoch) this._setError(errorMessage(error)); }
    finally { if (epoch === this._epoch) { this._groupBusy = null; this._update(); } }
  }
  async _waitFor(predicate, message, epoch) {
    const deadline = Date.now() + TIMEOUT;
    while (!predicate()) {
      if (epoch !== this._epoch) throw new Error("Aktion beendet: Kartenkonfiguration geändert.");
      if (Date.now() >= deadline) throw new Error(message);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (epoch !== this._epoch) throw new Error("Aktion beendet: Kartenkonfiguration geändert.");
  }
  async _groupPower() {
    if (this._groupBusy || this._powerBusy) return;
    const epoch = this._epoch;
    try {
      const info = connectedPlayers(this._config, this._hass);
      if (info.jids.length) {
        const call = buildGroupOffCall(this._config, this._hass);
        this._groupRecall = { master: this._config.master, jids: [...info.jids], mean: info.mean };
        this._groupBusy = "Gruppe wird ausgeschaltet …"; this._error = ""; this._update();
        await this._call(call.domain, call.service, call.data);
      } else if (this._groupRecall?.master === this._config.master) {
        const recall = this._groupRecall;
        if (!info.group.known || info.group.follower) throw new Error("Hauptspieler ist nicht für diese Gruppe verfügbar.");
        if (!hasService(this._hass, "bang_olufsen", "beolink_expand")) throw new Error("BeoLink-Verbinden nicht verfügbar.");
        const call = buildPowerCall(this._config.master, true, this._hass);
        this._groupBusy = "Hauptspieler wird gestartet …"; this._error = ""; this._update();
        await this._call(call.domain, call.service, call.data);
        await this._waitFor(() => this._hass?.states?.[this._config.master]?.state === "playing", "Der Hauptspieler spielt noch nicht. Bitte eine Quelle oder einen Favoriten starten und die Gruppe erneut einschalten.", epoch);
        const now = groupState(this._hass, this._config.master);
        if (!now.known || now.follower) throw new Error("BeoLink-Gruppe hat sich geändert.");
        const missing = recall.jids.filter(jid => !now.members.has(jid));
        this._groupBusy = "Letzte Gruppe wird verbunden …"; this._update();
        if (missing.length) await this._call("bang_olufsen", "beolink_expand", { entity_id: this._config.master, beolink_jids: missing });
        await this._waitFor(() => {
          const group = groupState(this._hass, this._config.master);
          return group.known && !group.follower && recall.jids.every(jid => group.members.has(jid));
        }, "Noch keine Bestätigung für alle Räume der letzten Gruppe.", epoch);
        this._groupRecall = null;
      }
    } catch (error) { if (epoch === this._epoch) this._setError(errorMessage(error)); }
    finally { if (epoch === this._epoch) { this._groupBusy = null; this._update(); } }
  }
  async _toggle(index, desired) {
    const key = String(index);
    if (this._pending.has(key)) return;
    let call;
    try { call = buildMembershipCall(this._config, index, desired, this._hass); }
    catch (error) { this._setError(errorMessage(error)); this._update(); return; }
    const current = roomState(this._config, index, this._hass);
    if (current.joined === desired) { this._update(); return; }
    const pending = { desired, jid: current.jid, master: this._config.master, deadline: Date.now() + TIMEOUT };
    this._pending.set(key, pending); this._error = ""; this._update();
    const epoch = this._epoch;
    try { await this._call(call.domain, call.service, call.data); }
    catch (error) {
      if (epoch === this._epoch && this._pending.get(key) === pending) {
        this._pending.delete(key); this._setError(current.name + ": " + errorMessage(error)); this._update();
      }
    }
  }
  _build() {
    this._resizeTicket = null; this._sizeObserver?.disconnect();
    const fixedRows = typeof this._config.grid_options?.rows === "number" && Number.isFinite(this._config.grid_options.rows) && this._config.grid_options.rows > 0;
    this.toggleAttribute("data-fixed-rows", fixedRows);
    if (fixedRows) this.style.setProperty("--bo-grid-rows", String(Math.max(MIN_GRID_ROWS, this._config.grid_options.rows)));
    else this.style.removeProperty("--bo-grid-rows");
    this.toggleAttribute("data-expanded-player", fixedRows || this._config.player_height > 0);
    this.style.removeProperty("--bo-cover-size");
    if (this._config.player_height) this.style.setProperty("--bo-player-height", this._config.player_height + "px");
    else this.style.removeProperty("--bo-player-height");
    this._imageUrl = undefined;
    const style = node("style"); style.textContent = css;
    const card = node("ha-card"); const wrap = node("div", "wrap");
    wrap.addEventListener("pointerdown", event => { this._roomPointers.add(event.pointerId); this._syncRoomAutoClose(true); });
    wrap.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown", " ", "Enter"].includes(event.key)) this._roomKeys.add(event.key);
      this._syncRoomAutoClose(true);
    });
    for (const type of ["click", "input", "change", "focusin", "wheel", "touchmove"]) {
      wrap.addEventListener(type, () => this._syncRoomAutoClose(true), { passive: true });
    }
    const head = node("div", "head"); const headName = node("div", "head-name");
    const name = node("h2"); const subtitle = node("p", "small");
    headName.append(name, subtitle);
    const more = button("Playerdetails öffnen", "mdi:dots-horizontal", () => this._moreInfo());
    const power = button("Hauptspieler einschalten", "mdi:power", () => this._mainPower(), "power");
    const headActions = node("div", "head-actions"); headActions.append(more);
    const headLeft = node("div", "head-left"); this._mainPicture = new SpeakerPicture();
    headLeft.append(this._mainPicture.element, headName); head.append(headLeft, headActions);
    const notice = node("p", "message notice"); notice.setAttribute("role", "status");
    const player = node("div", "player"); const track = node("div", "track"); const cover = node("div", "cover");
    const image = node("img"); image.alt = "Albumcover"; image.hidden = true; image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => { image.hidden = true; });
    const fallback = icon("mdi:music"); cover.append(fallback, image);
    const trackCopy = node("div", "track-copy"); const title = node("p", "title");
    const artist = node("p", "small artist"); const source = node("p", "small source");
    trackCopy.append(title, artist, source); track.append(cover, trackCopy);
    const transport = node("div", "transport");
    const previous = button("Vorheriger Titel", "mdi:skip-previous", () => this._transport("media_previous_track"), "previous");
    const play = button("Wiedergabe starten", "mdi:play", () => {
      const state = this._hass?.states?.[this._config.master];
      this._transport(state?.state === "playing" ? "media_pause" : "media_play");
    }, "primary");
    const next = button("Nächster Titel", "mdi:skip-next", () => this._transport("media_next_track"), "next");
    transport.append(previous, play, next, power);
    const sourceField = node("label", "source-field");
    sourceField.hidden = !this._config.show_source;
    const sourceSelect = node("select", "source-select"); sourceSelect.setAttribute("aria-label", "Quelle des Hauptspielers");
    sourceSelect.addEventListener("change", () => this._playerAction("source", sourceSelect.value));
    sourceField.append(node("span", "small", "Quelle"), sourceSelect);
    const favorites = node("div", "favorites"); favorites.setAttribute("role", "group"); favorites.setAttribute("aria-label", "Gespeicherte B&O-Favoriten des Hauptspielers");
    favorites.hidden = !this._config.show_favorites;
    const favoriteButtons = [];
    for (let slot = 1; slot <= 4; slot++) {
      const favorite = button("Favorit " + slot + " starten", null, () => this._playerAction("favourite", slot), "favorite");
      favorite.replaceChildren(favouriteIcon(slot)); favorite.title = "B&O-Favorit " + slot + " des Hauptspielers starten";
      favorites.append(favorite); favoriteButtons.push(favorite);
    }
    const actionStatus = node("p", "small player-action-status"); actionStatus.setAttribute("role", "status"); actionStatus.hidden = true;
    this._mainVolume = new VolumeControl(this, this._config.master, "Hauptspieler");
    const playerControls = node("div", "player-controls");
    playerControls.append(transport, sourceField, favorites, actionStatus, this._mainVolume.element);
    player.append(track, playerControls);
    const section = node("div", "section-head"); const heading = node("h3", "", "BeoLink Multiroom");
    const count = node("span", "small"); const sectionActions = node("div", "section-actions");
    const roomsToggle = button("Alle Lautsprecher anzeigen", "mdi:chevron-down", () => {
      this._setRoomsExpanded(!this._roomsExpanded);
    }, "rooms-toggle");
    roomsToggle.setAttribute("aria-controls", "bo-room-list");
    sectionActions.append(count, roomsToggle); section.append(heading, sectionActions);
    const roomList = node("div", "room-list"); roomList.id = "bo-room-list"; roomList.setAttribute("role", "region"); roomList.setAttribute("aria-label", "BeoLink-Lautsprecher"); this._rooms = [];
    this._config.members.forEach((member, index) => {
      const row = node("div", "room"); row.hidden = !this._roomsExpanded; const top = node("div", "room-top");
      const picture = new SpeakerPicture();
      const copy = node("div", "room-copy"); const roomName = node("p", "room-name");
      const state = node("p", "room-state"); state.setAttribute("aria-live", "polite"); copy.append(roomName, state);
      const label = node("label", "toggle-label");
      const toggle = node("input", "toggle"); toggle.type = "checkbox"; toggle.setAttribute("role", "switch");
      toggle.addEventListener("change", () => this._toggle(index, toggle.checked));
      label.append(toggle); top.append(picture.element, copy, label);
      const volume = new VolumeControl(this, member.entity, member.name || "Lautsprecher " + (index + 1));
      volume.element.classList.add("room-volume"); row.append(top, volume.element); roomList.append(row);
      this._rooms.push({ row, roomName, state, toggle, volume, picture });
    });
    const empty = node("p", "small empty", "Im Karteneditor mit „+ Lautsprecher hinzufügen“ weitere Räume auswählen.");
    empty.hidden = !this._roomsExpanded || this._rooms.length > 0;
    const groupControls = node("section", "group-controls"); groupControls.hidden = true;
    const groupHeading = node("h3", "", "Alle verbundenen Lautsprecher");
    const groupRow = node("div", "group-controls-row"); this._groupVolume = new GroupVolumeControl(this);
    const groupButtons = node("div", "group-buttons");
    const groupMute = button("Alle verbundenen Lautsprecher stummschalten", "mdi:volume-high", () => this._groupMute(), "group-mute");
    const groupPower = button("Alle verbundenen Lautsprecher ausschalten", "mdi:power", () => this._groupPower(), "power");
    groupButtons.append(groupMute, groupPower); groupRow.append(this._groupVolume.element, groupButtons);
    groupControls.append(groupHeading, groupRow);
    const errorBox = node("div", "error-box"); const error = node("p", "message error");
    error.setAttribute("role", "alert");
    const dismiss = button("Fehlermeldung schließen", "mdi:close", () => this._setError(""));
    errorBox.append(error, dismiss); errorBox.hidden = true;
    wrap.append(head, notice, player, groupControls, section, roomList, empty, errorBox); card.append(wrap);
    this.shadowRoot.replaceChildren(style, card);
    this._ui = { wrap, track, trackCopy, cover, playerControls, name, subtitle, more, power, notice, player, title, artist, source, image, previous, play, next, sourceField, sourceSelect, favorites, favoriteButtons, actionStatus, count, roomsToggle, roomList, empty, groupControls, groupHeading, groupMute, groupPower, errorBox, error };
    this._updateRoomVisibility();
    this._observeSize();
  }
  _update() {
    if (!this._ui || !this._hass) return;
    const config = this._config; const group = groupState(this._hass, config.master);
    const state = group.state; const ui = this._ui;
    const masterName = displayName(state, config.master || "B&O Multiroom");
    ui.name.textContent = config.name || masterName;
    ui.subtitle.textContent = config.name ? "Hauptspieler · " + masterName : "Hauptspieler";
    this._mainPicture.update(speakerImage(config.master_model, config.master_image, config.master_image_dark, this._hass), this._hass);
    ui.more.disabled = !state;
    const isOn = powered(state); let powerProblem = "";
    try { buildPowerCall(config.master, !isOn, this._hass); } catch (error) { powerProblem = errorMessage(error); }
    ui.power.disabled = Boolean(powerProblem || this._powerBusy || this._groupBusy);
    ui.power.dataset.on = String(isOn); ui.power.setAttribute("aria-pressed", String(isOn));
    ui.power.setAttribute("aria-label", isOn ? "Hauptspieler ausschalten" : "Hauptspieler einschalten");
    ui.power.title = powerProblem || (isOn ? "Hauptspieler in Standby versetzen" : "Hauptspieler einschalten / letzte Wiedergabe fortsetzen");
    ui.notice.textContent = !config.master ? "Bitte im Karteneditor einen Mozart-Hauptspieler auswählen." :
      !available(state) ? "Der Hauptspieler ist momentan nicht verfügbar." :
      !group.known ? "Der Hauptspieler meldet noch keinen BeoLink-Status. Bitte die Entität aus der offiziellen Bang & Olufsen-Integration auswählen." :
      group.follower ? masterName + " folgt gerade „" + (group.leader?.name || "einem anderen Gerät") + "“. Für diese Karte die Wiedergabe direkt auf " + masterName + " starten." : "";
    ui.notice.hidden = !ui.notice.textContent;
    ui.player.hidden = !config.master;
    const attr = state?.attributes || {};
    const stateText = { playing: "Wiedergabe", paused: "Pausiert", idle: "Bereit", off: "Standby", standby: "Standby", buffering: "Lädt …", unavailable: "Nicht verfügbar", unknown: "Unbekannt" };
    ui.title.textContent = attr.media_title || attr.media_channel || (state?.state === "playing" ? "Wiedergabe" : "Keine Wiedergabe");
    ui.artist.textContent = [attr.media_artist || attr.media_album_artist, attr.media_album_name].filter(Boolean).join(" · ");
    ui.artist.hidden = !ui.artist.textContent;
    ui.source.textContent = [attr.source, stateText[state?.state] || state?.state].filter(Boolean).join(" · ");
    const base = this._hass.hassUrl ? this._hass.hassUrl("/") : globalThis.location?.origin;
    const imageUrl = safeImageUrl(attr.entity_picture, base);
    if (imageUrl !== this._imageUrl) {
      this._imageUrl = imageUrl;
      ui.image.hidden = !imageUrl;
      if (imageUrl) ui.image.src = imageUrl; else ui.image.removeAttribute("src");
    }
    ui.previous.disabled = Boolean(this._groupBusy || this._powerBusy) || !available(state) || !supports(state, FEATURES.PREVIOUS);
    ui.next.disabled = Boolean(this._groupBusy || this._powerBusy) || !available(state) || !supports(state, FEATURES.NEXT);
    const playing = state?.state === "playing";
    ui.play.disabled = Boolean(this._groupBusy || this._powerBusy) || !available(state) || !supports(state, playing ? FEATURES.PAUSE : FEATURES.PLAY);
    ui.play.setAttribute("aria-label", playing ? "Wiedergabe pausieren" : "Wiedergabe starten");
    ui.play.firstElementChild.setAttribute("icon", playing ? "mdi:pause" : "mdi:play");
    const sources = sourceOptions(state); const currentSource = typeof attr.source === "string" ? attr.source : "";
    const signature = JSON.stringify([sources, currentSource]);
    if (ui.sourceSelect._signature !== signature) {
      ui.sourceSelect._signature = signature; ui.sourceSelect.replaceChildren();
      const blank = node("option", "", sources.length ? "Quelle auswählen" : "Keine Quellen gemeldet"); blank.value = ""; blank.disabled = true; ui.sourceSelect.append(blank);
      if (currentSource && !sources.includes(currentSource)) {
        const current = node("option", "", currentSource + " (aktuell)"); current.value = currentSource; current.disabled = true; ui.sourceSelect.append(current);
      }
      for (const source of sources) { const option = node("option", "", source); option.value = source; ui.sourceSelect.append(option); }
    }
    ui.sourceSelect.value = currentSource;
    ui.sourceSelect.disabled = Boolean(this._playerRequest || this._groupBusy || this._powerBusy) || !available(state) || !supports(state, FEATURES.SELECT_SOURCE) || !sources.length || !hasService(this._hass, "media_player", "select_source");
    for (const favorite of ui.favoriteButtons) favorite.disabled = Boolean(this._playerRequest || this._groupBusy || this._powerBusy) || !available(state) || !group.own || !supports(state, FEATURES.PLAY_MEDIA) || !hasService(this._hass, "media_player", "play_media");
    if (this._playerFeedback && Date.now() > this._playerFeedback.until) this._playerFeedback = null;
    ui.actionStatus.textContent = this._playerFeedback?.text || ""; ui.actionStatus.hidden = !this._playerFeedback;
    this._mainVolume.name = masterName;
    this._mainVolume.label.textContent = "Lautstärke · " + masterName;
    this._mainVolume.input.setAttribute("aria-label", "Lautstärke " + masterName);
    this._mainVolume.update(state);
    let count = 0;
    this._rooms.forEach((row, index) => {
      const info = roomState(config, index, this._hass); const key = String(index);
      let pending = this._pending.get(key);
      if (pending && info.joined === pending.desired && !info.problem) {
        this._pending.delete(key); pending = null;
      }
      if (pending && Date.now() > pending.deadline) {
        this._pending.delete(key); pending = null;
        this._error = info.name + ": Noch keine Bestätigung vom Hauptspieler. Angezeigt wird der zuletzt gemeldete BeoLink-Status. Bitte Wiedergabe, Erreichbarkeit und HA-Protokoll prüfen.";
      }
      if (info.joined) count++;
      row.row.dataset.joined = String(info.joined === true);
      row.roomName.textContent = info.name;
      row.picture.update(speakerImage(info.model, info.image, info.image_dark, this._hass), this._hass);
      row.toggle.checked = info.joined === true;
      row.toggle.disabled = Boolean(info.problem || pending || this._groupBusy || this._powerBusy);
      row.toggle.setAttribute("aria-label", info.name + " im BeoLink Multiroom");
      row.toggle.setAttribute("aria-busy", String(Boolean(pending)));
      row.state.textContent = pending ? (pending.desired ? "Verbinden …" : "Trennen …") :
        info.problem || (info.joined ? "Mit " + masterName + " verbunden" : "Nicht verbunden");
      row.volume.element.hidden = info.joined !== true;
      row.volume.name = info.name;
      row.volume.label.textContent = "Lautstärke · " + info.name;
      row.volume.input.setAttribute("aria-label", "Lautstärke " + info.name);
      row.volume.update(info.entityState, info.wrongVolume);
    });
    ui.count.textContent = group.known && !group.follower ? count + " verbunden" : "Status offen";
    this._updateRoomVisibility();
    const all = connectedPlayers(config, this._hass);
    const recalled = !all.jids.length && this._groupRecall?.master === config.master;
    ui.groupControls.hidden = !(group.known && !group.follower && (all.jids.length || recalled));
    ui.groupHeading.textContent = config.group_name || (recalled ? "Letzte Gruppe fortsetzen" : "Alle verbundenen Lautsprecher");
    ui.groupControls.setAttribute("aria-busy", String(Boolean(this._groupBusy)));
    this._groupVolume.input.setAttribute("aria-label", "Lautstärke · " + (config.group_name || "Alle verbundenen Lautsprecher"));
    this._groupVolume.update(recalled ? { ...all, mean: this._groupRecall.mean } : all);
    const muted = all.targets.every(item => item.state?.attributes?.is_volume_muted === true);
    let muteProblem = "", offProblem = "";
    try { buildGroupMuteCall(config, !muted, this._hass); } catch (error) { muteProblem = errorMessage(error); }
    try {
      if (recalled) {
        buildPowerCall(config.master, true, this._hass);
        if (!hasService(this._hass, "bang_olufsen", "beolink_expand")) throw new Error("BeoLink-Verbinden nicht verfügbar.");
      } else buildGroupOffCall(config, this._hass);
    } catch (error) { offProblem = errorMessage(error); }
    ui.groupMute.disabled = Boolean(muteProblem || this._groupBusy || this._powerBusy);
    ui.groupMute.setAttribute("aria-pressed", String(muted && !recalled));
    ui.groupMute.firstElementChild.setAttribute("icon", muted && !recalled ? "mdi:volume-off" : "mdi:volume-high");
    ui.groupMute.setAttribute("aria-label", muted ? "Stummschaltung aller verbundenen Lautsprecher aufheben" : "Alle verbundenen Lautsprecher stummschalten");
    ui.groupMute.title = muteProblem || ui.groupMute.getAttribute("aria-label");
    ui.groupPower.disabled = Boolean(offProblem || this._groupBusy || this._powerBusy);
    ui.groupPower.dataset.on = String(!recalled); ui.groupPower.setAttribute("aria-pressed", String(!recalled));
    ui.groupPower.setAttribute("aria-label", recalled ? "Letzte Gruppe einschalten" : "Alle verbundenen Lautsprecher ausschalten");
    ui.groupPower.title = offProblem || ui.groupPower.getAttribute("aria-label");
    this._groupVolume.input.title = this._groupBusy || groupProblem(all, FEATURES.VOLUME, "Lautstärke") || this._groupVolume.input.getAttribute("aria-label");
    this._updateError();
  }
}

const editorCss = `
  ${pictureCss}
  :host{--bo-accent:#F3C644;--bo-on-accent:#28220D;display:block;font-family:var(--paper-font-body1_-_font-family,Roboto,Arial,sans-serif);color:var(--primary-text-color,#202428)}
  *{box-sizing:border-box}h3,p{margin:0}h3{font-size:16px;font-weight:500}p{font-size:12px;line-height:1.5;color:var(--secondary-text-color,#68747a)}
  [hidden]{display:none!important}.editor{display:grid;gap:18px;padding:4px 0;border:0;margin:0;min-width:0}.field{display:grid;gap:6px;margin-top:12px}.field>span{font-size:13px}
  select,input[type=text],input[type=number]{font:inherit;font-size:16px;width:100%;min-width:0;padding:12px;border:1px solid var(--divider-color,#ccd4d9);border-radius:8px;background:var(--card-background-color,#fff);color:var(--primary-text-color,#202428)}
  .height-control{display:grid;gap:8px;margin-top:14px}.height-label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px}.height-control input[type=range]{width:100%;margin:8px 0;accent-color:var(--bo-accent)}.height-control output{font-size:13px;white-space:nowrap}
  .size-editor{display:grid;gap:12px;margin-top:18px;padding:14px;border:1px solid var(--divider-color,#dce3e7);border-radius:12px}
  .width-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.width-choice{display:grid;gap:8px;justify-items:start;align-content:start;min-width:0;min-height:82px;padding:10px;border:1px solid var(--divider-color,#dce3e7);border-radius:9px;font-size:13px;text-align:left;overflow-wrap:anywhere}.width-choice[aria-pressed=true]{border-color:var(--bo-accent);box-shadow:inset 0 0 0 1px var(--bo-accent)}.width-preview{display:block;width:100%;height:18px;background:var(--divider-color,#dce3e7);border-radius:3px;overflow:hidden}.width-preview span{display:block;height:100%;background:var(--primary-text-color,#444)}.width-choice[aria-pressed=true] .width-preview span{background:var(--bo-accent)}
  .size-output{font-size:13px;line-height:1.5}.size-upgrade{display:grid;gap:10px;padding:12px;background:var(--secondary-background-color,#eef1f3);border-radius:9px}.size-upgrade button{padding:8px 12px;background:var(--bo-accent);color:var(--bo-on-accent,#28220D)}

  .member{padding:14px;border:1px solid var(--divider-color,#dce3e7);border-radius:12px;margin-top:12px}
  .member-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.member-top h3{overflow-wrap:anywhere}
  .row-actions{display:flex;gap:2px;flex-shrink:0}button{font:inherit;font-size:14px;min-height:44px;min-width:44px;background:transparent;border:0;color:var(--primary-text-color,#202428);border-radius:8px;cursor:pointer}
  button:disabled{opacity:.35;cursor:default}button:hover:not(:disabled){background:var(--secondary-background-color,#eef1f3)}
  button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--bo-accent,#F3C644);outline-offset:3px}
  .add{display:flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid var(--divider-color,#dce3e7);margin-top:14px;border-radius:9px}
  ha-icon{--mdc-icon-size:20px}details{margin-top:12px}summary{font-size:13px;cursor:pointer;min-height:36px;display:list-item;padding-top:8px}
  .warning{margin-top:10px;color:var(--error-color,#db4437)}.hint{margin-top:8px}.version{padding-top:4px;font-size:11px}
  .photo-field{margin-top:16px}.photo-heading{font-size:13px;color:var(--primary-text-color,#202428);margin-bottom:8px}.photo-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.photo-tools button{padding:6px 10px;border:1px solid var(--divider-color,#dce3e7)}.upload-status{font-size:13px;line-height:1.5}
  .photo-slot+.photo-slot{margin-top:14px;padding-top:14px;border-top:1px solid var(--divider-color,#dce3e7)}.photo-slot[data-variant=light] .speaker-picture{background:#f4f4f4;color:#646464}.photo-slot[data-variant=dark] .speaker-picture{background:#252525;color:#c4c4c4}
  .display-options{border-top:1px solid var(--divider-color,#dce3e7);padding-top:18px}.display-option{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:52px;cursor:pointer}.display-option span{font-size:14px}
  .display-toggle{appearance:none;-webkit-appearance:none;flex:0 0 46px;width:46px;height:27px;border:0;border-radius:16px;margin:0;background:var(--disabled-color,#9da7ad);position:relative;cursor:pointer}
  .display-toggle:before{content:"";position:absolute;top:3px;left:3px;width:21px;height:21px;background:var(--card-background-color,#fff);border-radius:50%}.display-toggle:checked{background:var(--bo-accent,#F3C644)}.display-toggle:checked:before{transform:translateX(19px)}
  .library-tools{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.library-tools button{border:1px solid var(--divider-color,#dce3e7);padding:8px 12px;color:var(--primary-text-color,#202428)}
  .image-library{border-top:1px solid var(--divider-color,#dce3e7);padding-top:18px}.gallery{margin-top:12px;padding:12px;border:1px solid var(--divider-color,#dce3e7);border-radius:12px}.gallery-head{display:flex;gap:12px;justify-content:space-between;align-items:center}.gallery-status{margin:10px 0}.gallery-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:8px;max-height:360px;overflow:auto;margin-top:12px}.gallery-choice{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 6px;border:1px solid var(--divider-color,#dce3e7);border-radius:9px;min-width:0;color:var(--primary-text-color,#202428)}.gallery-choice .speaker-picture{width:68px;height:70px;flex-basis:70px}.gallery-choice span{font-size:11px;overflow-wrap:anywhere;line-height:1.35}.gallery-choice[aria-pressed=true]{border-color:var(--bo-accent);box-shadow:inset 0 0 0 1px var(--bo-accent)}
  .gallery-item{display:flex;flex-direction:column;min-width:0}.gallery-item>.gallery-choice{width:100%;flex:1}.gallery-choice .speaker-picture{background:#858585;color:#fff}.image-delete{display:flex;align-items:center;justify-content:center;gap:5px;width:100%;font-size:12px}.delete-confirm{border:1px solid var(--divider-color,#dce3e7);border-radius:9px;padding:12px;margin:12px 0}.delete-confirm p{font-size:13px;color:var(--primary-text-color,#202428)}.delete-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.delete-actions button{padding:6px 12px;border:1px solid var(--divider-color,#dce3e7)}.delete-actions .confirm-delete{color:var(--error-color,#db4437)}
`;
export class BeolinkMultiroomEditor extends BaseElement {
  constructor() {
    super(); this.attachShadow({ mode: "open" }); this._config = editorSizeConfig({});
    this._manual = new Set(); this._optionSignature = "";
  }
  setConfig(config) {
    this._needsSizeUpgrade = typeof (config.grid_options?.rows ?? config.layout_options?.grid_rows) === "number";
    this._config = editorSizeConfig(config); this._render();
  }
  set hass(value) {
    this._hass = value;
    if (!this._rendered) this._render();
    else this._refreshOptions();
  }
  get hass() { return this._hass; }
  _emit() {
    this._config = editorSizeConfig(this._config);
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: JSON.parse(JSON.stringify(this._config)) }, bubbles: true, composed: true
    }));
  }
  _changeMain(value) {
    const same = value === this._config.master;
    this._config = { ...this._config, master: value, master_image: same ? this._config.master_image : "", master_image_dark: same ? this._config.master_image_dark : "",
      ...(this._config.master_model !== undefined ? { master_model: same ? this._config.master_model : "" } : {}) };
    this._render(); this._emit();
  }
  _changeMember(index, changes) {
    if (Object.hasOwn(changes, "jid") && changes.jid !== effectiveJid(this._config.members[index], this._hass) && !Object.hasOwn(changes, "image")) changes = { ...changes, image: "", image_dark: "",
      ...(this._config.members[index]?.model !== undefined && !Object.hasOwn(changes, "model") ? { model: "" } : {}) };
    this._config = { ...this._config, members: this._config.members.map((item, i) => i === index ? { ...item, ...changes } : item) };
    this._refreshOptions(true); this._emit();
  }
  _photoTarget(index, variant = "light") {
    const member = index === null ? null : this._config.members[index];
    return JSON.stringify([this._config.master, index, member ? effectiveJid(member, this._hass) : null, member?.entity, variant,
      index === null ? this._config.master_model : member?.model]);
  }
  _setModel(index, value) {
    if (value && !builtInSpeakers.has(value)) return;
    if (index === null) {
      this._config = { ...this._config, master_model: value };
      this._refreshOptions(true); this._emit();
    } else if (this._config.members[index]) this._changeMember(index, { model: value });
  }
  _setPhoto(index, value, variant = "light") {
    const suffix = variant === "dark" ? "_dark" : "";
    if (index === null) {
      this._config = { ...this._config, ["master_image" + suffix]: value };
      this._refreshOptions(true); this._emit();
    } else if (this._config.members[index]) this._changeMember(index, { ["image" + suffix]: value });
  }
  _syncUpload() {
    if (this._fieldset) this._fieldset.disabled = Boolean(this._uploadJob || this._bulkJob || this._deleteJob);
    if (this._uploadNotice) {
      this._uploadNotice.textContent = this._uploadMessage || "";
      this._uploadNotice.hidden = !this._uploadMessage;
    }
  }
  async _uploadPhoto(index, file, variant = "light") {
    if (!file || this._uploadJob || this._bulkJob || this._deleteJob) return;
    const job = { target: this._photoTarget(index, variant) };
    this._uploadJob = job; this._uploadMessage = "Foto wird in Home Assistant gespeichert …"; this._syncUpload();
    try {
      const url = await uploadSpeakerPhoto(this._hass, file);
      if (job.target !== this._photoTarget(index, variant)) throw new Error("Die Lautsprecherzuordnung hat sich während des Uploads geändert. Bitte das Foto erneut auswählen.");
      this._setPhoto(index, url, variant);
      this._images = null;
      this._uploadMessage = "Foto übernommen. Die Karte anschließend speichern.";
    } catch (error) { this._uploadMessage = "Foto: " + errorMessage(error); }
    finally { this._uploadJob = null; this._syncUpload(); }
  }
  _photoField(index, label) {
    const element = node("section", "photo-field");
    const modelSelect = node("select"); modelSelect.className = "speaker-model";
    modelSelect.setAttribute("aria-label", "Lautsprechermodell für " + label);
    modelSelect.addEventListener("change", () => this._setModel(index, modelSelect.value));
    element.append(this._field("Lautsprechermodell", modelSelect));
    const slot = (variant, title) => {
      const box = node("div", "photo-slot"); box.dataset.variant = variant;
      box.append(node("p", "photo-heading", title));
      const picture = new SpeakerPicture();
      const file = node("input"); file.type = "file"; file.accept = "image/jpeg,image/png,image/gif"; file.hidden = true;
      file.setAttribute("aria-label", "Foto für " + label + " · " + title);
      file.addEventListener("change", () => { const selected = file.files?.[0]; file.value = ""; this._uploadPhoto(index, selected, variant); });
      const upload = button("Foto hochladen", null, () => file.click(), "photo-upload");
      const choose = button("Aus HA auswählen", null, () => this._openLibrary(index, label, variant), "photo-choose");
      const remove = button(variant === "dark" ? "Wie helles Dashboard" : "Standard-Icon", null, () => this._setPhoto(index, "", variant), "photo-remove");
      const top = node("div", "photo-tools"); top.append(picture.element, choose, upload, remove, file); box.append(top);
      const details = node("details"); details.append(node("summary", "", "Bildadresse statt Upload"));
      const input = node("input"); input.type = "text"; input.placeholder = "/local/lautsprecher/bild.png";
      input.setAttribute("aria-label", "Bildadresse für " + label + " · " + title);
      input.addEventListener("change", () => this._setPhoto(index, input.value.trim(), variant));
      details.append(this._field("Bildadresse", input)); box.append(details); element.append(box);
      return { input, file, picture, remove, update: (value, fallback = "", model = "") => {
        const builtIn = builtInSpeakers.has(model);
        picture.update(builtIn ? "beolink-icon:" + model + ":" + variant : value || fallback, this._hass);
        upload.hidden = builtIn; choose.hidden = builtIn; details.hidden = builtIn;
        remove.hidden = builtIn || !value;
        if (this.shadowRoot.activeElement !== input) input.value = value || "";
      } };
    };
    const light = slot("light", "Helles Dashboard / Standardbild");
    const dark = slot("dark", "Dunkles Dashboard (optional)");
    const hint = node("p", "hint"); element.append(hint);
    return { ...light, element, dark, modelSelect, update: (value, darkValue, model = "") => {
      const options = BUILTIN_SPEAKERS.map(item => ({ value: item.id, label: item.name }));
      if (model && !builtInSpeakers.has(model)) options.push({ value: model, label: model + " · Modell nicht in dieser Version" });
      this._options(modelSelect, options, model, "Eigene Bilder / Standard-Icon");
      light.update(value, "", model); dark.update(darkValue, value, model);
      hint.textContent = builtInSpeakers.has(model)
        ? "Das mitgelieferte Icon wechselt automatisch mit dem hellen oder dunklen HA-Modus."
        : "Das Bild wechselt automatisch mit dem HA-Modus. Ohne dunkle Variante wird das Standardbild verwendet. Bilder löschen: unten unter „Bilder verwalten“.";
    } };
  }
  _librarySection() {
    const section = node("section", "image-library"); section.append(node("h3", "", "Bildsammlung auf HA"));
    section.append(node("p", "hint", "Bilder einmal hochladen und auf allen Geräten wieder auswählen. JPG, PNG oder GIF, je bis 8 MB. Einen Icon-Ordner zuerst entpacken."));
    const files = node("input"); files.type = "file"; files.multiple = true; files.accept = "image/jpeg,image/png,image/gif"; files.hidden = true;
    files.setAttribute("aria-label", "Bilder zur HA-Sammlung hinzufügen");
    const folder = node("input"); folder.type = "file"; folder.multiple = true; folder.setAttribute("webkitdirectory", ""); folder.hidden = true;
    folder.setAttribute("aria-label", "Icon-Ordner auf HA importieren");
    for (const input of [files, folder]) input.addEventListener("change", () => { const selected = [...(input.files || [])]; input.value = ""; this._importImages(selected); });
    const toolbar = node("div", "library-tools");
    toolbar.append(button("Bilder hinzufügen", null, () => files.click()), button("Ordner importieren", null, () => folder.click()), button("Bilder verwalten", null, () => this._openImageManager()), files, folder);
    section.append(toolbar);
    const gallery = node("div", "gallery"); this._gallery = gallery; gallery.hidden = true;
    const head = node("div", "gallery-head"); this._galleryTitle = node("h3");
    const close = button("Bildauswahl schließen", "mdi:close", () => { this._picker = null; this._deletePending = null; gallery.hidden = true; });
    head.append(this._galleryTitle, close); gallery.append(head);
    const search = node("input"); search.type = "text"; search.placeholder = "Name oder Ordner filtern …"; search.setAttribute("aria-label", "HA-Bilder filtern");
    search.value = this._imageQuery || ""; search.addEventListener("input", () => { this._imageQuery = search.value; this._renderGallery(); });
    gallery.append(this._field("Bilder suchen", search));
    gallery.append(button("Bildliste aktualisieren", null, () => this._loadImages()));
    this._galleryStatus = node("p", "gallery-status"); this._galleryStatus.setAttribute("role", "status");
    this._deleteConfirm = node("div", "delete-confirm"); this._deleteConfirm.hidden = true;
    this._deleteConfirm.setAttribute("role", "group"); this._deleteConfirm.setAttribute("aria-label", "Bildlöschung bestätigen");
    this._galleryGrid = node("div", "gallery-grid"); gallery.append(this._galleryStatus, this._deleteConfirm, this._galleryGrid);
    section.append(gallery); return section;
  }
  async _openLibrary(index, label, variant = "light") {
    this._deletePending = null;
    this._picker = { index, label, variant, target: this._photoTarget(index, variant) };
    this._renderGallery();
    this._gallery?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    await this._loadImages();
  }
  async _openImageManager() {
    this._deletePending = null; this._picker = { manage: true };
    this._renderGallery(); await this._loadImages();
  }
  async _loadImages() {
    if (this._deleteJob) return;
    const token = {}; this._imageRequest = token; this._libraryMessage = "Bildsammlung wird geladen …"; this._renderGallery();
    try {
      const items = await fetchSpeakerImages(this._hass);
      if (this._imageRequest !== token) return;
      this._images = items; this._libraryMessage = "";
    } catch (error) {
      if (this._imageRequest !== token) return;
      this._images = []; this._libraryMessage = "Bildsammlung: " + errorMessage(error);
    } finally {
      if (this._imageRequest === token) { this._imageRequest = null; this._renderGallery(); }
    }
  }
  _renderGallery() {
    if (!this._gallery) return;
    this._gallery.hidden = !this._picker;
    if (!this._picker) return;
    const picker = this._picker;
    this._galleryTitle.textContent = picker.manage ? "Bilder auf HA verwalten" : "Bild für " + picker.label + " · " + (picker.variant === "dark" ? "Dunkel" : "Hell");
    const query = (this._imageQuery || "").toLocaleLowerCase("de").trim();
    const choices = (this._images || []).filter(item => !query || item.name.toLocaleLowerCase("de").includes(query));
    this._galleryStatus.textContent = this._libraryMessage || (choices.length ? choices.length + " Bilder" + (picker.manage ? " auf HA" : " · zum Übernehmen anklicken") : "Keine passenden Bilder. Über „Bilder hinzufügen“ oder „Ordner importieren“ ergänzen.");
    this._galleryGrid.replaceChildren();
    const suffix = picker.variant === "dark" ? "_dark" : "";
    const current = picker.manage ? "" : picker.index === null ? this._config["master_image" + suffix] : this._config.members[picker.index]?.["image" + suffix];
    for (const item of choices) {
      const cell = node("div", "gallery-item");
      const choice = picker.manage ? node("div", "gallery-choice") : button(item.name, null, () => {
        if (this._uploadJob || this._bulkJob || this._deleteJob) return;
        if (picker.target !== this._photoTarget(picker.index, picker.variant)) {
          this._libraryMessage = "Lautsprecherzuordnung geändert. Bitte die Bildauswahl am gewünschten Lautsprecher erneut öffnen."; this._renderGallery(); return;
        }
        this._setPhoto(picker.index, item.url, picker.variant); this._picker = null; this._deletePending = null; this._gallery.hidden = true;
        this._uploadMessage = "Bild übernommen. Karte anschließend speichern."; this._syncUpload();
      }, "gallery-choice");
      const picture = new SpeakerPicture(); picture.update(item.url, this._hass);
      choice.replaceChildren(picture.element, node("span", "", item.name)); choice.title = item.name;
      if (!picker.manage) choice.setAttribute("aria-pressed", String(item.url === current));
      const remove = button("Bild löschen: " + item.name, "mdi:delete-outline", () => this._requestImageDelete(item), "image-delete");
      remove.append(node("span", "", "Löschen")); remove.title = "Bild von HA löschen";
      cell.append(choice, remove); this._galleryGrid.append(cell);
    }
    this._renderDeleteConfirm();
  }
  _requestImageDelete(item) {
    if (this._uploadJob || this._bulkJob || this._deleteJob || !this._images?.some(image => image.id === item.id)) return;
    this._deletePending = { id: item.id, name: item.name };
    this._renderDeleteConfirm(); this._deleteConfirm?.scrollIntoView?.({ block: "nearest" });
  }
  _renderDeleteConfirm() {
    if (!this._deleteConfirm) return;
    const item = this._deletePending;
    this._deleteConfirm.hidden = !item; this._deleteConfirm.replaceChildren();
    if (!item) return;
    const usages = [this._config.master_image, this._config.master_image_dark,
      ...this._config.members.flatMap(member => [member.image, member.image_dark])]
      .filter(url => uploadedImageId(url, this._hass) === item.id).length;
    const message = node("p", "", "„" + item.name + "“ dauerhaft von HA löschen? Das Bild fehlt danach auch an anderen Stellen, die es verwenden." +
      (usages ? " " + usages + " Bildzuordnung(en) in dieser Karte werden entfernt; Karte danach speichern." : ""));
    const actions = node("div", "delete-actions");
    actions.append(button("Abbrechen", null, () => { this._deletePending = null; this._renderDeleteConfirm(); }, "cancel-delete"),
      button("Endgültig löschen", null, () => this._deleteImage(), "confirm-delete"));
    this._deleteConfirm.append(message, actions);
  }
  async _deleteImage() {
    const item = this._deletePending;
    if (!item || this._uploadJob || this._bulkJob || this._deleteJob) return;
    this._deleteJob = true; this._imageRequest = null;
    this._uploadMessage = "Bild wird von HA gelöscht …"; this._syncUpload();
    try {
      await deleteSpeakerImage(this._hass, item.id);
      this._images = (this._images || []).filter(image => image.id !== item.id);
      const next = clearImageReferences(this._config, item.id, this._hass);
      if (JSON.stringify(next) !== JSON.stringify(this._config)) {
        this._config = next; this._refreshOptions(true); this._emit();
      }
      this._deletePending = null; this._libraryMessage = "Bild von HA gelöscht.";
      this._uploadMessage = "Bild gelöscht. Geänderte Bildzuordnungen durch Speichern der Karte übernehmen.";
    } catch (error) {
      this._libraryMessage = "Bild konnte nicht gelöscht werden: " + errorMessage(error);
      this._uploadMessage = this._libraryMessage;
    } finally { this._deleteJob = false; this._syncUpload(); this._renderGallery(); }
  }
  async _importImages(files) {
    if (!files.length || this._uploadJob || this._bulkJob || this._deleteJob) return;
    const supported = files.filter(file => ["image/jpeg", "image/png", "image/gif"].includes(file.type));
    if (!supported.length) { this._uploadMessage = "Bitte JPG-, PNG- oder GIF-Dateien bzw. einen entpackten Icon-Ordner auswählen."; this._syncUpload(); return; }
    this._bulkJob = true; let done = 0; const errors = [];
    try {
      for (let index = 0; index < supported.length; index++) {
        this._uploadMessage = "Bilder werden auf HA gespeichert: " + (index + 1) + " / " + supported.length; this._syncUpload();
        try { await uploadSpeakerPhoto(this._hass, supported[index]); done++; }
        catch (error) { errors.push((supported[index].webkitRelativePath || supported[index].name) + ": " + errorMessage(error)); }
      }
      await this._loadImages();
      this._uploadMessage = done + " Bilder auf HA gespeichert." + (files.length > supported.length ? " Andere Dateiformate wurden übersprungen." : "") +
        (errors.length ? " Fehlgeschlagen: " + errors.join("; ") : " Bei einem Lautsprecher „Aus HA auswählen“ öffnen.");
    } finally { this._bulkJob = false; this._syncUpload(); }
  }
  _add() {
    this._config = { ...this._config, members: [...this._config.members, { jid: "", entity: "", name: "" }] };
    this._render(); this._emit();
  }
  _remove(index) {
    this._config = { ...this._config, members: this._config.members.filter((_, i) => i !== index) };
    this._manual.clear(); this._render(); this._emit();
  }
  _move(index, offset) {
    const target = index + offset; const members = [...this._config.members];
    if (target < 0 || target >= members.length) return;
    [members[index], members[target]] = [members[target], members[index]];
    this._config = { ...this._config, members }; this._manual.clear(); this._render(); this._emit();
  }
  _changeWidth(columns) {
    if (columns !== "full" && (!Number.isInteger(columns) || columns < 6 || columns > 24)) { this._refreshSize?.(); return; }
    this._config = { ...this._config, grid_options: { ...this._config.grid_options, columns, rows: "auto" } };
    this._refreshSize?.(); this._emit();
  }
  _sizePicker() {
    const root = node("section", "size-editor");
    root.append(node("h3", "", "Kartengröße"), node("p", "", "Die Kacheln ändern ausschließlich die Breite. Der Hauptbereich bleibt mindestens 560 px hoch; zusätzlichen Inhalt zeigt die Karte vollständig darunter."));
    if (this._needsSizeUpgrade) {
      const notice = node("div", "size-upgrade");
      notice.append(node("p", "", "In deiner Karte ist noch eine feste Gesamthöhe gespeichert. Übernimm einmal die Größenkorrektur und speichere die Karte, damit die Höhe mit dem Inhalt wachsen kann."));
      const apply = button("Größenkorrektur übernehmen", null, () => {
        this._needsSizeUpgrade = false; this._emit();
        apply.disabled = true; apply.textContent = "Übernommen – Karte speichern";
      });
      apply.dataset.action = "apply-size"; notice.append(apply); root.append(notice);
    }
    const presets = node("div", "width-presets"); presets.setAttribute("role", "group"); presets.setAttribute("aria-label", "Kartenbreite");
    const choices = [];
    for (const [columns, label] of [[6, "Halb"], [9, "Dreiviertel"], [12, "Normal"], [18, "Anderthalb"], [24, "Doppelt"], ["full", "Volle Breite"]]) {
      const choice = button(label, null, () => this._changeWidth(columns), "width-choice");
      choice.dataset.columns = String(columns);
      choice.setAttribute("aria-label", label + (columns === "full" ? " · gesamte verfügbare Breite" : " · " + columns + " Rasterspalten"));
      const preview = node("span", "width-preview"); preview.setAttribute("aria-hidden", "true");
      const fill = node("span"); fill.style.width = (columns === "full" ? 100 : columns / 24 * 100) + "%"; preview.append(fill);
      choice.replaceChildren(preview, node("span", "", label)); presets.append(choice); choices.push(choice);
    }
    root.append(presets);
    const width = node("input"); width.type = "number"; width.min = "6"; width.max = "24"; width.step = "1"; width.dataset.config = "grid_columns";
    width.addEventListener("change", () => this._changeWidth(Number(width.value)));
    const output = node("output", "size-output"); output.setAttribute("aria-live", "polite");
    root.append(this._field("Breite · Rasterspalten", width), output,
      node("p", "", "Die Gesamthöhe passt sich dem Inhalt an. Für ein größeres Cover den Höhenregler darunter verwenden. Die Breitenwahl verändert diese Höhe nicht."),
      node("p", "", "12 Rasterspalten entsprechen einer normalen Abschnittsbreite, 24 der doppelten. Für doppelte Breite muss auch der HA-Abschnitt zwei Spalten breit sein. Eine umgebende Raster-/Stapelkarte kann den Platz begrenzen."));
    this._refreshSize = () => {
      const columns = this._config.grid_options?.columns ?? 12;
      width.value = String(columns === "full" ? 24 : columns); width.disabled = columns === "full";
      for (const choice of choices) choice.setAttribute("aria-pressed", String(choice.dataset.columns === String(columns)));
      output.textContent = (columns === "full" ? "Volle verfügbare Breite" : columns + " Rasterspalten") + " · Hauptbereich mindestens " + this._config.player_height + " px";
    };
    this._refreshSize(); return root;
  }
  _field(label, control, hint) {
    const element = node("label", "field"); element.append(node("span", "", label), control);
    if (hint) element.append(node("p", "", hint));
    return element;
  }
  _options(select, values, selected, placeholder) {
    const signature = JSON.stringify([values, selected, placeholder]);
    if (select._signature === signature) return;
    select._signature = signature;
    const items = [...values];
    if (selected && !items.some(item => item.value === selected)) items.push({ value: selected, label: selected + " (aktuell nicht gefunden)" });
    select.replaceChildren();
    for (const option of [{ value: "", label: placeholder }, ...items]) {
      const element = node("option", "", option.label); element.value = option.value;
      element.selected = option.value === selected; select.append(element);
    }
    select.value = selected || "";
  }
  _render() {
    const activeCell = this.shadowRoot.activeElement;
    const widthFocus = activeCell?.classList.contains("width-choice") ? activeCell.dataset.columns : null;
    const style = node("style"); style.textContent = editorCss;
    const editor = node("fieldset", "editor"); this._fieldset = editor;
    const main = node("section"); main.append(node("h3", "", "Hauptlautsprecher"));
    this._masterSelect = node("select"); this._masterSelect.setAttribute("aria-label", "Hauptlautsprecher");
    this._masterSelect.addEventListener("change", () => this._changeMain(this._masterSelect.value));
    main.append(this._field("Mozart-Hauptspieler", this._masterSelect, "Entität aus der offiziellen Bang & Olufsen-Integration."));
    this._masterHint = node("p", "hint"); main.append(this._masterHint);
    const title = node("input"); title.type = "text"; title.value = this._config.name; title.placeholder = "Name des Hauptspielers";
    title.addEventListener("change", () => { this._config = { ...this._config, name: title.value.trim() }; this._emit(); });
    main.append(this._field("Kartentitel (optional)", title));
    this._masterPhoto = this._photoField(null, "Hauptspieler"); main.append(this._masterPhoto.element);
    const display = node("section", "display-options"); display.append(node("h3", "", "Anzeige"));
    const autoClose = node("input"); autoClose.type = "number"; autoClose.min = "0"; autoClose.max = "300"; autoClose.step = "1";
    autoClose.value = String(this._config.auto_close_seconds); autoClose.dataset.config = "auto_close_seconds";
    autoClose.addEventListener("change", () => {
      const seconds = Number(autoClose.value);
      if (autoClose.value.trim() === "" || !Number.isInteger(seconds) || seconds < 0 || seconds > 300) { autoClose.value = String(this._config.auto_close_seconds); return; }
      this._config = { ...this._config, auto_close_seconds: seconds }; this._emit();
    });
    display.append(this._field("Lautsprecherauswahl automatisch schließen · Sekunden", autoClose, "5 = nach 5 Sekunden ohne Bedienung zuklappen. Tippen, Lautstärke ändern und Scrollen starten die Zeit neu. Während einer laufenden Verbindung bleibt die Liste offen. 0 = ausgeschaltet."));
    for (const [key, text] of [["show_source", "Quellenauswahl anzeigen"], ["show_favorites", "Favoritentasten anzeigen"]]) {
      const label = node("label", "display-option");
      const toggle = node("input", "display-toggle"); toggle.type = "checkbox"; toggle.checked = this._config[key];
      toggle.setAttribute("role", "switch"); toggle.setAttribute("aria-label", text); toggle.dataset.config = key;
      toggle.addEventListener("change", () => {
        this._config = { ...this._config, [key]: toggle.checked }; this._emit();
      });
      label.append(node("span", "", text), toggle); display.append(label);
    }
    const groupName = node("input"); groupName.type = "text"; groupName.value = this._config.group_name;
    groupName.placeholder = "Alle verbundenen Lautsprecher"; groupName.dataset.config = "group_name";
    groupName.addEventListener("change", () => { this._config = { ...this._config, group_name: groupName.value.trim() }; this._emit(); });
    display.append(this._field("Name der Gruppensteuerung", groupName));
    display.append(this._sizePicker());
    const heightControl = node("label", "height-control");
    const heightLabel = node("div", "height-label"); const heightValue = node("output");
    const height = node("input"); height.type = "range"; height.min = String(MIN_PLAYER_HEIGHT); height.max = "2000"; height.step = "20";
    height.value = String(this._config.player_height); height.dataset.config = "player_height";
    height.setAttribute("aria-label", "Mindesthöhe des Hauptspieler-Bereichs");
    const showHeight = () => {
      heightValue.textContent = height.value + " px" + (Number(height.value) === MIN_PLAYER_HEIGHT ? " · Mindesthöhe" : "");
      height.setAttribute("aria-valuetext", heightValue.textContent);
    };
    showHeight(); height.addEventListener("input", showHeight);
    height.addEventListener("change", () => {
      height.value = String(Math.max(MIN_PLAYER_HEIGHT, Math.min(2000, Number(height.value) || MIN_PLAYER_HEIGHT)));
      this._config = { ...this._config, player_height: Number(height.value) }; showHeight(); this._refreshSize?.(); this._emit();
    });
    heightLabel.append(node("span", "", "Höhe des Hauptspieler-Bereichs"), heightValue);
    heightControl.append(heightLabel, height, node("p", "", "560 px ist die feste Untergrenze des geschlossenen Hauptbereichs. Längere Texte dürfen zusätzlichen Platz benötigen. Beim Öffnen der Lautsprecherauswahl wird nur die Darstellung kompakter; alle Bedienelemente bleiben sichtbar. Beim Schließen kehrt die eingestellte Höhe zurück."));
    display.append(heightControl);
    const rooms = node("section"); rooms.append(node("h3", "", "Weitere Lautsprecher"));
    rooms.append(node("p", "hint source-hint", "Zum Hinzufügen von Räumen zuerst eine BeoLink-fähige Quelle auf dem Hauptspieler starten."));
    this._memberRows = [];
    this._config.members.forEach((member, index) => {
      const box = node("section", "member"); const top = node("div", "member-top");
      const heading = node("h3", "", member.name || "Lautsprecher " + (index + 1));
      const actions = node("div", "row-actions");
      const up = button("Lautsprecher nach oben", "mdi:arrow-up", () => this._move(index, -1));
      up.disabled = index === 0;
      const remove = button("Lautsprecher entfernen", "mdi:delete-outline", () => this._remove(index));
      actions.append(up, remove); top.append(heading, actions); box.append(top);
      const peer = node("select"); peer.setAttribute("aria-label", "BeoLink-Lautsprecher " + (index + 1));
      const details = node("details"); const summary = node("summary", "", "JID manuell eingeben oder prüfen");
      const jid = node("input"); jid.type = "text"; jid.spellcheck = false; jid.value = member.jid;
      jid.placeholder = "Typ.Artikel.Seriennummer@products.bang-olufsen.com";
      jid.addEventListener("change", () => this._changeMember(index, { jid: jid.value.trim() }));
      details.append(summary, this._field("BeoLink-JID", jid));
      peer.addEventListener("change", () => {
        if (peer.value === "__manual__") {
          this._manual.add(index); details.open = true; jid.focus(); return;
        }
        this._manual.delete(index);
        const selectedJid = peer.value;
        const previous = this._config.members[index];
        const auto = matchingMozartEntity(this._hass, selectedJid);
        const changes = { jid: selectedJid };
        // Never match ASE volume by name alone; the user chooses its Beoplay entity.
        if (selectedJid !== effectiveJid(previous, this._hass)) changes.entity = auto || "";
        this._changeMember(index, changes);
      });
      box.append(this._field("BeoLink-Lautsprecher", peer), details);
      const entity = node("select"); entity.setAttribute("aria-label", "Lautstärke-Entität " + (index + 1));
      entity.addEventListener("change", () => {
        const changes = { entity: entity.value };
        if (!this._config.members[index].jid) {
          const auto = selfJid(this._hass?.states?.[entity.value]);
          if (auto) changes.jid = auto;
        }
        this._changeMember(index, changes);
      });
      box.append(this._field("Entität für die Lautstärke", entity, "Bei ASE die media_player-Entität aus Beoplay auswählen."));
      const name = node("input"); name.type = "text"; name.value = member.name; name.placeholder = "Name des BeoLink-Geräts";
      name.addEventListener("change", () => this._changeMember(index, { name: name.value.trim() }));
      box.append(this._field("Anzeigename (optional)", name));
      const photo = this._photoField(index, member.name || "Lautsprecher " + (index + 1)); box.append(photo.element);
      const warning = node("p", "warning"); box.append(warning);
      rooms.append(box); this._memberRows.push({ heading, peer, details, jid, entity, name, warning, photo });
    });
    const add = button("", "mdi:plus", () => this._add(), "add");
    add.append(node("span", "", "Lautsprecher hinzufügen")); add.setAttribute("aria-label", "Lautsprecher hinzufügen");
    rooms.append(add);
    editor.append(main, display, rooms, this._librarySection(), node("p", "version", "B&O Multiroom · Version " + VERSION));
    this._uploadNotice = node("p", "upload-status"); this._uploadNotice.setAttribute("role", "status");
    this.shadowRoot.replaceChildren(style, editor, this._uploadNotice); this._syncUpload();
    if (widthFocus) {
      const target = [...this.shadowRoot.querySelectorAll(".width-choice")].find(choice => choice.dataset.columns === widthFocus);
      target?.focus({ preventScroll: true });
    }
    this._rendered = true; this._refreshOptions(true); this._renderGallery();
  }
  _refreshOptions(force = false) {
    if (!this._rendered) return;
    const all = Object.entries(this._hass?.states || {}).filter(([id]) => mediaId(id));
    const peers = discoveredPeers(this._hass, this._config.master);
    this._masterPhoto.update(this._config.master_image, this._config.master_image_dark, this._config.master_model);
    const values = all.map(([id, state]) => ({ value: id, label: displayName(state, id) + " · " + id }));
    values.sort((a, b) => a.label.localeCompare(b.label, "de"));
    const masterValues = values.filter(item => Boolean(selfJid(this._hass?.states?.[item.value])) || item.value === this._config.master);
    this._options(this._masterSelect, masterValues, this._config.master, "Hauptlautsprecher auswählen");
    this._masterHint.textContent = !this._hass ? "Home Assistant lädt …" :
      masterValues.length === 0 ? "Noch kein Mozart-Player mit BeoLink-Attributen gefunden. Bitte die offizielle Integration und ihre media_player-Entitäten prüfen." :
      !this._config.master ? "Zuerst den Hauptspieler auswählen." :
      peers.length === 0 ? "Aktuell keine BeoLink-Geräte gemeldet. Bei Bedarf JID manuell eintragen." :
      peers.length + " BeoLink-Gerät" + (peers.length === 1 ? "" : "e") + " vom Hauptspieler gemeldet.";
    this._memberRows.forEach((row, index) => {
      const member = this._config.members[index]; const jid = effectiveJid(member, this._hass);
      row.photo.update(member.image, member.image_dark, member.model);
      const used = new Set(this._config.members.filter((_, i) => i !== index).map(item => effectiveJid(item, this._hass)));
      const choices = peers.filter(item => !used.has(item.jid) || item.jid === jid).map(item => ({ value: item.jid, label: item.name }));
      if (jid && !choices.some(item => item.value === jid)) choices.push({ value: jid, label: (member.name || "Manuell eingetragen") + " · " + jid });
      choices.push({ value: "__manual__", label: "JID manuell eingeben …" });
      this._options(row.peer, choices, this._manual.has(index) && !jid ? "__manual__" : jid, "BeoLink-Gerät auswählen");
      this._options(row.entity, values.filter(item => item.value !== this._config.master), member.entity, "Keine Lautstärke-Entität ausgewählt");
      if (this.shadowRoot.activeElement !== row.jid) row.jid.value = member.jid;
      if (this.shadowRoot.activeElement !== row.name) row.name.value = member.name;
      const peerName = peers.find(item => item.jid === jid)?.name;
      row.heading.textContent = member.name || peerName || "Lautsprecher " + (index + 1);
      if (this._manual.has(index) || (jid && !peers.some(item => item.jid === jid))) row.details.open = true;
      const info = roomState(this._config, index, this._hass);
      row.warning.textContent = member.jid && !isJid(member.jid) ? "Die JID hat nicht das erwartete Format." :
        info.group.own && jid === info.group.own ? "Der Hauptspieler darf nicht zusätzlich als Raum eingetragen werden." :
        jid && this._config.members.some((other, i) => i !== index && effectiveJid(other, this._hass) === jid) ? "Dieser BeoLink-Lautsprecher ist mehrfach eingetragen." :
        info.wrongVolume ? "Die ausgewählte Lautstärke-Entität gehört zu einem anderen BeoLink-Gerät." :
        member.entity === this._config.master && member.entity ? "Bitte die Lautstärke-Entität dieses Raums auswählen." : "";
      row.warning.hidden = !row.warning.textContent;
    });
  }
}

if (globalThis.customElements) {
  if (!customElements.get(TYPE)) customElements.define(TYPE, BeolinkMultiroomCard);
  if (!customElements.get(TYPE + "-editor")) customElements.define(TYPE + "-editor", BeolinkMultiroomEditor);
  globalThis.customCards = globalThis.customCards || [];
  if (!globalThis.customCards.some(card => card.type === TYPE)) globalThis.customCards.push({
    type: TYPE, name: "B&O Multiroom", preview: true,
    description: "B&O-Player mit Quellen, vier Favoriten, BeoLink-Raumschaltern und eigenen Lautsprecherfotos.",
    getEntitySuggestion: (hass, entityId) => mediaId(entityId) && selfJid(hass?.states?.[entityId]) ?
      { config: { type: "custom:" + TYPE, master: entityId, members: [] } } : null
  });
}
