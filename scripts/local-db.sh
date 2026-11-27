#!/usr/bin/env bash
# A throwaway local Postgres 16 for development and tests, for machines without
# Docker or the Supabase CLI. It is NOT Supabase: it only creates stand-ins for
# what the migrations expect Supabase to provide (the storage schema with
# storage.buckets, the auth schema, and the anon/authenticated/service_role roles).
#
# Usage:
#   scripts/local-db.sh start          initialise (first run) and start the server
#   scripts/local-db.sh stop           stop the server
#   scripts/local-db.sh reset [--seed] wipe all data and start again; --seed also runs
#                                      the migrations and supabase/seed.sql
#   scripts/local-db.sh status         is it running?
#   scripts/local-db.sh url            print the DATABASE_URL
#
# Then, for a fresh database:
#   export DATABASE_URL="$(scripts/local-db.sh url)"
#   node scripts/migrate.ts && node scripts/seed.ts
#
# Settings (environment variables):
#   EIC_PG_DIR   where data, socket and log live (default /tmp/eic-pg)
#   EIC_PG_PORT  TCP port on 127.0.0.1 (default 54329)
#   PG_BIN       Postgres binaries (default /usr/lib/postgresql/16/bin)
#
# Authentication is "trust" and the server listens on 127.0.0.1 only. Never use
# this for anything but local development.
set -euo pipefail

PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
BASE="${EIC_PG_DIR:-/tmp/eic-pg}"
PORT="${EIC_PG_PORT:-54329}"
DATA="$BASE/data"
LOG="$BASE/postgres.log"
SOCK="$BASE"
URL="postgres://postgres:postgres@127.0.0.1:${PORT}/postgres"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

die() {
	echo "local-db: $*" >&2
	exit 1
}

[ -x "$PG_BIN/pg_ctl" ] || die "Postgres binaries not found in $PG_BIN (install postgresql-16 or set PG_BIN)."

# Postgres refuses to run as root, so as root everything runs as the 'postgres' user.
as_pg() {
	if [ "$(id -u)" = "0" ]; then
		id postgres >/dev/null 2>&1 || die "running as root but there is no 'postgres' user."
		# Run from a folder the postgres user can read (initdb and pg_ctl check the cwd).
		(cd / && runuser -u postgres -- "$@")
	else
		"$@"
	fi
}

prepare_dirs() {
	mkdir -p "$BASE"
	if [ "$(id -u)" = "0" ]; then
		chown postgres:postgres "$BASE"
	fi
	chmod 700 "$BASE"
}

is_running() {
	[ -f "$DATA/PG_VERSION" ] && as_pg "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1
}

psql_local() {
	as_pg "$PG_BIN/psql" -X -q -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -U postgres -d postgres "$@"
}

# What the hosted Supabase database already has and our migrations rely on.
# Safe to run again.
bootstrap() {
	psql_local <<'SQL'
do $$
begin
	if not exists (select 1 from pg_roles where rolname = 'anon') then
		create role anon nologin noinherit;
	end if;
	if not exists (select 1 from pg_roles where rolname = 'authenticated') then
		create role authenticated nologin noinherit;
	end if;
	if not exists (select 1 from pg_roles where rolname = 'service_role') then
		create role service_role nologin noinherit bypassrls;
	end if;
end
$$;

create schema if not exists auth;
create schema if not exists storage;

create table if not exists storage.buckets (
	id text primary key,
	name text not null,
	public boolean default false,
	file_size_limit bigint,
	allowed_mime_types text[],
	created_at timestamptz default now(),
	updated_at timestamptz default now()
);
SQL
}

start() {
	prepare_dirs
	if [ ! -f "$DATA/PG_VERSION" ]; then
		echo "local-db: creating a new cluster in $DATA"
		as_pg "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
	fi
	if is_running; then
		echo "local-db: already running on port $PORT"
	else
		as_pg "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" -w -t 30 \
			-o "-p $PORT -k $SOCK -c listen_addresses=127.0.0.1 -c timezone=UTC" start >/dev/null ||
			die "could not start Postgres, see $LOG"
		echo "local-db: started on port $PORT (log: $LOG)"
	fi
	bootstrap
	echo "$URL"
}

stop() {
	if is_running; then
		as_pg "$PG_BIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null
		echo "local-db: stopped"
	else
		echo "local-db: not running"
	fi
}

reset() {
	stop
	case "$DATA" in
		/tmp/*|"$HOME"/*) ;;
		*) die "refusing to delete $DATA (set EIC_PG_DIR to a folder under /tmp or your home)." ;;
	esac
	rm -rf -- "$DATA"
	start
	if [ "${1:-}" = "--seed" ]; then
		node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)' ||
			die "--seed needs Node 24 or later on PATH."
		cd "$ROOT"
		DATABASE_URL="$URL" node scripts/migrate.ts
		DATABASE_URL="$URL" node scripts/seed.ts
	fi
}

case "${1:-}" in
	start) start ;;
	stop) stop ;;
	reset) reset "${2:-}" ;;
	status)
		if is_running; then echo "local-db: running on port $PORT"; else echo "local-db: not running"; exit 1; fi
		;;
	url) echo "$URL" ;;
	*)
		echo "Usage: scripts/local-db.sh start|stop|reset [--seed]|status|url" >&2
		exit 2
		;;
esac
