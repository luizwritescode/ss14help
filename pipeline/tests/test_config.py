from pathlib import Path

import pytest
from pydantic import ValidationError

from ss14help_pipeline.cli import main
from ss14help_pipeline.config import load_servers


def test_repo_servers_file_is_valid() -> None:
    servers = load_servers()
    assert {s.id for s in servers.servers} >= {"upstream", "starlight"}
    assert servers.get("upstream").branch == "master"


def test_duplicate_ids_are_rejected(tmp_path: Path) -> None:
    path = tmp_path / "servers.yaml"
    entry = "  - {id: a, name: A, repo: 'https://example.com/a', branch: main}\n"
    path.write_text("servers:\n" + entry * 2, encoding="utf-8")
    with pytest.raises(ValidationError, match="duplicate server ids: a"):
        load_servers(path)


def test_cli_lists_servers(capsys: pytest.CaptureFixture[str]) -> None:
    assert main(["servers"]) == 0
    assert "upstream\tWizard's Den" in capsys.readouterr().out
