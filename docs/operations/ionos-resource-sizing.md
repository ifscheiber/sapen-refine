# IONOS Resource Sizing for SaPen Annotate

## Kurzempfehlung

Für den ersten kleinen Annotation-Pilot mit 2-3 gleichzeitigen Annotatoren ist ein IONOS VPS, Cloud Server, Cloud Cube oder vergleichbarer Server mit diesen Ressourcen sinnvoll:

- **Startempfehlung:** 4 vCPU, 8 GB RAM, mindestens 240 GB NVMe/lokale SSD.
- **Komfortablere produktionsnahe Variante:** 8 vCPU, 16 GB RAM, mindestens 480 GB NVMe/lokale SSD.

Die Startempfehlung reicht für einen kontrollierten Pilotbetrieb mit moderaten Bild-Uploads, manueller BBox-/Crop-/Semantic-Annotation und gelegentlichen Exporten. Die größere Variante ist sinnvoll, wenn viele Bilder erwartet werden, MinIO langfristig lokal bleibt, mehrere Exporte oder Prediction-Imports häufiger laufen oder mehr Betriebspuffer gewünscht ist.

## Was auf dem Server läuft

Der IONOS-Server ist der Applikations- und Datenserver für SaPen Annotate. Im aktuellen Trial-Deployment laufen per Docker Compose:

- Caddy als HTTPS-Reverse-Proxy.
- Die Next.js `sapen-annotate` App.
- PostgreSQL für Benutzer, Projekte, Metadaten, Review-Zustände, Audit-Logs, Export-Jobs und Referenzen.
- MinIO oder ein S3-kompatibler Object Storage für Rohbilder, Masken, Crop-Bilder, Prediction-Imports und Exportpakete.
- Optionale Worker für Export-Jobs und Prediction-Import-Batches.

Für den Pilot ist lokale PostgreSQL- und MinIO-Speicherung auf demselben Server akzeptabel, solange Backups wirklich ausgeführt und wiederherstellbar getestet werden.

## Was nicht auf dem Server läuft

Der IONOS-Server ist nicht als Trainingsmaschine gedacht:

- Kein CNN-Training.
- Keine GPU-Workloads.
- Kein schweres Modelltraining.
- Keine lokale SaPen-CNN-Trainingsausführung.

Training läuft später lokal oder auf einer separaten Trainingsumgebung, nachdem SaPen Annotate geprüfte Datensätze exportiert oder materialisiert hat.

## CPU-Bedarf

4 vCPU reichen für einen kleinen Pilot mit 2-3 Annotatoren in der Regel aus. Die CPU wird vor allem bei diesen Aktionen belastet:

- Gleichzeitige Browser-Requests der Annotatoren.
- Bild-Upload und serverseitige Prüfung von Bildformat, Abmessungen, Checksumme und Objekt-Metadaten.
- Crop-Erzeugung und Masken-Uploads.
- Exportpaket-Erstellung.
- Prediction-Import-Verarbeitung, falls genutzt.

Mehr CPU hilft, wenn mehrere Uploads parallel laufen, größere Bilder verarbeitet werden, Exporte häufiger erzeugt werden oder Worker dauerhaft aktiv sind. Die App braucht für den Pilot keine GPU.

## RAM-Bedarf

8 GB RAM sollten für 2-3 Annotatoren funktionieren, wenn der Server sauber betrieben wird und keine unnötigen Zusatzdienste laufen. Der Speicher wird gemeinsam genutzt von:

- Docker Engine und Containern.
- Next.js App.
- PostgreSQL.
- MinIO.
- Caddy.
- Optionalen Worker-Prozessen.

16 GB RAM geben deutlich mehr Spielraum für Docker, PostgreSQL-Caches, Object-Storage-Aktivität und Export-/Import-Worker. Diese Variante ist angenehmer, wenn der Server nicht eng überwacht werden soll oder wenn größere Bildmengen erwartet werden.

## Disk- und Storage-Bedarf

Die Datenbank ist normalerweise kleiner als der Object Storage. Der schnelle Speicherverbrauch entsteht durch:

- Rohbilder.
- Masken und Maskenversionen.
- Abgeleitete Crop-Bilder.
- Prediction-Import-Staging und importierte Prediction-Artefakte.
- Export-Manifeste und Export-ZIP-Pakete.
- Lokale Backup-Dateien, solange sie noch nicht off-host kopiert wurden.

Wenn MinIO lokal auf demselben Server läuft, sollte der Pilot nicht unter ungefähr 240 GB NVMe/lokaler SSD starten. Weniger Speicher kann für interne Tests funktionieren, wird aber schnell unkomfortabel, sobald mehrere Projekte, große Bilder, Exporte und Backups zusammenkommen.

Für längeren produktiven Betrieb ist ein externer oder managed S3-kompatibler Object Storage mit separater Backup-Strategie besser als ausschließlich lokaler MinIO-Speicher.

## Einfache Sizing-Tabelle

| Szenario | CPU | RAM | Disk | Geeignet für |
| --- | ---: | ---: | ---: | --- |
| Minimaler interner Test | 2 vCPU | 4 GB | 120-160 GB | Technische Smoke-Tests, kurze interne Demos, kaum Datenbestand |
| Empfohlener Pilot | 4 vCPU | 8 GB | 240 GB | 2-3 Annotatoren, moderate Uploads, lokale PostgreSQL- und MinIO-Volumes |
| Komfortabel produktionsnah | 8 vCPU | 16 GB | 480 GB | Mehr Bilder, mehr Betriebspuffer, lokale MinIO-Nutzung, häufigere Exporte/Imports |

## Backup-Warnung

Ein VPS-Snapshot allein ist keine vollständige Backup-Strategie, wenn PostgreSQL und MinIO auf demselben Server liegen. Ein Snapshot kann zwar beim Zurückrollen helfen, ersetzt aber keine bewusst getestete Sicherung von:

- PostgreSQL-Dump.
- MinIO/Object-Storage-Daten.
- Caddy-Zertifikats-/Konfigurationsdaten.
- Off-Host-Kopie der Backup-Dateien.

Vor dem Kundenpilot muss mindestens ein Restore-Test durchgeführt werden. Ohne Restore-Test ist unklar, ob die Backups im Ernstfall wirklich verwendbar sind.

Siehe auch [Trial Backup And Restore](../04-server/backup-restore.md).

## Empfehlung für Alex

Für den initialen Pilot:

- **Nimm 4 vCPU, 8 GB RAM und mindestens 240 GB NVMe/lokalen Speicher.**
- **Nimm 8 vCPU, 16 GB RAM und 480 GB NVMe**, wenn das Budget es erlaubt, wenn viele Bilder erwartet werden oder wenn MinIO länger lokal auf dem Server bleiben soll.

Die größere Maschine ist nicht wegen Training nötig, sondern wegen Betriebspuffer für Docker, PostgreSQL, lokalen Object Storage, Uploads, Exporte, Backups und optionale Worker.

