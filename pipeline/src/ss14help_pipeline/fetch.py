"""Get a server's game files: a shallow, sparse clone of only the folders the pipeline reads."""

import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ss14help_pipeline.config import REPO_ROOT, ServerConfig

DEFAULT_CACHE_DIR = REPO_ROOT / "pipeline" / ".cache"
SPARSE_PATHS = (
    "Resources/Prototypes",
    "Resources/Locale/en-US",
    "Resources/PartialPrototypes",
)


@dataclass(frozen=True)
class Checkout:
    root: Path
    """Repository root; prototypes are under ``root / "Resources/Prototypes"``."""
    sha: str
    commit_date: datetime

    @property
    def prototypes(self) -> Path:
        return self.root / "Resources" / "Prototypes"

    @property
    def resources(self) -> Path:
        return self.root / "Resources"

    @property
    def locale(self) -> Path:
        return self.root / "Resources" / "Locale" / "en-US"


def git(*args: str, cwd: Path) -> str:
    result = subprocess.run(
        ["git", *args], cwd=cwd, check=True, capture_output=True, text=True, encoding="utf-8"
    )
    return result.stdout.strip()


def remote_head(server: ServerConfig) -> str:
    """SHA at the tip of the server's branch, without cloning anything."""
    out = git("ls-remote", str(server.repo), f"refs/heads/{server.branch}", cwd=Path.cwd())
    if not out:
        raise RuntimeError(f"branch {server.branch} not found in {server.repo}")
    return out.split()[0]


def fetch(
    server: ServerConfig, cache_dir: Path = DEFAULT_CACHE_DIR, sha: str | None = None
) -> Checkout:
    """Clone or update ``cache_dir / server.id`` to ``sha`` (default: the branch tip).

    Only ``SPARSE_PATHS`` are checked out, with depth 1 and no blobs outside them, so even the
    large game repositories download in seconds. The cache is reused between runs.
    """
    root = cache_dir / server.id
    if not (root / ".git").exists():
        root.mkdir(parents=True, exist_ok=True)
        git("init", "--quiet", cwd=root)
        git("remote", "add", "origin", str(server.repo), cwd=root)
    else:
        git("remote", "set-url", "origin", str(server.repo), cwd=root)
    # Every run, so caches created before a path was added pick it up.
    git("sparse-checkout", "set", "--no-cone", *SPARSE_PATHS, cwd=root)

    target = sha or server.branch
    git("fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", target, cwd=root)
    git("checkout", "--quiet", "--force", "FETCH_HEAD", cwd=root)
    return checkout_at(root)


def checkout_at(root: Path) -> Checkout:
    """Describe an existing checkout (used for local clones and tests)."""
    if not (root / "Resources" / "Prototypes").is_dir():
        raise FileNotFoundError(f"{root} has no Resources/Prototypes")
    try:
        sha = git("rev-parse", "HEAD", cwd=root)
        date = datetime.fromisoformat(git("show", "-s", "--format=%cI", "HEAD", cwd=root))
    except (subprocess.CalledProcessError, FileNotFoundError):
        sha = "0" * 40
        date = datetime.fromtimestamp(0).astimezone()
    return Checkout(root=root, sha=sha, commit_date=date)
