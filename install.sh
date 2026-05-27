#!/bin/sh
set -eu

REPO="smithery-ai/flamecast-cli"
INSTALL_DIR="$HOME/.local/bin"
BIN_NAME="flamecast"

# Detect OS
OS="$(uname -s)"
case "$OS" in
  Darwin) os="darwin" ;;
  Linux)  os="linux" ;;
  *)
    printf "Unsupported OS: %s\n" "$OS" >&2
    exit 1
    ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
  arm64|aarch64) arch="arm64" ;;
  x86_64|amd64)  arch="x64" ;;
  *)
    printf "Unsupported architecture: %s\n" "$ARCH" >&2
    exit 1
    ;;
esac

URL="https://github.com/${REPO}/releases/latest/download/${BIN_NAME}-${os}-${arch}"

printf "Downloading %s-%s-%s...\n" "$BIN_NAME" "$os" "$arch"

mkdir -p "$INSTALL_DIR"

if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "${INSTALL_DIR}/${BIN_NAME}"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "${INSTALL_DIR}/${BIN_NAME}" "$URL"
else
  printf "Neither curl nor wget found. Install one and retry.\n" >&2
  exit 1
fi

chmod +x "${INSTALL_DIR}/${BIN_NAME}"

printf "Installed %s to %s/%s\n" "$BIN_NAME" "$INSTALL_DIR" "$BIN_NAME"

# Check if INSTALL_DIR is on PATH
case ":${PATH}:" in
  *":${INSTALL_DIR}:"*) ;;
  *)
    printf "\n%s is not on your PATH. Add it with:\n" "$INSTALL_DIR"
    printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
    ;;
esac
