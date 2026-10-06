# ss14help-pipeline

Builds validated data snapshots in `data/<server>/` from the SS14 server repositories listed in
`servers.yaml`. See ROADMAP.md (Phases 2–4) for what each stage will do.

```sh
uv sync
uv run ss14help-pipeline servers   # validate servers.yaml and list servers
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy src tests
```
