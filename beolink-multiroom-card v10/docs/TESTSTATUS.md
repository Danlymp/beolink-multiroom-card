# Prüfstatus für Version 0.10.0

Geprüft am 13.10.2026.

- 36 automatisierte Prüfungen mit simulierten Home-Assistant-Daten bestanden, einschließlich des Editor-/DOM-Tests mit LinkeDOM 0.18.12. Kein Test ausgelassen.
- Alle elf Icon-Varianten (neun Modelle und zwei zusätzliche Stage-Ansichten) werden in beiden Theme-Farben aus der fertigen JavaScript-Datei aufgelöst. Abgleich mit den SVG-Quelldateien erfolgreich.
- Modellauswahl für Hauptspieler und Räume, Theme-Wechsel, Rückkehr zu bisherigen eigenen Bildern und Erhaltung vorhandener Einstellungen geprüft. Die Bildauswahl sendet keine Gerätebefehle.
- Vorhandene Tests für BeoLink-Mitgliedschaft, Lautstärke, Gruppensteuerung, Quellen, Favoriten, Bildverwaltung, Größenwahl und Timer weiterhin erfolgreich.
- Paketstruktur: hacs.json und README im Repository-Hauptverzeichnis, passende Kartendatei allein unter dist, keine externen Laufzeit-Imports. Gegen die dokumentierten HACS-Anforderungen geprüft; noch kein HACS-Installationslauf.
- Versionswechsel 0.10.0 → 0.10.1 in einer temporären Kopie erfolgreich simuliert. Paket-, Quell-, Lock- und Distributionsversion stimmen überein. Ungültige oder niedrigere Versionsnummern werden vor Dateiänderungen abgewiesen.
- Workflow-YAML und enthaltene Shell-Befehle syntaktisch geprüft. Der Workflow wurde noch nicht auf GitHub ausgeführt; Veröffentlichung und HACS-Erkennung werden im nächsten Einrichtungsschritt geprüft.

Die Quell-Icons wurden bereits visuell geprüft. Ein zusätzlicher vollständiger Chromium-Durchlauf für diese neue Kartenversion konnte in der Arbeitsumgebung nicht ausgeführt werden, weil der Browserdownload keine gültige Archivdatei lieferte. Die Editor-Prüfung erfolgte mit simuliertem DOM, nicht mit einer echten HA-Sitzung.

Ein Live-Test in der Home-Assistant-Installation und mit den tatsächlichen B&O-Lautsprechern steht noch aus. Die neue Version ändert die Bildauswahl und Verteilung; die Geräteaktionen wurden nicht erweitert.
