# Reproducible pipeline runtime, used locally and by the GitHub Actions sync job.
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_DEV=1
WORKDIR /repo/pipeline

COPY pipeline/pyproject.toml pipeline/uv.lock pipeline/README.md ./
RUN uv sync --frozen --no-install-project

COPY pipeline/src ./src
RUN uv sync --frozen

COPY servers.yaml /repo/servers.yaml

ENTRYPOINT ["uv", "run", "--frozen", "ss14help-pipeline"]
CMD ["servers"]
