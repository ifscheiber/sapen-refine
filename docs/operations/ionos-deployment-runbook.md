# IONOS Deployment Runbook for SaPen Annotate

## Annahmen

Dieses Runbook beschreibt einen praktischen Single-Server-Pilot auf IONOS VPS, Cloud Server, Cloud Cube oder einem vergleichbaren Server.

Annahmen:

- Ubuntu 24.04 LTS.
- DNS-Name vorhanden, zum Beispiel `annotate.example.com`.
- SSH-Zugriff per Key.
- Deployment per Docker Compose mit den vorhandenen Repo-Dateien.
- Initialer Pilot nutzt lokale PostgreSQL- und MinIO-Volumes.
- Training läuft nicht auf diesem Server, sondern später lokal oder in einer separaten Trainingsumgebung.

Die bestehenden Repo-Dateien sind:

- [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml)
- [../../deploy/trial.env.example](../../deploy/trial.env.example)
- [../04-server/deployment-trial.md](../04-server/deployment-trial.md)
- [../04-server/backup-restore.md](../04-server/backup-restore.md)

## 1. IONOS-Server erstellen

Empfohlene Pilotgröße:

- Ubuntu 24.04 LTS.
- 4 vCPU.
- 8 GB RAM.
- Mindestens 240 GB NVMe/lokaler Speicher.

Komfortabler:

- 8 vCPU.
- 16 GB RAM.
- 480 GB NVMe/lokaler Speicher.

Öffne nur die notwendigen Ports:

- `22/tcp` für SSH.
- `80/tcp` für HTTP/Let's Encrypt.
- `443/tcp` für HTTPS.

Optional kann `443/udp` für HTTP/3 offen sein, ist aber nicht zwingend nötig.

## 2. DNS konfigurieren

Lege beim DNS-Anbieter einen `A` Record an:

```text
annotate.example.com -> <server-public-ipv4>
```

Prüfe die Auflösung von deinem Rechner:

```bash
dig +short annotate.example.com
```

Erwartung: Die öffentliche IPv4-Adresse des IONOS-Servers wird ausgegeben. Warte bei Bedarf auf DNS-Propagation, bevor Caddy Zertifikate anfordern soll.

## 3. Server vorbereiten

Per SSH verbinden:

```bash
ssh alex@annotate.example.com
```

System aktualisieren und Grundpakete installieren:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git ufw htop unzip
```

Firewall konfigurieren:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Wenn SSH auf einem anderen Port läuft, die UFW-Regeln entsprechend anpassen, bevor `ufw enable` ausgeführt wird.

## 4. Docker installieren

Nutze eine offizielle Docker-Installationsmethode. Für einen Pilot ist das Docker-Convenience-Skript praktisch:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

Aktuellen Benutzer zur Docker-Gruppe hinzufügen:

```bash
sudo usermod -aG docker "$USER"
```

Danach ausloggen und neu einloggen.

Docker prüfen:

```bash
docker version
docker compose version
```

## 5. Repository klonen oder kopieren

Empfohlener Pfad:

```bash
mkdir -p ~/apps
cd ~/apps
git clone <repo-url> sapen-annotate
cd sapen-annotate
```

Wenn kein Git-Zugriff auf dem Server genutzt wird, stattdessen ein sauberes Handoff-Archiv oder eine saubere Kopie des Repositories nach `~/apps/sapen-annotate` übertragen.

## 6. Deployment-Env erstellen

Aus dem Repo-Root:

```bash
cp deploy/trial.env.example deploy/trial.env
chmod 600 deploy/trial.env
```

Secrets erzeugen:

```bash
openssl rand -base64 32
```

`deploy/trial.env` bearbeiten:

```bash
nano deploy/trial.env
```

Keine echten Secrets in Git committen. `deploy/trial.env` ist lokal auf dem Server und wird durch `.dockerignore`/Git-Regeln als Secret-Datei behandelt.

## 7. Wichtige Env-Werte prüfen

In `deploy/trial.env` mindestens diese Werte prüfen:

```text
TRIAL_HOSTNAME=annotate.example.com
APP_BASE_URL=https://annotate.example.com
SHOW_DEMO_CREDENTIALS=false
```

PostgreSQL:

```text
POSTGRES_USER=sapen_annotate
POSTGRES_PASSWORD=<long-random-secret>
POSTGRES_DB=sapen_annotate
```

MinIO/S3:

```text
S3_ACCESS_KEY=<long-random-access-key>
S3_SECRET_KEY=<long-random-secret-key>
S3_BUCKET=sapen-annotate-trial
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

Upload- und Proxy-Limits zusammen prüfen:

```text
IMAGE_UPLOAD_MAX_BYTES=104857600
MASK_UPLOAD_MAX_BYTES=52428800
PREDICTION_BATCH_UPLOAD_MAX_BYTES=104857600
NEXT_PROXY_CLIENT_MAX_BODY_SIZE=120mb
CADDY_MAX_BODY_SIZE=120MB
```

Operator-Attribution:

