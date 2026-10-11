"""Command-line entry point: ``uv run ss14help-pipeline <command>``."""

import argparse
import json
import sys
from pathlib import Path

from ss14help_pipeline import __version__
from ss14help_pipeline.build import DEFAULT_DATA_DIR, assemble_snapshot
from ss14help_pipeline.config import DEFAULT_SERVERS_FILE, ServerConfig, load_servers
from ss14help_pipeline.diff import diff_snapshots, load_items, prepend_changelog
from ss14help_pipeline.fetch import DEFAULT_CACHE_DIR, Checkout, checkout_at, fetch
from ss14help_pipeline.schema import DEFAULT_SCHEMA_FILE, write_schema
from ss14help_pipeline.validate import (
    DEFAULT_ALLOWLIST,
    load_allowlist,
    read_manifest,
    render_report,
    validate,
)

EXIT_HALT = 3
"""Validation failed and nothing was written. The sync job opens a halt issue on this code only."""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ss14help-pipeline")
    parser.add_argument("--version", action="version", version=__version__)
    parser.add_argument("--servers-file", type=Path, default=DEFAULT_SERVERS_FILE)
    commands = parser.add_subparsers(dest="command", required=True)
    servers = commands.add_parser("servers", help="validate servers.yaml and list servers")
    servers.add_argument("--json", action="store_true", help="print one JSON array (for CI)")
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
    build.add_argument("--allowlist", type=Path, default=DEFAULT_ALLOWLIST)
    build.add_argument(
        "--allow-regression",
        action="store_true",
        help="publish even if counts dropped by more than the regression guard allows",
    )
    build.add_argument("--report", type=Path, help="write the validation report here on a halt")
    build.add_argument("--commit-message", type=Path, help="write the commit message here")
    args = parser.parse_args(argv)

    if args.command == "servers":
        configured = load_servers(args.servers_file).servers
        if args.json:
            print(json.dumps([s.model_dump(mode="json") for s in configured]))
        else:
            for server in configured:
                print(f"{server.id}\t{server.name}\t{server.repo}@{server.branch}")
    elif args.command == "schema":
        print(f"wrote {write_schema(args.out)}")
    elif args.command == "build":
        server = load_servers(args.servers_file).get(args.server)
        checkout = checkout_at(args.source) if args.source else fetch(server, args.cache, args.sha)
        return build_server(server, checkout, args)
    return 0


def build_server(server: ServerConfig, checkout: Checkout, args: argparse.Namespace) -> int:
    """Assemble, validate against the published snapshot, then write it with a changelog entry."""
    result = assemble_snapshot(server, checkout, args.out)
    m = result.manifest
    counts = ", ".join(f"{n} {k}" for k, n in m.counts.items())
    print(f"{server.id} @ {m.sha[:10]} ({m.commit_date:%Y-%m-%d}): {counts}")

    previous = read_manifest(result.out_dir)
    problems = validate(result, previous, load_allowlist(args.allowlist), args.allow_regression)
    if problems:
        report = render_report(m, problems)
        if args.report:
            args.report.write_text(report, encoding="utf-8")
        print(report, file=sys.stderr)
        print(f"halted: {len(problems)} validation problem(s), nothing written", file=sys.stderr)
        return EXIT_HALT

    diff = diff_snapshots(previous, load_items(result.out_dir), result)
    result.write()
    if diff.has_changes:
        prepend_changelog(result.out_dir, diff.changelog_entry(), server.name)
    if args.commit_message:
        args.commit_message.write_text(diff.commit_message() + "\n", encoding="utf-8")
    print(f"{len(m.warnings)} warnings; {diff.summary()}; wrote {result.out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
