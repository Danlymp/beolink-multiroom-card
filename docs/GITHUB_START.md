# Ersteinrichtung für Danlymp/beolink-multiroom-card

## 1. Paket hochladen

1. Die ZIP-Datei auf dem Mac entpacken und den darin enthaltenen Ordner **beolink-multiroom-card** öffnen.
2. Im Finder **Umschalt + Command + Punkt** drücken, damit auch der enthaltene Ordner **.github** sichtbar wird. Er enthält den Ablauf zum Veröffentlichen von Updates.
3. https://github.com/Danlymp/beolink-multiroom-card öffnen.
4. **Add file → Upload files** anklicken.
5. Den **Inhalt** des entpackten Ordners in das Upload-Feld ziehen: die Dateien README.md, hacs.json, package.json usw. sowie die Ordner .github, dist, docs, examples, icons, scripts, src und tests. Nicht den äußeren Ordner und nicht die ZIP hochladen.
6. Warten, bis alle Dateien hochgeladen sind. Als Commit-Nachricht **HACS-Version 0.10.0 vorbereiten** eintragen und **Commit changes** anklicken. Falls GitHub nachfragt, auf **main** speichern.
7. In der Repository-Hauptansicht müssen **hacs.json**, **README.md**, **dist** und **.github** direkt sichtbar sein. Die vorher angelegte README darf durch diese ersetzt werden.
8. Rechts im Bereich **About** über das Zahnrad die Topics **home-assistant**, **hacs**, **lovelace**, **bang-olufsen** und **beolink** ergänzen und speichern.

Ein Upload der Dateien allein erstellt noch kein veröffentlichtes Release.

## 2. Erste Version veröffentlichen

1. Im Repository oben **Actions** öffnen. Falls GitHub die Aktivierung von Workflows anbietet, diese für dieses eigene Repository aktivieren.
2. Links **Neue Version veröffentlichen** auswählen.
3. **Run workflow** anklicken. Branch **main** wählen und als Version **0.10.0** eintragen.
4. Mit dem grünen **Run workflow** starten.
5. Den Lauf öffnen und auf den grünen erfolgreichen Abschluss warten. GitHub baut und prüft die Karte und legt das Release **v0.10.0** samt JavaScript-Datei an.
6. Unter **Code → Releases** kontrollieren, dass **v0.10.0** als veröffentlichtes Release erscheint. Es darf kein Entwurf sein.

Der Ablauf verändert in diesem Repository die Versionsdateien und erstellt die öffentliche Veröffentlichung. Er läuft nur nach deinem manuellen Start. Für das allererste Release darf die Eingabe mit der bereits vorbereiteten Version übereinstimmen. Später eine neue höhere Versionsnummer verwenden.

Ein roter Lauf ist noch keine erfolgreiche Veröffentlichung. Den ersten fehlgeschlagenen Schritt öffnen und dessen Fehlermeldung prüfen. Bei bereits vorhandenem Tag eine neue Version wählen. Falls zwischenzeitlich weitere Änderungen auf main hochgeladen wurden und git push scheitert, den Ablauf erneut mit dem aktuellen Stand starten. Es wird nichts mit Gewalt überschrieben.

## 3. In HACS hinzufügen und bestehende Karte umstellen

1. In HACS oben rechts **⋮ → Benutzerdefinierte Repositories / Custom repositories** öffnen.
2. URL **https://github.com/Danlymp/beolink-multiroom-card**, Typ **Dashboard**, anschließend **Hinzufügen**.
3. **B&O Multiroom Card** öffnen und die neueste veröffentlichte Version herunterladen.
4. In HA **Einstellungen → Dashboards → ⋮ → Ressourcen** öffnen. Falls der Menüpunkt fehlt, im HA-Benutzerprofil den erweiterten Modus aktivieren und erneut prüfen. Bei YAML-Dashboards den Ressourcen-Eintrag in YAML ändern.
5. Ziel ist genau **ein** Ressourceneintrag dieser Karte, Typ **JavaScript-Modul**, mit der Adresse:

   `/hacsfiles/beolink-multiroom-card/beolink-multiroom-card.js`

   HACS kann einen `hacstag`-Parameter anhängen; diesen beibehalten. Hat HACS den neuen Eintrag schon angelegt, den alten `/local/beolink-multiroom-card.js?...`-Eintrag entfernen. Fehlt der HACS-Eintrag, den alten auf die neue Adresse ändern.
6. Die vorhandene Dashboard-Karte behalten. Ihre Lautsprecher, JIDs, Namen, Bilder und Anzeigeoptionen bleiben in der Dashboard-Konfiguration gespeichert.
7. Dashboard neu laden, bei Bedarf im Desktop-Browser mit hartem Neuladen. Der Karteneditor muss unten **Version 0.10.0** anzeigen. In der HA-App die Ansicht neu laden bzw. die App neu öffnen.
8. Im Karteneditor pro Lautsprecher **Lautsprechermodell** auswählen. Neue Icons werden über HACS mitgeliefert; alte eigene Bilder können weiterhin verwendet werden.

## 4. Spätere Updates

Nach einem neuen Release erkennt HACS die Version bei seiner nächsten Prüfung. Bei Bedarf beim Repository **⋮ → Informationen aktualisieren / Update information** anklicken. Dann in **HA → Einstellungen → Updates** installieren und das Dashboard neu laden. Die Ressourcenadresse bleibt bestehen.

Ein Reboot oder HA-Neustart ist für die reine JavaScript-Karte normalerweise nicht erforderlich. Es ist kein HA-Add-on und keine zusätzliche Integration.

## Offizielle Referenzen

- https://www.hacs.xyz/docs/publish/plugin/
- https://www.hacs.xyz/docs/publish/start/
- https://www.hacs.xyz/docs/faq/custom_repositories/
- https://www.hacs.xyz/docs/use/update/
- https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
