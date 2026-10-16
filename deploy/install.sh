#!/usr/bin/env bash
# machina production installer (blade).
# Idempotent; safe to re-run. Requires sudo.
set -euo pipefail

if [[ $EUID -eq 0 ]]; then echo "do NOT run as root; run as the operator user (uses sudo for specific steps)" && exit 1; fi

INSTALL_DIR="${INSTALL_DIR:-/home/$USER/machina}"
DATA_DIR="${DATA_DIR:-/var/lib/machina}"
STORAGE_DIR="${STORAGE_DIR:-/mnt/machina}"
SERVICE_NAME=machina

echo "==> install dir: ${INSTALL_DIR}"
echo "==> DB/data dir: ${DATA_DIR}"
echo "==> storage:     ${STORAGE_DIR}"

# --- dirs owned by the service user -------------------------------------------
sudo mkdir -p "$DATA_DIR" "$STORAGE_DIR"
sudo chown "$USER":"$USER" "$DATA_DIR" "$STORAGE_DIR"
for d in images vms seeds vnc tmp ssh; do mkdir -p "$STORAGE_DIR/$d"; done
chmod 1777 "$STORAGE_DIR/vnc"
chmod 700 "$DATA_DIR"

# --- deps ---------------------------------------------------------------------
if ! command -v virsh >/dev/null 2>&1; then
  echo "libvirt-clients missing; install: sudo apt install libvirt-daemon-system libvirt-clients qemu-system-x86 genisoimage"
  exit 1
fi
command -v tsx >/dev/null 2>&1 || true

# --- libvirt membership --------------------------------------------------------
groups | grep -qw kvm || echo "NOTE: add to kvm group: sudo usermod -aG kvm $USER (re-login needed)"
groups | grep -qw libvirt || echo "NOTE: add to libvirt group: sudo usermod -aG libvirt $USER (re-login needed)"

# --- secrets -------------------------------------------------------------------
if [[ ! -f "$DATA_DIR/machina.key" ]]; then
  openssl rand -hex 32 > "$DATA_DIR/machina.key"
  chmod 600 "$DATA_DIR/machina.key"
  echo "==> generated $DATA_DIR/machina.key (AES master key)"
fi

ENV_FILE="$DATA_DIR/machina.env"
if [[ ! -f "$ENV_FILE" ]]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | head -c 16)
  cat > "$ENV_FILE" <<EOF
MACHINA_STORAGE_DIR=$STORAGE_DIR
MACHINA_DB_PATH=$DATA_DIR/machina.db
AUTH_SECRET=$AUTH_SECRET
AUTH_TRUST_HOST=true
ADMIN_USER=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD
NODE_ENV=production
SERVER_PORT=3999
EOF
  chmod 600 "$ENV_FILE"
  echo "==> wrote $ENV_FILE (chmod 600)"
fi

# --- systemd unit ---------------------------------------------------------------
cat > /tmp/machina.service <<EOF2
[Unit]
Description=machina VM rental platform
After=network-online.target libvirtd.service
Wants=network-online.target libvirtd.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$DATA_DIR/machina.env
ExecStart=/usr/bin/env npx tsx server.ts
Restart=always
RestartSec=5
# libvirt unix socket + kvm access
SupplementaryGroups=libvirt qemu kvm

[Install]
WantedBy=multi-user.target
EOF2
sudo cp /tmp/machina.service /etc/systemd/system/machina.service
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sleep 2
sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -12 || true

echo
echo "Done. Admin credentials in $DATA_DIR/machina.env (ADMIN_PASSWORD)."
echo "The service listens on SERVER_PORT (default 3999)."