```text
SAPEN_OPERATOR_EMAIL=alex@example.com
SAPEN_REQUIRE_OPERATOR_ATTRIBUTION=true
```

Optionale Worker-Credentials nur setzen, wenn Worker wirklich genutzt werden:

```text
SAPEN_JOB_EMAIL=
SAPEN_JOB_PASSWORD_FILE=
SAPEN_JOB_PASSWORD=
```

Wenn Worker aktiv sind, eine benannte `OWNER`- oder `QA`-Kennung verwenden. Bevorzugt `SAPEN_JOB_PASSWORD_FILE` statt Passwort im Klartext.

High-Cost Limits und Export Caps prüfen:

```text
HIGH_COST_LIMITS_ENABLED=true
HIGH_COST_UPLOAD_MAX_REQUESTS=20
HIGH_COST_EDITOR_SAVE_MAX_REQUESTS=120
HIGH_COST_EXPORT_CREATE_MAX_REQUESTS=5
TRAINING_EXPORT_MAX_ITEMS=500
TRAINING_EXPORT_MAX_BYTES=536870912
PREDICTION_ANALYSIS_EXPORT_MAX_ITEMS=500
PREDICTION_ANALYSIS_EXPORT_MAX_BYTES=536870912
```

Vor einem kunden-facing Deployment prüfen, dass RB-130 Runtime-Env-Propagation für High-Cost Limits und Export Caps implementiert oder verifiziert ist. In diesem Repo liegt RB-130 unter [../../tickets/2026-05-27/done/RB-130-trial-runtime-config-env-propagation-for-rate-limits-and-export-caps.md](../../tickets/2026-05-27/done/RB-130-trial-runtime-config-env-propagation-for-rate-limits-and-export-caps.md), und [../../deploy/docker-compose.trial.yml](../../deploy/docker-compose.trial.yml) reicht die relevanten Variablen an den App-Container weiter.

## 8. Services bauen und starten

Aus dem Repo-Root:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml build
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d postgres minio
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm -e SAPEN_OPERATOR_EMAIL='alex@example.com' app npm run trial:bootstrap
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d
```

Wichtig:

- Nicht `prisma migrate dev` auf dem Server verwenden.
- Nicht `npm run seed` für einen Kundenpilot verwenden, außer Demo-Accounts wurden explizit akzeptiert.
- `trial:bootstrap` erstellt Rollen und Default-Label-Schema ohne Demo-Projekt.

## 9. Deployment prüfen

Containerstatus:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps
```

Logs:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 app
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 caddy
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 postgres
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=100 minio
```

Health Checks über HTTPS:

```bash
curl -fsS https://annotate.example.com/api/health
curl -fsS https://annotate.example.com/api/ready
```

Erwartung:

- `caddy`, `app`, `postgres`, `minio` laufen.
- `/api/health` liefert `status: ok`.
- `/api/ready` meldet Datenbank und Storage als erreichbar.
- Browser-Login über `https://annotate.example.com/login` funktioniert.

## 10. Ersten echten Admin/User erstellen

Passwort nicht direkt in die Shell-History schreiben. Wenn möglich, Passwort über STDIN übergeben:

```bash
read -rsp "Password for alice@example.com: " SAPEN_NEW_USER_PASSWORD
printf '\n'
printf '%s' "$SAPEN_NEW_USER_PASSWORD" | docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm -T -e SAPEN_OPERATOR_EMAIL='alex@example.com' app npm run trial:user:create -- --email alice@example.com --name 'Alice Tester' --global-role ADMIN --password-stdin
unset SAPEN_NEW_USER_PASSWORD
```

Alternativ mit Secret-Datei, wenn die Deployment-Umgebung diese Datei in den Container mountet:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm -e SAPEN_OPERATOR_EMAIL='alex@example.com' -e SAPEN_TRIAL_USER_PASSWORD_FILE=/run/secrets/alice_password app npm run trial:user:create -- --email alice@example.com --name 'Alice Tester' --global-role ADMIN
```

Nach dem ersten Login kann Alex im UI ein Projekt erstellen. Weitere Projektmitglieder werden mit Projekt-ID ergänzt:

```bash
read -rsp "Password for bob@example.com: " SAPEN_NEW_USER_PASSWORD
printf '\n'
printf '%s' "$SAPEN_NEW_USER_PASSWORD" | docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml run --rm -T -e SAPEN_OPERATOR_EMAIL='alex@example.com' app npm run trial:user:create -- --email bob@example.com --name 'Bob Annotator' --project-id '<project-id>' --project-role LABELER --password-stdin
unset SAPEN_NEW_USER_PASSWORD
```

Für den echten Betrieb keine geteilten Demo-Credentials nutzen. Jede Person bekommt einen benannten Account, damit Uploads, Masken, Reviews, Exporte und Audit-Logs attributierbar bleiben.

## 11. Optionale Worker

Normales Annotieren benötigt keine Worker. Worker sind sinnvoll für:

- Wiederkehrende Export-Job-Verarbeitung.
- Prediction-Import-Batches, falls diese im Pilot genutzt werden.

Vorher in `deploy/trial.env` eine benannte `OWNER`- oder `QA`-Kennung setzen:

```text
SAPEN_JOB_EMAIL=qa@example.com
SAPEN_JOB_PASSWORD_FILE=/run/secrets/sapen_job_password
```

Export-Worker starten:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile worker up -d export-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs -f export-worker
```

