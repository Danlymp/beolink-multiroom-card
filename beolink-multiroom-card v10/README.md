# B&O Multiroom Card

Home-Assistant-Dashboard-Karte für Bang-&-Olufsen-Lautsprecher: Hauptspieler, Quellen, vier Favoriten, Multiroom und gemeinsame Lautstärke. Unabhängiges Community-Projekt.

## Installation über HACS

1. In HACS oben rechts **⋮ → Benutzerdefinierte Repositories / Custom repositories** öffnen.
2. `https://github.com/Danlymp/beolink-multiroom-card` eintragen, Typ **Dashboard** auswählen und hinzufügen.
3. **B&O Multiroom Card** öffnen und die neueste veröffentlichte Version herunterladen.
4. Dashboard im Browser oder in der HA-App vollständig neu laden.
5. Im Dashboard eine Karte **B&O Multiroom** hinzufügen. Bei einem bestehenden Dashboard gilt die folgende Umstellung.

### Wechsel von der bisherigen ZIP-Installation

Die bestehende Karte und ihre Konfiguration behalten. Unter **Einstellungen → Dashboards → ⋮ → Ressourcen** darf anschließend genau **ein** Eintrag dieser Karte aktiv sein:

```text
/hacsfiles/beolink-multiroom-card/beolink-multiroom-card.js
```

Typ: **JavaScript-Modul**. Wenn HACS diesen Eintrag bereits angelegt hat, nur den alten `/local/beolink-multiroom-card.js?...`-Ressourceneintrag entfernen. Wenn der HACS-Eintrag fehlt, den alten Eintrag auf die HACS-Adresse ändern. Einen von HACS gesetzten `hacstag`-Parameter beibehalten. Nicht beide Versionen gleichzeitig laden. Danach das Dashboard vollständig neu laden.

Wer seine Ressourcen in YAML verwaltet, ändert den dortigen Eintrag. Der Kartentyp bleibt `custom:beolink-multiroom-card`. Lautsprecherzuordnungen, Bilder und Anzeigeoptionen werden übernommen.

## Mitgelieferte Lautsprecher-Icons

Im Karteneditor beim Hauptspieler oder einem weiteren Lautsprecher **Lautsprechermodell** auswählen. Das Icon wechselt automatisch mit dem hellen/dunklen HA-Modus. Ein separater Upload ist dafür nicht erforderlich.

Enthalten: **Beosound 1, 2 (3. Gen.), A5, Balance, Emerge, Level und Stage sowie Beolab 8 und 18**. Für Stage gibt es zusätzlich Rahmen und Kontur. A5 ist als Linienumriss enthalten; eigene Produktfotos lassen sich weiterhin hochladen.

**Eigene Bilder / Standard-Icon** verwendet weiterhin die vorhandenen Bildfelder. Eine Modellauswahl löscht vorhandene Uploads und Bildadressen nicht. Ein neues Icon aus einer späteren Version erscheint nach dem HACS-Update in der Auswahl.

## Voraussetzungen und Bedienung

- Hauptspieler: Mozart-Gerät aus der offiziellen **Bang & Olufsen**-Integration.
- Weitere Geräte: Mozart oder ASE; BeoLink-Verbindung über den Hauptspieler mit eindeutiger JID.
- Bei ASE die passende **Beoplay-media_player-Entität** für Lautstärke und Gerätesteuerung auswählen.
- Eine BeoLink-fähige Quelle auf dem Hauptspieler starten, bevor weitere Räume verbunden werden.

Die [Bedienungsanleitung](docs/BEDIENUNG.md) beschreibt Gruppenlautstärke, Standby, Favoriten, Bilder und Kartengröße. YAML-Beispiele stehen unter [examples](examples). Alle dortigen JIDs sind fiktiv und müssen durch die eigenen Werte ersetzt werden.

## Updates installieren

Neue veröffentlichte Versionen werden durch HACS erkannt. In HA **Einstellungen → Updates → B&O Multiroom Card → Installieren** wählen und danach das Dashboard neu laden. Für diese reine Dashboard-Karte ist normalerweise kein HA-Neustart nötig. Zum sofortigen Nachsehen in HACS beim Repository **⋮ → Informationen aktualisieren / Update information** wählen; dieser Schritt allein installiert noch kein Update.

## Projekt pflegen und Versionen veröffentlichen

[GitHub-Ersteinrichtung](docs/GITHUB_START.md) · [Neue Icons und Updates](docs/UPDATES.md) · [Änderungen](CHANGELOG.md) · [Prüfstatus](docs/TESTSTATUS.md)

Der Workflow **Neue Version veröffentlichen** wird im GitHub-Reiter **Actions** manuell gestartet. Er setzt die Versionsnummer, baut die Kartendatei samt Icons, führt Tests aus und veröffentlicht ein Release. Dafür genügt der von GitHub bereitgestellte Repository-Token; persönliche Zugangsdaten gehören nicht in Dateien.

Die fertige Datei unter `dist` benötigt in Home Assistant keine zusätzlichen JavaScript-Bibliotheken. `src`, `icons`, `scripts` und die Testwerkzeuge werden nur zur Entwicklung und Veröffentlichung verwendet.

## Herkunft

Die Lautsprecherzeichnungen basieren auf offiziellen B&O-Produktunterlagen und wurden für diese Karte aufbereitet; einzelne Symbole wurden vereinfacht oder neu gezeichnet. Siehe [Icon-Quellen](docs/ICON_SOURCES.txt) und [Hinweise](NOTICE.md).
