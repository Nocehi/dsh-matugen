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
token SHA-256 revision + whole-snapshot ETag
        ↓
DSH browser verifies the token digest and validates snapshot metadata
        ↓
ctx.theme.overrideTokens("dsh-matugen", tokens)
        ↓
theme/change → existing UI repaints
```

No edit to the DSH dist, no HMR requirement, no second daemon, and no writes
back into DMS or Matugen state. The only DOM compatibility layer is the bounded
optional data-color sheet described below; the semantic DSH bridge remains a
ThemeRuntime override.

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
wire-compatible with v2. Every ThemeRuntime override contains both `light` and
`dark` values; the browser recomputes SHA-256 over the canonical token layer
before using `revision` as content identity. `SubtleCrypto` is preferred, while
ordinary HTTP origins use the dependency-free SHA-256 fallback.

### HCT extended colors for dsh-context

`dsh-context` uses six fixed colors as **data category identities**, not as UI
prominence roles: system, tool schemas, user, injected context, assistant, and
tool results. Mapping those categories onto Material primary/secondary/tertiary
would make their identity drift with every wallpaper.

`dsh-matugen` therefore treats the six dsh-context 0.10.x seeds as Material-style
**extended colors**. The Host uses Google's official
`@material/material-color-utilities` HCT implementation to keep each seed's
hue/chroma intent while selecting tone 40 for light presentation and tone 80
for dark presentation. Material does not prescribe 40/80 as a chart-series
rule; those are this bridge's bounded role-like tone choices.

```text
dsh-context category seed
        ↓
HCT(seed hue, seed chroma, tone 40 / 80)
        ↓
light/dark extended-color pair
        ↓
--dsh-matugen-context-{category}
        ↓
seed-guarded dsh-context data-viz compatibility selectors
```

The browser follows DSH's own resolved theme marker,
`body[data-ds-dark-theme]`, so a DSH light/dark/system preference change swaps
category tone without changing category hue identity. The compatibility sheet
is scoped to `.lc-root` / `.lc-modal-card` and only overrides known category
marks whose inline color still matches the original dsh-context seed. It does
not recolor the turn strip. If dsh-context changes a category seed or markup,
the affected rule stops matching instead of silently assigning the old
identity to a new category.

This extended-color payload is deliberately outside the digest-verified
ThemeRuntime `--dsw-*` token layer. It is same-origin presentation metadata and
is validated independently by the browser; the core semantic bridge remains
wire-compatible v2.

### Boundary

The semantic bridge only controls DSH semantic theme variables. It intentionally
does not rewrite `--dsw-static-deepseek-*`, `--dsw-static-blue-*`, or other stock
scales. A component that directly pins one of those static variables or a
literal blue still needs a component-side migration to an alias token. Examples
in upstream DSH include the ongoing `StateDot`, the Chat turn-status shimmer,
and reference chip literal colors. Those are presentation/theme-seam follow-ups,
not reasons to make the semantic bridge mutate the static palette.

The dsh-context category adapter above is an explicit exception for a third-party
data-visualisation surface: it owns no DSH semantic token and is removable if
that plugin later exposes theme-aware extended-color hooks of its own.

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

After the first successful snapshot the browser sends `If-None-Match` using the
whole-response `snapshotRevision`; an unchanged normalized snapshot receives
`304`. The separate `revision` remains the browser-verified SHA-256 identity of
the ThemeRuntime token layer. Transient failures keep the last good override
layer. Repeated diagnostics are rate-limited in the browser console and a later
successful sync emits one recovery message.

The Client effect checks its lifecycle after every asynchronous boundary. If a
response settles after the plugin was disposed, it cannot install an orphan
ThemeRuntime layer; if disposal races the synchronous install, the just-created
layer is immediately disposed. The optional context-category style tag is owned
by the same effect and removed on disposal.

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

The **browser artifact has zero npm runtime imports**. The builder admits only
the single local `./core.js` static import used by `src/client.js`, rejects any
additional static import and every dynamic `import(...)`, strips the known ESM
module surface, emits `lib/client.js`, and fails if the generated browser bundle
contains either `require()` or `import(...)`.

The Host package has one runtime dependency:
`@material/material-color-utilities@0.4.0`, used only to compile the fixed
category seeds into HCT light/dark pairs. It is not bundled into or required by
the browser artifact. Git installs run the browser builder through `prepare`.

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
npm install --ignore-scripts
npm run check
```

The ordinary gate covers semantic role coverage, derived state layers,
legacy-role fallbacks, protocol validation, digest verification with and without
`SubtleCrypto`, HCT category identity/tone generation, seed-guarded dsh-context
CSS, bounded reads, conditional GET/HEAD, path non-disclosure, client
diagnostics, dynamic-import rejection, built lazy-module geometry, and the
post-disposal race.

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
their operational semantics. With dsh-context installed, also switch DSH
light/dark appearance and confirm that the six data categories keep their
identity while their HCT tone adapts in both the Context tab and `/context`
modal.

## Scope

`dsh-matugen` is the DMS provider + DSH semantic token compiler. `dsh-rice`
consumes the same DSH theme variables while owning layout and presentation
independently; it should not need to know which wallpaper produced them.