Prediction-Import-Worker starten:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile worker up -d prediction-import-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs -f prediction-import-worker
```

Für den Pilot nur je einen Worker-Prozess pro Worker-Typ betreiben. Nicht mehrere Worker-Replicas skalieren, ohne Lease-/Storage-Annahmen zu prüfen.

## 12. Backup-Grundlagen

Backups vor echten Kundendaten testen. Lokale Dateien unter `backups/` sind nur Zwischenablage und müssen off-host kopiert werden.

PostgreSQL-Dump:

```bash
mkdir -p backups
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backups/sapen-annotate-postgres-$(date +%F).sql
```

MinIO-Volume-Archiv:

```bash
mkdir -p backups
docker run --rm \
  -v sapen-annotate-trial_miniodata:/data:ro \
  -v "$PWD/backups":/backup \
  alpine sh -c 'tar -czf /backup/sapen-annotate-minio-$(date +%F).tgz -C /data .'
```

Caddy-Daten optional sichern:

```bash
mkdir -p backups
for volume in caddy_data caddy_config; do
  docker run --rm \
    -v sapen-annotate-trial_${volume}:/data:ro \
    -v "$PWD/backups":/backup \
    alpine sh -c "tar -czf /backup/sapen-annotate-${volume}-$(date +%F).tgz -C /data ."
done
```

Danach die Backups auf einen anderen Server, lokalen Rechner oder separaten Storage kopieren. Ein VPS-Snapshot allein reicht nicht als Backup-Strategie, wenn DB und Object Storage auf demselben Server liegen.

Mindestens einmal Restore testen, bevor der Pilot als abgesichert gilt. Details stehen in [../04-server/backup-restore.md](../04-server/backup-restore.md).

## 13. Neue Version deployen

Vorher prüfen, dass keine lokalen Änderungen auf dem Server liegen:

```bash
git status --short
```

Update:

```bash
git pull --ff-only
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml build
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml --profile tools run --rm migrate
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml up -d
```

Danach prüfen:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml ps
curl -fsS https://annotate.example.com/api/health
curl -fsS https://annotate.example.com/api/ready
```

Bei Schema-Änderungen immer erst Migrationen über den Compose-Service `migrate` ausführen und erst danach App/Worker neu starten.

## 14. Troubleshooting-Checkliste

### DNS löst nicht auf

```bash
dig +short annotate.example.com
```

- A Record prüfen.
- Richtige öffentliche IPv4 prüfen.
- DNS-Propagation abwarten.

### Caddy bekommt kein Zertifikat

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 caddy
```

- Ports `80/tcp` und `443/tcp` offen?
- `TRIAL_HOSTNAME` korrekt?
- DNS zeigt auf diesen Server?
- Keine andere Software belegt Port 80/443?

### App verbindet nicht zur Datenbank

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 app
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 postgres
```

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` in `deploy/trial.env` gesetzt?
- `postgres` healthy?
- Migration gelaufen?

### Env-Werte fehlen

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml config
```

Nur mit Vorsicht verwenden: Diese Ausgabe kann Secrets enthalten. Nicht in Tickets, Chat oder Logs kopieren.

### Upload zu groß

- `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, `PREDICTION_BATCH_UPLOAD_MAX_BYTES` prüfen.
- `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` höher als App-Limits setzen.
- `CADDY_MAX_BODY_SIZE` höher als App-Limits setzen.
- Nach Änderung von `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` App-Image neu bauen.

### MinIO/S3-Credentials funktionieren nicht

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 minio
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 minio-init
curl -fsS https://annotate.example.com/api/ready
```

- `S3_ACCESS_KEY` und `S3_SECRET_KEY` ohne problematische Anführungszeichen/Backslashes verwenden.
- `S3_BUCKET` gesetzt?
- `minio-init` erfolgreich gelaufen?

### Worker-Auth schlägt fehl

- `SAPEN_JOB_EMAIL` ist eine benannte `OWNER`- oder `QA`-Kennung?
- Passwort per `SAPEN_JOB_PASSWORD_FILE` oder `SAPEN_JOB_PASSWORD` korrekt?
- Account nicht deaktiviert?
- Projektrolle reicht für den Job-Typ?

Logs:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 export-worker
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml logs --tail=200 prediction-import-worker
```

### Disk fast voll

```bash
df -h
docker system df
docker volume ls
```

Sichere zuerst Backups off-host. Danach nur bewusst aufräumen:

```bash
docker compose --env-file deploy/trial.env -f deploy/docker-compose.trial.yml exec app npm run storage:cleanup -- --dry-run
```

Nicht `docker compose down -v` im Pilot verwenden. Das löscht PostgreSQL-, MinIO- und Caddy-Volumes.
