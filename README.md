# dsh-matugen

A small, reversible palette bridge from **DankMaterialShell / Matugen** to the
**DeepSeek Harness Web** theme runtime.

```text
DMS atomically replaces dms-colors.json
        ↓
DSH Host opens one bounded file descriptor
        ↓
validate → Material roles → --dsw-* light/dark tokens
        ↓
GET /dsh-matugen/palette
        ↓
SHA-256 content identity + ETag
        ↓
DSH browser verifies the digest
        ↓
ctx.theme.overrideTokens("dsh-matugen", tokens)
        ↓
theme/change → existing UI repaints
```

No DOM patching, no edit to the DSH dist, no HMR requirement, no second daemon,
and no writes back into DMS or Matugen state.

## What v0.1 maps

| DMS / Material role | DSH token |
|---|---|
| `background` | `--dsw-alias-bg-base` |
| `surface_container_low` | `--dsw-alias-bg-layer-1`, `--dsw-specific-sidebar-fill` |
| `surface_container` | `--dsw-alias-bg-layer-2` |
| `surface_container_high` | `--dsw-alias-bg-overlay` |
| `outline_variant` | `--dsw-alias-border-l1` |
| `outline` | `--dsw-alias-border-l2` |
| `primary` | `--dsw-alias-brand-primary` |
| `on_surface` | `--dsw-alias-label-primary` |
| `on_surface_variant` | `--dsw-alias-label-secondary` |
| `error` | `--dsw-alias-state-error-primary` |
| optional `dank16.color2` | `--dsw-alias-state-success-primary` |
| optional `dank16.color3` | `--dsw-alias-state-warn-primary` |

Bridge protocol v1 requires the complete required token set and rejects unknown
tokens. Every override contains both `light` and `dark` values. The browser
recomputes SHA-256 over the canonical token layer before treating `revision` as
content identity. `SubtleCrypto` is used when available; origins that do not
expose it use the package's dependency-free SHA-256 fallback, so revision
verification is never skipped.

## DMS source

The Host reads by default:

```text
~/.cache/DankMaterialShell/dms-colors.json
```

Override it through the Host Cordis row or environment:

```sh
export DSH_MATUGEN_PALETTE=/path/to/dms-colors.json
```

Environment and explicit paths use the same `~`/relative-path normalization.
The Host opens the selected path once, requires a regular file, rejects a file
larger than `maxPaletteBytes` before JSON parsing, and reads at most one byte
past that bound through the same descriptor. DMS atomic replacement therefore
produces either a complete old snapshot or a complete new snapshot.

## Browser transport

The cross-face values are package-fixed:

```text
route   = /dsh-matugen/palette
poll    = 1000 ms
source  = dsh-matugen
```

DSH's Web boot graph does not serialize a Host Loader row's config into its
browser fiber, so making these values look configurable would create a false
Host/Client contract. `palettePath` and `maxPaletteBytes` remain Host-only.

After the first successful palette the browser sends `If-None-Match`; an
unchanged semantic palette receives `304`. Transient failures keep the last good
override layer. Repeated diagnostics are rate-limited in the browser console and
a later successful sync emits one recovery message.

The Client effect checks its lifecycle after every asynchronous boundary. If a
response settles after the plugin was disposed, it cannot install an orphan
ThemeRuntime layer; if disposal races the synchronous install, the just-created
layer is immediately disposed.

## DSH browser artifact

DSH Web loads a plugin's `exports["./client"]` as a lazy CJS factory registered
through:

```text
window.__ModuleLoader__.load({ id: "dsh-matugen", factory })
```

This repository builds that artifact with a small repo-local Node script:

```sh
npm run build
```

There are **zero npm build/runtime dependencies**. The builder admits only the
single local `./core.js` static import used by `src/client.js`, rejects any
additional static import and every dynamic `import(...)`, strips the known ESM
module surface, emits `lib/client.js`, and fails if the generated browser bundle
contains either `require()` or `import(...)`. This keeps package-manager and
runtime dependency resolution outside the browser-artifact boundary.

Git installs run the same builder through `prepare`.

## DSH composition

Once the package is resolvable by DSH and `lib/client.js` exists, insert the Host
row into the Web profile. During current local dogfood the package is installed
as a plain profile dependency, so use the checked-in
[`examples/cordis.patch.yml`](examples/cordis.patch.yml) insert layer:

```yaml
- insert:
    - id: dsh-matugen
      name: dsh-matugen
      config:
        palettePath: !!js process.env.DSH_MATUGEN_PALETTE || process.env.HOME + '/.cache/DankMaterialShell/dms-colors.json'
```

The Host half injects `ctx.webServer`; the browser half declares the DSH theme
plugin as its client dependency and collaborates only through `ctx.theme`.
Both halves are namespace plugins (`inject` + `apply`) with no `default` export,
so Cordis Loader preserves their injection metadata.

## Verification

```sh
npm run check
```

The ordinary gate uses Node only and covers mapping, protocol validation,
digest verification with and without `SubtleCrypto`, bounded reads, conditional
GET/HEAD, path non-disclosure, client diagnostics, dynamic-import rejection,
built lazy-module geometry, and the post-disposal race.

CI also runs a separate exact `@deepseek-ai/dsh@0.1.0-rc.6` seam gate. It boots
the real rc.6 Host `WebServer` and loads the Host plugin through the real Cordis
Loader before performing an HTTP request through the bridge; it additionally
checks the exact rc.6 theme package's published
`overrideTokens(source, ThemeTokenOverrides): () => void` declaration and its
lazy browser artifact. This is an rc.6 seam test, not a claim that CI has booted
a full graphical DSH Web session.

The remaining end-to-end dogfood gate is deliberately physical: compose this
package into the current DSH Web deployment, change the DMS wallpaper/palette,
and observe the real browser/iPad repaint and unload/reload behavior.

## Scope

`dsh-matugen` is the DMS provider + DSH token bridge. A future `dsh-rice` shell
can consume the same palette contract while replacing layout, sidebar, and
conversation presentation independently.