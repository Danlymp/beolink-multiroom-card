# B&O Multiroom Card

A Home Assistant dashboard card for Bang & Olufsen speakers. Control playback, choose sources and favourites, and bring your rooms together with BeoLink Multiroom.

## Features

- Playback controls, album artwork and standby for the main speaker.
- Source selection and four favourite buttons for presets stored on the speaker.
- Join and leave BeoLink rooms directly from the card.
- Individual room volume and relative group volume, with group mute and standby.
- Built-in speaker illustrations for light and dark dashboards, plus custom images.
- A collapsible room list, adjustable card width and an adjustable artwork area.

## Requirements

- Home Assistant with [HACS](https://www.hacs.dev/).
- A Mozart main speaker configured through the official [Bang & Olufsen integration](https://www.home-assistant.io/integrations/bang_olufsen/).
- BeoLink-compatible Mozart or ASE speakers for additional rooms. ASE volume and device controls require a suitable `media_player` entity from the Beoplay integration.

Available sources and controls depend on the speaker and its Home Assistant integration. Start a BeoLink-compatible source on the main speaker before connecting other rooms.

## Installation

1. Open **HACS → ⋮ → Custom repositories**.
2. Enter [https://github.com/Danlymp/beolink-multiroom-card](https://github.com/Danlymp/beolink-multiroom-card).
3. Select **Dashboard** as the type and click **Add**.
4. Find **B&O Multiroom Card**, open it and download the latest release.
5. Reload your Home Assistant dashboard.
6. Edit your dashboard, select **Add card**, and choose **B&O Multiroom**.

If the card does not appear, check **Settings → Dashboards → ⋮ → Resources**. The following URL must be registered as a **JavaScript module**; add it only if it is missing:

```text
/hacsfiles/beolink-multiroom-card/beolink-multiroom-card.js
```

If the Resources menu is hidden, enable **Advanced Mode** in your Home Assistant profile. Reload the dashboard after adding the resource.

## Configuration

Use the card's visual editor to set up your speakers. The editor currently uses German labels.

1. Select the main Mozart speaker's `media_player` entity.
2. Use **Lautsprecher hinzufügen** to add a room. Choose the discovered speaker and its matching volume entity. A BeoLink JID can also be entered manually.
3. Select a speaker illustration under **Lautsprechermodell**, or choose **Eigene Bilder / Standard-Icon** to use your own images.
4. Under **Anzeige**, adjust the card size, room-list timeout, group name, and visibility of sources and favourites.
5. Save the card.

To start with a minimal YAML configuration, replace the entity ID below with your main speaker's entity:

```yaml
type: custom:beolink-multiroom-card
master: media_player.your_mozart_speaker
```

The four favourite buttons recall the presets already stored on the main speaker. Group controls appear when another room is connected; relative volume changes preserve the volume differences between rooms, within each speaker's volume limits.

## Speaker illustrations

Included models: **Beosound 1, Beosound 2 (3rd generation), Beosound A5, Beosound Balance, Beosound Emerge, Beosound Level, Beosound Stage, Beolab 8 and Beolab 18**.

Beosound Stage also includes frame and outline variants. Illustrations follow Home Assistant's light or dark theme. You can upload your own speaker images and select separate images for each theme.

## Updates

HACS detects new releases and provides updates in Home Assistant. Open **Settings → Updates**, select **B&O Multiroom Card**, and install the update. Reload the dashboard afterwards to load the new version.

The version currently loaded is shown at the bottom of the card editor. A Home Assistant restart is normally not required for card updates.

## Support

See [releases](https://github.com/Danlymp/beolink-multiroom-card/releases) for available versions. Report problems through [GitHub Issues](https://github.com/Danlymp/beolink-multiroom-card/issues), including your card version, speaker models and a description of the problem.

## Credits

An independent community project, not affiliated with Bang & Olufsen. Speaker illustrations are adapted from product references; see [icon sources](https://github.com/Danlymp/beolink-multiroom-card/blob/main/docs/ICON_SOURCES.txt) and [notices](https://github.com/Danlymp/beolink-multiroom-card/blob/main/NOTICE.md).
