# ss14help v2

A multi-server crafting and chemistry guide for Space Station 14, kept up to date automatically
from each server's game repository. The plan is in [ROADMAP.md](ROADMAP.md).

This is the `v2` branch. Its history is separate from `main`, which still holds the live v1 Flask
app.

## Layout

| Path            | What                                                     |
| --------------- | -------------------------------------------------------- |
| `apps/web`      | Next.js frontend (deployed on Vercel)                    |
| `packages/calc` | Calculator engine, pure TypeScript                       |
| `pipeline`      | Python data pipeline (uv, Pydantic), plus its Dockerfile |
| `data/<server>` | Generated, validated data snapshots                      |
| `servers.yaml`  | Supported servers                                        |
| `docs/`         | Operational notes (Vercel setup, etc.)                   |

## Requirements

Node 22+ with pnpm 10 (`corepack enable`), [uv](https://docs.astral.sh/uv/), and optionally Docker
and GNU Make.

## Common commands

```sh
make install   # pnpm install + uv sync
make web       # Next.js dev server
make test      # Vitest + pytest
make lint      # ESLint, tsc, Prettier, Ruff, mypy
make build     # production build of the web app
make docker    # build the pipeline image
```

## License

Code is MIT, see [LICENSE](LICENSE). Game data has its own sources and licenses, see
[ATTRIBUTION.md](ATTRIBUTION.md).
