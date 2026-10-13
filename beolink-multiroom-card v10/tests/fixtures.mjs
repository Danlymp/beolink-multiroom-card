export const MAIN = "media_player.beolab_8";
export const KITCHEN = "media_player.kueche";
export const LEVEL = "media_player.level";
export const MAIN_JID = "1000.1000000.10000000@products.bang-olufsen.com";
export const KITCHEN_JID = "3000.3000000.30000000@products.bang-olufsen.com";
export const LEVEL_JID = "2000.2000000.20000000@products.bang-olufsen.com";
export const config = {
  type: "custom:beolink-multiroom-card",
  master: MAIN,
  members: [
    { name: "Küche", jid: KITCHEN_JID, entity: KITCHEN },
    { name: "Schlafzimmer", jid: LEVEL_JID, entity: LEVEL }
  ]
};
export function fixture(joined = []) {
  const calls = [];
  const listeners = {};
  if (joined.includes(KITCHEN_JID)) listeners.Küche = KITCHEN_JID;
  if (joined.includes(LEVEL_JID)) listeners.Level = LEVEL_JID;
  const hass = {
    language: "de",
    hassUrl: path => "https://homeassistant.example" + path,
    services: {
      bang_olufsen: { beolink_expand: {}, beolink_unexpand: {} },
      media_player: { volume_set: {}, volume_mute: {}, turn_off: {}, turn_on: {}, media_play: {}, media_pause: {}, media_next_track: {}, media_previous_track: {}, select_source: {}, play_media: {} }
    },
    states: {
      [MAIN]: {
        entity_id: MAIN, state: "playing",
        attributes: {
          friendly_name: "BeoLab 8", media_title: "So What", media_artist: "Miles Davis",
          media_album_name: "Kind of Blue", source: "Deezer", volume_level: 0.32,
          supported_features: 18997 | 8 | 256, is_volume_muted: false, source_list: ["Deezer", "Line-in", "Bluetooth"],
          beolink: {
            self: { "BeoLab 8": MAIN_JID },
            peers: { Küche: KITCHEN_JID, Level: LEVEL_JID },
            ...(joined.length ? { listeners } : {})
          },
          group_members: joined.length ? [MAIN, ...joined.map(jid => jid === KITCHEN_JID ? "listener_not_in_hass-" + jid : LEVEL)] : []
        }
      },
      [KITCHEN]: { entity_id: KITCHEN, state: joined.includes(KITCHEN_JID) ? "playing" : "off", attributes: { friendly_name: "Küche", volume_level: 0.24, is_volume_muted: false, supported_features: 4 | 8 | 128 | 256 } },
      [LEVEL]: { entity_id: LEVEL, state: joined.includes(LEVEL_JID) ? "playing" : "off", attributes: { friendly_name: "Beosound Level", volume_level: 0.2, is_volume_muted: false, supported_features: 16437 | 8 | 256, beolink: { self: { Level: LEVEL_JID } } } }
    },
    callService: async (domain, service, data) => { calls.push({ domain, service, data }); }
  };
  return { hass, calls };
}
