# Rora TidaLuna Plugins

Independent TidaLuna plugins by kururing:

- **Rora Romanized Lyrics** — synchronized original and locally romanized lyrics.
- **Rora Audio Quality** — honest catalog labels in track tables and confirmed current-stream format in Now Playing.

## Development

```powershell
npx --yes pnpm@10.15.1 install
npx --yes pnpm@10.15.1 test:rora
npx --yes pnpm@10.15.1 build
npx --yes pnpm@10.15.1 serve
```

Install the development store from `http://localhost:3000/store.json`.

## Install without localhost

The public TidaLuna store is deployed automatically from `main`:

```text
cd
```

Paste that URL into TidaLuna's **Install from URL** field. GitHub Pages
publishes the generated `dist/store.json` and versioned `.mjs` artifact after
the workflow's tests and build succeed.
