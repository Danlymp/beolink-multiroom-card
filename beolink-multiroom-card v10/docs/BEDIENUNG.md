# Bedienung der B&O Multiroom Card

## Hauptlautsprecher

Im Karteneditor die media_player-Entität aus der offiziellen Bang-&-Olufsen-Integration auswählen. Der Hauptspieler muss BeoLink-Attribute liefern. Einen Namen kann man unabhängig vom Entitätsnamen eintragen.

Unter **Lautsprechermodell** das passende eingebaute Icon auswählen. **Eigene Bilder / Standard-Icon** verwendet die vorhandenen Bildfelder. Die Modellauswahl verändert keine Wiedergabe und lädt nichts in die HA-Bildsammlung hoch. Sie löscht auch keine alten Bildzuordnungen.

## Weitere Lautsprecher

1. Eine BeoLink-fähige Quelle auf dem Hauptspieler starten.
2. Im Editor **Lautsprecher hinzufügen** wählen.
3. Den gewünschten BeoLink-Lautsprecher aus der Liste wählen. Falls er nicht angeboten wird, die tatsächliche JID unter **JID manuell eingeben oder prüfen** eintragen.
4. Die passende Lautstärke-Entität wählen. Mozart kann anhand einer eindeutigen JID zugeordnet werden; bei ASE muss die media_player-Entität aus Beoplay gewählt werden.
5. Anzeigename und Lautsprechermodell einstellen und die Karte speichern.

Ein Raum wird erst nach Bestätigung durch HA als verbunden dargestellt. Änderungen aus der B&O-App werden mit den HA-Zustandsmeldungen übernommen. Ein spielendes Gerät gilt nicht automatisch als Teilnehmer dieser Gruppe.

## Raumliste und Höhe

Der Pfeil öffnet die vollständige Liste; geschlossen bleiben verbundene und noch im Verbindungsaufbau befindliche Räume sichtbar. Beim Öffnen wird der Hauptbereich kompakter. Beim Schließen kehrt seine eingestellte Höhe zurück.

**Anzeige → Automatisch schließen** bestimmt die Inaktivitätszeit: standardmäßig 5 Sekunden, 0 deaktiviert den Timer. Bedienung startet die Zeit neu; während eines Lautstärke-Ziehens oder laufender Verbindungsbefehle bleibt die Liste offen.

Die Gesamthöhe folgt dem Inhalt. **Anzeige → Kartengröße** ändert die Breite; **Höhe des Hauptspieler-Bereichs** stellt mindestens 560 px für die geschlossene Darstellung ein. Zusätzlicher Platz vergrößert das Cover. Bei alten festen Rasterhöhen **Größenkorrektur übernehmen** anklicken und speichern. Für doppelte Breite muss auch der umgebende HA-Abschnitt breit genug sein. Eine Stapel- oder Rasterkarte kann den verfügbaren Platz begrenzen.

## Wiedergabe, Quellen und Favoriten

Zurück, Play/Pause und Weiter stehen mittig, Power rechts. Im Editor können Quellenauswahl und Favoritentasten unabhängig ausgeblendet werden. Die vier Punkttasten rufen die vier im Mozart-Gerät gespeicherten Favoriten auf; sie konfigurieren keine neuen Favoriten.

Power versetzt den Hauptspieler in Standby. Mozart besitzt oft kein separates Einschalten; dann versucht die Karte, die vorherige Wiedergabe fortzusetzen. Falls keine fortsetzbare Quelle vorhanden ist, zuerst eine Quelle oder einen Favoriten starten.

## Gruppenlautstärke

Sobald mindestens ein weiterer Lautsprecher tatsächlich verbunden ist, erscheint die Gruppensteuerung unter der Hauptlautstärke. Ihr Name ist unter **Anzeige → Name der Gruppensteuerung** frei einstellbar.

Der Gruppenbalken verschiebt die Lautstärken relativ zueinander, sodass bestehende Unterschiede zwischen den Räumen erhalten bleiben. An den Grenzen 0 und 100 wird begrenzt. Mute und Power beziehen sich auf den Hauptspieler und die tatsächlich verbundenen Geräte. Fehlt für einen Teilnehmer eine passende Entität, zeigt die Karte eine Fehlermeldung statt unbemerkt nur einen Teil der Gruppe zu steuern.

Nach **Gruppe aus** merkt sich die geöffnete Karte die Gruppe zum erneuten Start. Nach einem vollständigen Neuladen müssen die Räume bei Bedarf erneut verbunden werden.

## Eigene Bilder

Für eigene Bilder im Modellfeld **Eigene Bilder / Standard-Icon** wählen. Danach stehen **Foto hochladen**, **Aus HA auswählen** und **Bildadresse statt Upload** zur Verfügung. Die zwei Bildfelder entsprechen hellem und dunklem Dashboard. Ohne dunkle Variante verwendet die Karte dasselbe Standardbild in beiden Modi.

Unter **Bildsammlung auf HA** lassen sich Bilder ergänzen, ganze Ordner importieren und bestehende Uploads verwalten. Ordnerimporte sind keine Synchronisierung; ein erneuter Import kann Duplikate erzeugen. Die Uploads liegen auf dem HA-Server. **/local/** verweist auf **/config/www/** dieses Servers.

**Bilder verwalten → Löschen → Endgültig löschen** entfernt eine Datei aus der HA-Bildsammlung. Andere Karten, die sie verwenden, verlieren ebenfalls ihr Bild. Die mitgelieferten Modell-Icons sind Bestandteil des Kartenpakets und erscheinen nicht in dieser Upload-Verwaltung.

## Grenzen und Fehlersuche

Die Karte stellt keine eigene B&O-Netzwerkverbindung her. Sie verwendet die HA-Integrationen, deren Entitäten und Aktionen. Wenn der Hauptspieler einem anderen Gerät folgt, kann die Karte ihn nicht als Gruppenführer steuern. Verfügbarkeit einzelner Quellen und Aktionen hängt von den Geräten und Integrationen ab.

Bei einer alten Darstellung nach einem Update das Dashboard vollständig neu laden. In **Ressourcen** muss nur ein Eintrag für diese Karte aktiv sein. Der grafische Editor zeigt unten seine tatsächlich geladene Kartenversion.

Für die Installation und HACS-Umstellung siehe die README im Projekt-Hauptordner.
