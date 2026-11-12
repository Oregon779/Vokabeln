#!/usr/bin/env bash
# Lumière: gibt den geheimen Link zum Admin-Panel (admin.html) aus.
#
#   bash /var/www/vokabeln/tools/admin-link.sh         -> zeigt deinen Link (legt ihn beim ersten Mal an)
#   bash /var/www/vokabeln/tools/admin-link.sh --neu   -> neuer Link, der alte gilt ab sofort nicht mehr
#
# Der Schluessel selbst liegt NUR auf dem Server, ausserhalb des Web-Ordners
# (~/.config/lumiere/admin-token, nur fuer dich lesbar). Im Web-Ordner landet
# lediglich sein SHA-256 (admin-key.json) - daraus laesst sich der Link nicht
# zurueckrechnen. admin-key.json steht in .gitignore, "git pull" fasst sie nicht an.
# Die eigentliche Berechtigung bleibt is_admin in Supabase: wer den Link hat,
# muss sich trotzdem mit einem Admin-Konto anmelden.
set -euo pipefail

WEB="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOMAIN="${LUMIERE_DOMAIN:-vokabeln.stoneuniverse.de}"
CONF="${XDG_CONFIG_HOME:-$HOME/.config}/lumiere"
TOKFILE="$CONF/admin-token"

new_token(){
  if command -v openssl >/dev/null 2>&1; then openssl rand -hex 24
  else head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n'; fi
}

mkdir -p "$CONF"
chmod 700 "$CONF"
FRESH=0
if [ "${1:-}" = "--neu" ] && [ -s "$TOKFILE" ]; then FRESH=2; fi
if [ "$FRESH" = "2" ] || [ ! -s "$TOKFILE" ]; then
  [ "$FRESH" = "2" ] || FRESH=1
  umask 077
  new_token > "$TOKFILE"
fi
TOKEN="$(tr -dc '0-9a-f' < "$TOKFILE")"
if [ "${#TOKEN}" -lt 32 ]; then echo "Schluessel in $TOKFILE ist kaputt - mit --neu neu anlegen." >&2; exit 1; fi

HASH="$(printf '%s' "$TOKEN" | sha256sum | cut -d' ' -f1)"
printf '{"sha256":"%s"}\n' "$HASH" > "$WEB/admin-key.json.tmp"
chmod 644 "$WEB/admin-key.json.tmp"
mv "$WEB/admin-key.json.tmp" "$WEB/admin-key.json"

echo
case "$FRESH" in
  2) echo "  Neuer Admin-Link (der alte gilt ab sofort nicht mehr):" ;;
  1) echo "  Dein Admin-Link (gerade angelegt):" ;;
  *) echo "  Dein Admin-Link:" ;;
esac
echo
echo "  https://$DOMAIN/admin.html#k=$TOKEN"
echo
echo "  Gilt dauerhaft, bis du 'bash $WEB/tools/admin-link.sh --neu' ausfuehrst."
echo "  Nicht weitergeben - wer ihn hat, sieht zumindest die Anmeldemaske."
echo
