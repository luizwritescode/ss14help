"""Command-line entry point: ``uv run ss14help-pipeline <command>``."""

import argparse
import sys
from pathlib import Path

from ss14help_pipeline import __version__
from ss14help_pipeline.config import DEFAULT_SERVERS_FILE, load_servers
from ss14help_pipeline.schema import DEFAULT_SCHEMA_FILE, write_schema


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ss14help-pipeline")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--servers-file", type=Path, default=DEFAULT_SERVERS_FILE)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("servers", help="validate servers.yaml and list configured servers")
    schema = commands.add_parser("schema", help="export the data contract as JSON Schema")
    schema.add_argument("--out", type=Path, default=DEFAULT_SCHEMA_FILE)
    args = parser.parse_args(argv)

    if args.command == "servers":
        for server in load_servers(args.servers_file).servers:
            print(f"{server.id}\t{server.name}\t{server.repo}@{server.branch}")
    elif args.command == "schema":
        print(f"wrote {write_schema(args.out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
