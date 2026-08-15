# dsh-matugen

A small, reversible palette bridge from **DankMaterialShell / Matugen** to the
**DeepSeek Harness Web** theme runtime.

```text
DMS atomically replaces dms-colors.json
        ↓
DSH Host opens one bounded file descriptor
        ↓
validate → Material semantic roles → --dsw-* light/dark tokens
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

## Semantic theme bridge v2

Bridge v2 treats DMS/Matugen as the semantic color authority rather than as a
small accent patch. It overrides DSH **alias/specific tokens**, never the stock
`--dsw-static-*` palette.

The direct coverage includes:

| Material family | Representative DSH consumers |
|---|---|
| `background` / `surface_container_low` / `surface_container` / `surface_container_high` / `surface_container_highest` | page, layer surfaces, overlay, sidebar/rail, composer, menus, bubbles, code surfaces |
| `primary` / `primary_container` / `on_primary` | active Chat/Trajectory accent, business state, send/primary buttons, branded text, selected accent surfaces |
| `secondary` / `secondary_container` | ghost-active controls, selectors, secondary selected surfaces, sidebar active surface |
| `tertiary` | DSH business-tertiary semantic accent |
| `on_surface` / `on_surface_variant` / `outline` / `outline_variant` | primary/secondary/caption text and borders |
| `inverse_surface` / `inverse_on_surface` | tooltip/toast and inverted foreground semantics |
| `error` | DSH error state family |
| optional `dank16.color2` | DSH success primary |
| optional `dank16.color3` | DSH warning label + primary |

DSH state-layer colors that do not have one-to-one Material scheme roles are
derived in the bridge. Hover/active layers use either Material-style alpha
state layers or an 8% foreground mix over the semantic container, so those
interactions track the wallpaper without creating a second static palette.

Newer Material families prefer their exact DMS role. To remain compatible with
DMS palettes that expose the original bridge-v1 role floor, v2 has bounded
semantic fallbacks, for example:

```text
surface_container_highest → surface_container_high
primary_container          → primary
secondary                  → primary
secondary_container        → surface_container_high
tertiary                   → secondary → primary
inverse_surface            → surface_container_high
```

The bridge payload itself is **protocol version 2** because the required DSH
token corpus expanded. A v1 browser/host pair is deliberately not treated as
wire-compatible with v2. Every override contains both `light` and `dark`
values; the browser recomputes SHA-256 over the canonical token layer before
using `revision` as content identity. `SubtleCrypto` is preferred, while
ordinary HTTP origins use the dependency-free SHA-256 fallback.

### Boundary

This package only controls semantic theme variables. It intentionally does not
rewrite `--dsw-static-deepseek-*`, `--dsw-static-blue-*`, or other stock scales.
A component that directly pins one of those static variables or a literal blue
still needs a component-side migration to an alias token. Examples in upstream
DSH include the ongoing `StateDot`, the Chat turn-status shimmer, and reference
chip literal colors. Those are presentation/theme-seam follow-ups, not reasons
to make the semantic bridge mutate the static palette.

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

The ordinary gate uses Node only and covers semantic role coverage, derived
state layers, legacy-role fallbacks, protocol validation, digest verification
with and without `SubtleCrypto`, bounded reads, conditional GET/HEAD, path
non-disclosure, client diagnostics, dynamic-import rejection, built lazy-module
geometry, and the post-disposal race.

CI also runs a separate exact `@deepseek-ai/dsh@0.1.0-rc.6` seam gate. It boots
the real rc.6 Host `WebServer` and loads the Host plugin through the real Cordis
Loader before performing an HTTP request through the bridge; it additionally
checks the exact rc.6 theme package's published
`overrideTokens(source, ThemeTokenOverrides): () => void` declaration and its
lazy browser artifact. This is an rc.6 seam test, not a claim that CI has booted
a full graphical DSH Web session.

The remaining end-to-end dogfood gate is deliberately physical: compose this
package into the current DSH Web deployment, change the DMS wallpaper/palette,
and observe the real browser/iPad repaint and unload/reload behavior. For v2,
physical inspection should specifically confirm that active tabs, caret/focus,
primary/send controls, selectors, elevated surfaces, and Trajectory business
accents follow the current Material scheme while error/success/warning retain
their operational semantics.

## Scope

`dsh-matugen` is the DMS provider + DSH semantic token compiler. `dsh-rice`
consumes the same DSH theme variables while owning layout and presentation
independently; it should not need to know which wallpaper produced them.
