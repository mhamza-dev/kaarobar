# syntax=docker/dockerfile:1
#
# Kaarobar Cloud POS backend.
#
# Elixir 1.20.4 on OTP 28.4.3. Note that OTP 29 has no Elixir 1.20.4 build —
# the repo-root .tool-versions previously claimed erlang 29.0.5, which is not a
# combination that exists. These pins are the authoritative ones.
#
#   dev     — interactive image used by docker-compose for mix tasks and the server
#   builder — compiles a self-contained OTP release
#   runner  — minimal production image holding only the release

ARG ELIXIR_VERSION=1.20.4
ARG OTP_VERSION=28.4.3
ARG DEBIAN_VERSION=bookworm-20260824
ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}-slim"
ARG RUNNER_IMAGE="debian:bookworm-slim"

# ---------------------------------------------------------------------------
# dev — used by docker-compose; source is bind-mounted over /app
# ---------------------------------------------------------------------------
FROM ${BUILDER_IMAGE} AS dev

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
       build-essential git curl ca-certificates inotify-tools postgresql-client \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=dev \
    LANG=C.UTF-8 \
    ERL_AFLAGS="-kernel shell_history enabled"

WORKDIR /app
EXPOSE 4000

CMD ["mix", "phx.server"]

# ---------------------------------------------------------------------------
# builder — compiles the production release
# ---------------------------------------------------------------------------
FROM ${BUILDER_IMAGE} AS builder

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends build-essential git ca-certificates \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV=prod

# Dependencies first so edits to lib/ do not invalidate the dep cache.
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
RUN mkdir config

COPY config/config.exs config/prod.exs config/
RUN mix deps.compile

COPY lib lib
COPY priv priv
RUN mix compile

COPY config/runtime.exs config/
COPY rel rel
RUN mix release

# ---------------------------------------------------------------------------
# runner — production image
# ---------------------------------------------------------------------------
FROM ${RUNNER_IMAGE} AS runner

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends \
       libstdc++6 openssl libncurses6 locales ca-certificates curl \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    MIX_ENV=prod

WORKDIR /app
RUN chown nobody /app

COPY --from=builder --chown=nobody:root /app/_build/prod/rel/backend ./

USER nobody
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/v1/health || exit 1

CMD ["/app/bin/server"]
