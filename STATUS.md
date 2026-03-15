# CloudBib - Status & Konzept (DE)

Dieses Dokument fasst den aktuellen Stand der Codebasis zusammen, benennt Luecken und Risiken und skizziert einen Plan, um CloudBib voll funktionsfaehig und benutzbar zu machen.

## Intention des Vorhabens
- Kollaborativer Literatur- und PDF-Manager mit Google Drive als Speicher- und Sync-Layer.
- Offline-faehig durch lokale SQLite-Datenbank und Cache, mit spaeterer Synchronisation.
- Offene Architektur: Electron + React fuer die App, optionale Node.js/Express-API fuer Gruppen- und Metadaten-Sync.

## Aktueller Stand (Code & Produkt)
- **Core/DB:** Lokale SQLite mit Migrationen, Typen fuer Libraries/Items/Attachments/Annotationen, Services fuer Annotationen, Cache, Zitationsexport und Sync-Logik.
- **Drive/Backend:** DriveService ist nur ein Stub ohne echte Google-Integration; Backend-API existiert nur als Interface. Damit schlagen Uploads/Downloads aktuell fehl.
- **Sync:** SyncService implementiert Pull/Push/Upload-Queue, wird aber nirgends gestartet. Upload-Queue bleibt damit wirkungslos.
- **Electron/Main:** Preload + IPC sind verdrahtet; main.ts nutzt Stub-DriveService und einen statischen Nutzer. Keine OAuth-Onboarding-Logik, keine Verbindung zum Backend.
- **Renderer/UI:** Drei-Panel-Layout (Libraries, Items, Details). Bibliotheken und Items koennen lokal erstellt/aufgelistet werden. Es gibt keinen Flow fuer PDF-Upload, PDF-Anzeige oder Annotationen im UI.
- **Tests:** Jest-Suite laeuft erfolgreich (npm test), deckt Kern-Services ab; keine End-to-End- oder UI-Tests.

## Festgestellte Luecken und Fehler
- **Drive-Anbindung fehlt:** Alle Drive-Aufrufe schlagen fehl (Stub). Annotations- und PDF-Funktionen sind faktisch deaktiviert.
- **Backend fehlt:** Keine Implementierung der Group-Sync-API; SyncService kann keine Remote-Aenderungen holen oder senden.
- **Kein Onboarding:** Keine OAuth/PKCE-Authentifizierung oder Token-Persistenz; ohne Tokens ist jede Drive-Operation unmoeglich.
- **UI-Luecken:** Kein PDF-Upload oder -Viewer in der Renderer-Schicht; keine Anzeige von Upload-Status, Konflikten oder Annotationen.
- **Ungesicherte Annahmen:** addPdfToGroup erwartet driveRootId, wird aber beim Anlegen von Libraries nie gesetzt -> Laufzeitfehler, sobald Upload versucht wird.
- **Sync nicht verdrahtet:** SyncLoop wird weder periodisch noch manuell gestartet; Upload-Queue wird daher nicht verarbeitet.

## Zielbild (MVP)
- Voll funktionsfaehige Desktop-App, die lokale Bibliotheken und gruppenbasierte Bibliotheken mit Google Drive synchronisiert.
- PDF-Upload mit Pruefsumme, lokaler Cache, eingebetteter PDF.js-Viewer mit Annotationen und Konfliktbehandlung.
- Grundlegender Gruppen-/Mitglieder-Sync ueber einen kleinen Backend-Dienst (Node/Express + PostgreSQL).
- Benutzerfreundliches Onboarding (Google OAuth), Statusanzeigen und robuste Fehlerbehandlung.

## Roadmap / Plan
1) **Drive-Integration & Onboarding**
   - PKCE-OAuth-Flow implementieren, Tokens sicher speichern (Keytar/OS-Store).
   - Echten DriveService bauen (ensureFolder, upload/download, metadata, sidecar JSON).
   - driveRootId beim Anlegen einer Gruppenbibliothek setzen/validieren.
2) **Backend (Minimal)**
   - Node/Express-Service gemaess ARCHITECTURE.md-Endpunkte bereitstellen.
   - Auth-Token-Weitergabe, Basis-ACL fuer Gruppen und Items; Delta-Sync-Endpoint.
3) **Sync & Queue**
   - SyncService im Main-Prozess verdrahten (Timer + manuell).
   - Upload-Queue sichtbar machen (Status/Retry), Backoff beibehalten.
4) **PDF-Flow & UI**
   - Renderer-Flow fuer "PDF hinzufuegen" (Dateiauswahl -> addPdfToGroup).
   - PDF.js-Viewer + Annotation-Overlay integrieren; Annotationen laden/speichern ueber IPC.
   - Detailansicht fuer Metadaten-Bearbeitung, Attachment-Liste, "Open in Drive" Link.
5) **Konflikte & Robustheit**
   - UI fuer Konfliktmeldungen (lokal vs. remote) und Merge-Optionen.
   - Integritaetspruefungen (Checksums), Fehler-Badges im UI, Logging.
6) **Qualitaet & Release**
   - E2E-Smoke-Tests (Playwright/Electron), Paketierung mit electron-builder, Update README/Onboarding-Doku.

## Kurzfristige To-dos (empfohlen)
1. DriveService durch echte Implementation ersetzen und OAuth-Flow ergaenzen.
2. driveRootId bei Gruppenbibliotheken speichern, damit Uploads funktionieren.
3. SyncService periodisch starten und Upload-Queue prozessieren.
4. Renderer um PDF-Upload-Button, Attachments-Liste und einfachen PDF-Viewer erweitern.
5. Backend-Skelett bereitstellen (mind. Gruppen/Items Delta-Sync) oder stub-artige Offline-Strategie klar dokumentieren.
