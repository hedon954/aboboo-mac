# AGENTS.md

## Cursor Cloud specific instructions

This is a **Tauri v2 desktop application** (Rust backend + React/TypeScript/Vite frontend) for audio/language learning.

### Services

| Component | Description |
|-----------|-------------|
| Frontend  | React 18 + Vite 6 + TypeScript on port 1420 |
| Backend   | Rust (Tauri v2) desktop shell with filesystem/dialog/shell plugins |

### Development Commands

Standard commands are in `package.json`:

- **Full Tauri dev**: `npm run tauri dev` (starts both Vite dev server and Rust backend)
- **Frontend only**: `npm run dev` (Vite on http://localhost:1420)
- **TypeScript check**: `npx tsc --noEmit`
- **Rust format check**: `cargo fmt -- --check`
- **Rust lint**: `cargo clippy --all-targets --all-features --tests --benches -- -D warnings`
- **Rust check**: `cargo check --all`
- **Rust tests**: `cargo nextest run --all-features` (currently 0 tests in the project)
- **Rust tests (fallback)**: `cargo test --all-features`

### Non-obvious notes

- Tauri v2 on Linux requires system libraries: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `libssl-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`. These are pre-installed in the VM snapshot.
- `cargo nextest` requires `cargo-nextest` to be installed (`cargo install cargo-nextest --locked`). Pre-installed in the VM snapshot.
- The `npm run tauri dev` command requires `DISPLAY` to be set (uses `:1` in the cloud VM). EGL warnings about DRI3 are cosmetic and do not affect functionality.
- `tauri.conf.json` configures the Vite dev server as `beforeDevCommand`, so `npm run tauri dev` automatically starts Vite — no need to start it separately.
- The `.pre-commit-config.yaml` defines hooks for `cargo fmt`, `cargo check`, `cargo clippy`, and `cargo nextest run`.
