# Caddy Reverse Proxy

## Purpose

The RB-046 customer-trial baseline uses Caddy as the only public service. The app, PostgreSQL, and MinIO stay on internal Docker networks.

## Trial Compose Shape

Chosen option: Option B.

- `caddy` - public HTTPS entrypoint on ports `80` and `443`.
- `app` - Next.js production server, private on the Compose network.
- `postgres` - private PostgreSQL.
- `minio` - private S3-compatible storage.

Option A, with Next.js as a host-level systemd service and only DB/MinIO in Compose, is intentionally not the trial default. Option B is more reproducible for a Strato-style server because volumes, networks, restart policies, and service dependencies live in one Compose model.

## Public Exposure Rules

- Expose only Caddy by default.
- Do not expose MinIO console or S3 API publicly for the customer trial.
- If MinIO must be exposed for admin maintenance, protect it separately and document the risk before enabling it.

The current browser upload flow uses app-mediated upload routes with PNG/JPEG validation, checksum/dimension checks, and object stat verification, so public MinIO access is not required.

## Caddy Body Limit

`deploy/Caddyfile.trial` sets:

```caddyfile
request_body {
	max_size {$CADDY_MAX_BODY_SIZE}
}
```

Keep `CADDY_MAX_BODY_SIZE` higher than `IMAGE_UPLOAD_MAX_BYTES`, `MASK_UPLOAD_MAX_BYTES`, and `PREDICTION_BATCH_UPLOAD_MAX_BYTES`. Also keep `NEXT_PROXY_CLIENT_MAX_BODY_SIZE` above the app limits because the Next proxy layer sees browser API mutations before route handlers. The default template uses `120MB` for Caddy, `120mb` for Next proxy buffering, 100 MiB for image/batch uploads, and 50 MiB for mask uploads.

## Example

See [../examples/Caddyfile.sapen-annotate](../examples/Caddyfile.sapen-annotate) for a static example and [../../deploy/Caddyfile.trial](../../deploy/Caddyfile.trial) for the Compose-mounted template.
