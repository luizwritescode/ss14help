"""Command-line entry point: ``uv run ss14help-pipeline <command>``."""

import argparse
import sys
from pathlib import Path

from ss14help_pipeline import __version__
from ss14help_pipeline.build import DEFAULT_DATA_DIR, build_snapshot
from ss14help_pipeline.config import DEFAULT_SERVERS_FILE, load_servers
from ss14help_pipeline.fetch import DEFAULT_CACHE_DIR, checkout_at, fetch
from ss14help_pipeline.schema import DEFAULT_SCHEMA_FILE, write_schema


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ss14help-pipeline")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--servers-file", type=Path, default=DEFAULT_SERVERS_FILE)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("servers", help="validate servers.yaml and list configured servers")
    schema = commands.add_parser("schema", help="export the data contract as JSON Schema")
    schema.add_argument("--out", type=Path, default=DEFAULT_SCHEMA_FILE)
    build = commands.add_parser("build", help="build data/<server>/ from the server's repository")
    build.add_argument("server", help="server id from servers.yaml")
    build.add_argument("--sha", help="commit to build (default: tip of the configured branch)")
    build.add_argument(
        "--source", type=Path, help="use an existing checkout instead of fetching (no network)"
    )
    build.add_argument("--out", type=Path, default=DEFAULT_DATA_DIR, help="data directory")
    build.add_argument("--cache", type=Path, default=DEFAULT_CACHE_DIR, help="clone cache")
    args = parser.parse_args(argv)

    if args.command == "servers":
        for server in load_servers(args.servers_file).servers:
            print(f"{server.id}\t{server.name}\t{server.repo}@{server.branch}")
    elif args.command == "schema":
        print(f"wrote {write_schema(args.out)}")
    elif args.command == "build":
        server = load_servers(args.servers_file).get(args.server)
        checkout = checkout_at(args.source) if args.source else fetch(server, args.cache, args.sha)
        result = build_snapshot(server, checkout, args.out)
        m = result.manifest
        counts = ", ".join(f"{n} {k}" for k, n in m.counts.items())
        print(f"{server.id} @ {m.sha[:10]} ({m.commit_date:%Y-%m-%d}): {counts}")
        print(f"{len(m.warnings)} warnings; wrote {result.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
