# syntax=docker/dockerfile:1

FROM rust:1.94-bookworm AS builder
WORKDIR /src
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
# Hosts shared with other services can cap compile parallelism.
ARG CARGO_BUILD_JOBS=4
ENV CARGO_BUILD_JOBS=${CARGO_BUILD_JOBS}
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked \
    && cp target/release/setrya-signer /usr/local/bin/setrya-signer

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 signer \
    && useradd --system --uid 10001 --gid 10001 --home-dir /data --shell /usr/sbin/nologin signer \
    && mkdir -p /data /run/signer \
    && chown signer:signer /data /run/signer && chmod 700 /data && chmod 750 /run/signer
COPY --from=builder /usr/local/bin/setrya-signer /usr/local/bin/setrya-signer
USER signer
# /data holds the encrypted seed and wallet; /run/signer holds only the RPC cookie, shared read-only with the API.
VOLUME ["/data", "/run/signer"]
EXPOSE 28232
ENTRYPOINT ["setrya-signer"]
CMD ["serve", "--data-dir", "/data", "--listen", "127.0.0.1:28232"]
