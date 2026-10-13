# Neue Icons und Karten-Updates

## Normaler Ablauf

1. Änderungen an der Karte oder neue Icons vorbereiten und prüfen lassen.
2. Die geänderten Quelldateien in dasselbe GitHub-Repository hochladen und auf **main** speichern. Ein komplettes vorbereitetes Update-Paket wird wie die erste Version entpackt und sein Inhalt hochgeladen.
3. Unter **Actions → Neue Version veröffentlichen → Run workflow** eine neue Versionsnummer eingeben, z. B. **0.10.1**.
4. Den erfolgreichen Abschluss abwarten. Erst danach ist die neue Version für HACS veröffentlicht.
5. In HA das angebotene Update installieren und das Dashboard neu laden.

## Ein weiteres Linien-Icon ergänzen

Im Repository in den Ordner **icons** wechseln und die vorbereitete SVG-Datei über **Add file → Upload files** dort hinzufügen. Dann speichern und den Veröffentlichungsablauf mit einer neuen Version starten.

Die SVG-Datei braucht einen stabilen Namen wie **beosound-neues-modell.svg**. Dieser wird zur internen Modellkennung und sollte später nicht geändert werden, damit gespeicherte Zuordnungen bestehen bleiben. Der Modellname für die Auswahl steht im `<title>` der SVG-Datei.

Das Format entspricht den vorhandenen Quelldateien: vollständiges SVG mit `viewBox="0 0 512 512"`, transparente Fläche, dunkle Linien in **#263238**. Der Builder erzeugt daraus automatisch die helle Variante **#F4F6F7**. Externe Verweise, Skripte, CSS und eingebettete Fotos werden nicht übernommen. Für PNG-Produktfotos weiterhin die persönliche HA-Bildsammlung nutzen oder die Grafik zuerst als passendes Linien-SVG vorbereiten lassen.

Zum Überarbeiten eines bestehenden Modells dieselbe SVG-Datei unter demselben Namen ersetzen. Ein fehlgeschlagener Build wird im Actions-Lauf angezeigt; es wird dann kein neues Release erzeugt.

## Code und fertige Kartendatei

- **src/beolink-multiroom-card.js**: zu bearbeitender Kartencode.
- **icons/*.svg**: mitgelieferte Linien-Icons. Ein neues gültiges SVG wird automatisch in die Auswahl aufgenommen.
- **dist/beolink-multiroom-card.js**: vom Builder erzeugte Datei für HACS. Sie enthält auch die Icons.
- **hacs.json**: Beschreibung für HACS.
- **.github/workflows/release.yml**: manueller Veröffentlichungsablauf.

Codeänderungen gehören in **src**. Direkte Änderungen ausschließlich an **dist** würden beim nächsten Build aus den Quellen neu erzeugt. Die endgültige JavaScript-Datei enthält alle Icons; HACS muss keine einzelnen Bilddateien herunterladen.

## Optional lokal entwickeln

Node.js 22 oder neuer installieren. Im Projektordner:

```bash
npm ci --ignore-scripts
npm run build
npm run test:all
```

Die Bibliothek LinkeDOM wird nur für die simulierten Editor-/DOM-Tests benötigt; Home Assistant benötigt sie nicht. `npm test` führt die Modelltests aus und überspringt ohne `BO_DOM_MODULE` den zusätzlichen DOM-Test. Der Veröffentlichungsablauf führt `test:all` mit DOM-Test aus.

## Veröffentlichung und Prüfung

Der Workflow prüft das Versionsformat, verhindert das Überschreiben vorhandener Tags, aktualisiert die Versionsangaben einschließlich Lockdatei, baut die Icons ein und führt die Tests aus. Anschließend speichert er die erzeugten Versionsdateien auf **main** und veröffentlicht das Release samt JavaScript-Datei. Die Beschreibung wird aus den GitHub-Änderungen erzeugt.

Die Tests verwenden simulierte HA-Daten. Eine neue Version mit veränderten Geräteaktionen sollte zusätzlich an den eigenen Lautsprechern geprüft werden. Zurück zu einer früheren veröffentlichten Version geht bei Bedarf über die Versionsauswahl beim erneuten Herunterladen in HACS.
