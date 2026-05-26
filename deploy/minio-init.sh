#!/bin/sh
set -eu

: "${S3_ACCESS_KEY:?Set S3_ACCESS_KEY}"
: "${S3_SECRET_KEY:?Set S3_SECRET_KEY}"
: "${S3_BUCKET:?Set S3_BUCKET}"

S3_ENDPOINT="${S3_ENDPOINT:-http://minio:9000}"
MC_CONFIG_DIR="${MC_CONFIG_DIR:-/tmp/mc-config}"
export MC_CONFIG_DIR

reject_json_specials() {
  value="$1"
  name="$2"
  case "$value" in
    *\"*|*\\*)
      echo "$name must not contain double quotes or backslashes for trial MinIO init." >&2
      exit 1
      ;;
  esac
}

mkdir -p "$MC_CONFIG_DIR"
chmod 700 "$MC_CONFIG_DIR"

reject_json_specials "$S3_ACCESS_KEY" "S3_ACCESS_KEY"
reject_json_specials "$S3_SECRET_KEY" "S3_SECRET_KEY"
reject_json_specials "$S3_ENDPOINT" "S3_ENDPOINT"

{
  printf '%s\n' '{'
  printf '%s\n' '  "version": "10",'
  printf '%s\n' '  "aliases": {'
  printf '%s\n' '    "local": {'
  printf '      "url": "%s",\n' "$S3_ENDPOINT"
  printf '      "accessKey": "%s",\n' "$S3_ACCESS_KEY"
  printf '      "secretKey": "%s",\n' "$S3_SECRET_KEY"
  printf '%s\n' '      "api": "S3v4",'
  printf '%s\n' '      "path": "auto"'
  printf '%s\n' '    }'
  printf '%s\n' '  }'
  printf '%s\n' '}'
} > "$MC_CONFIG_DIR/config.json"
chmod 600 "$MC_CONFIG_DIR/config.json"

until mc --config-dir "$MC_CONFIG_DIR" ls local >/dev/null 2>&1; do
  echo "waiting for minio..."
  sleep 1
done

mc --config-dir "$MC_CONFIG_DIR" mb -p "local/$S3_BUCKET" >/dev/null 2>&1 || true
mc --config-dir "$MC_CONFIG_DIR" anonymous set none "local/$S3_BUCKET" >/dev/null 2>&1 || true
