"""Loading and validation of ``servers.yaml``."""

from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SERVERS_FILE = REPO_ROOT / "servers.yaml"


class ServerConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    id: str = Field(pattern=r"^[a-z0-9][a-z0-9-]*$")
    name: str = Field(min_length=1)
    repo: HttpUrl
    branch: str = Field(min_length=1)
    features: tuple[str, ...] = ()


class ServersFile(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    servers: tuple[ServerConfig, ...] = Field(min_length=1)

    @field_validator("servers")
    @classmethod
    def ids_are_unique(cls, servers: tuple[ServerConfig, ...]) -> tuple[ServerConfig, ...]:
        ids = [s.id for s in servers]
        duplicates = sorted({i for i in ids if ids.count(i) > 1})
        if duplicates:
            raise ValueError(f"duplicate server ids: {', '.join(duplicates)}")
        return servers

    def get(self, server_id: str) -> ServerConfig:
        for server in self.servers:
            if server.id == server_id:
                return server
        raise KeyError(server_id)


def load_servers(path: Path = DEFAULT_SERVERS_FILE) -> ServersFile:
    with path.open(encoding="utf-8") as f:
        return ServersFile.model_validate(yaml.safe_load(f))
