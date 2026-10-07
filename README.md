# ss14help v2

A multi-server crafting and chemistry guide for Space Station 14, kept up to date automatically
from each server's game repository. The plan is in [ROADMAP.md](ROADMAP.md).

This is the `v2` branch. Its history is separate from `main`, which holds the retired v1 Flask
app (tagged `v1-legacy`).

## Layout

| Path              | What                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| `apps/web`        | Next.js frontend (deployed on Vercel)                                               |
| `packages/schema` | Data contract types, generated from the pipeline models, plus schema version checks |
| `packages/calc`   | Calculator engine, pure TypeScript                                                  |
| `pipeline`        | Python data pipeline (uv, Pydantic), plus its Dockerfile                            |
| `schema/`         | JSON Schema exported from the pipeline models, and hand-written example data        |
| `data/<server>`   | Generated, validated data snapshots                                                 |
| `servers.yaml`    | Supported servers                                                                   |
| `docs/`           | Operational notes (Vercel setup, etc.)                                              |

## Requirements

Node 22+ with pnpm 10 (`corepack enable`), [uv](https://docs.astral.sh/uv/), and optionally Docker
and GNU Make.

## Common commands

```sh
make install   # pnpm install + uv sync
make web       # Next.js dev server
make data      # build data/upstream from the game repo (pipeline)
make schema    # re-export JSON Schema + regenerate TS types (after editing models.py)
make test      # Vitest + pytest
make lint      # ESLint, tsc, Prettier, Ruff, mypy
make build     # production build of the web app
pnpm --filter web e2e   # Playwright acceptance tests (after make build)
make docker    # build the pipeline image
```

## License

Code is MIT, see [LICENSE](LICENSE). Game data has its own sources and licenses, see
[ATTRIBUTION.md](ATTRIBUTION.md).
