# dsh-matugen

A small, reversible palette bridge from **DankMaterialShell / Matugen** to the
**DeepSeek Harness Web** theme runtime.

The v0 path is deliberately boring:

```text
DMS writes dms-colors.json atomically
        ↓
DSH host plugin reads + validates it
        ↓
GET /dsh-matugen/palette (same DSH Web origin)
        ↓
browser plugin polls a semantic revision
        ↓
ctx.theme.overrideTokens("dsh-matugen", { light, dark })
        ↓
existing DSH UI repaints through theme/change
```

No DOM patching, no CSS injection into DSH dist, no HMR requirement, and no
writes back into DMS or Matugen state.

## What v0 maps

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

Every DSH override carries **both** light and dark values. Missing required
Material roles, malformed JSON, over-sized palettes, and non-hex colors fail
closed; the browser keeps the last good theme layer and retries later.

## Default source

The host reads:

```text
~/.cache/DankMaterialShell/dms-colors.json
```

Override it with either the Host Cordis row config or:

```sh
export DSH_MATUGEN_PALETTE=/path/to/dms-colors.json
```

DMS itself generates `colors.dark`, `colors.light`, and the optional `dank16`
palette in this file. `dsh-matugen` never invokes Matugen when using the DMS
provider.

## Build the DSH browser half

DSH Web does not import plugin client source directly. Its Client Modules host
resolves `exports["./client"]` and serves a built lazy-CJS artifact whose script
registers a factory with `window.__ModuleLoader__`.

`dsh-matugen` therefore builds `lib/client.js` with the same handoff shape:

```sh
npm install --ignore-scripts
npm run build
```

`npm run check` builds the artifact and then verifies that it registers exactly
one `dsh-matugen` factory and materializes without undeclared external client
dependencies.

## DSH composition

The package has a Node host entry and a Web client entry. The host half needs
`ctx.webServer`; the client half declares an injection on
`@deepseek-ai/dsh-client-ui-theme` and uses its public `ctx.theme` service.

Once the package is resolvable by the DSH process and `lib/client.js` has been
built, add the row from [`examples/cordis.patch.yml`](examples/cordis.patch.yml)
to your composition:

```yaml
- id: dsh-matugen
  name: dsh-matugen
  config:
    palettePath: !!js process.env.DSH_MATUGEN_PALETTE || process.env.HOME + '/.cache/DankMaterialShell/dms-colors.json'
```

The browser bridge geometry is intentionally package-fixed in v0:

```text
route   = /dsh-matugen/palette
poll    = 1000 ms
source  = dsh-matugen
```

DSH's Web boot graph carries package identity/dependency information but does
not copy the Host Loader row's config into the browser fiber. Pinning these
three values avoids a fake configuration surface where Host and Client could
disagree. Host-only `palettePath` and `maxPaletteBytes` remain configurable.

The bridge endpoint is read-only and intentionally lives outside `/api`: it
exposes normalized color tokens only, never the configured filesystem path or
raw file contents. Because the browser fetch is relative, localhost DSH Web and
a reverse-proxied/Tailscale-served DSH Web use the same origin automatically.

## Development

Requires Node 22+ and has no runtime npm dependencies. `tsdown` is development
only and emits the DSH-compatible browser artifact.

```sh
npm run check
```

The pure mapping/validation core is exported as `dsh-matugen/core` so future
standalone Matugen providers can reuse the same semantic mapping without
coupling themselves to DSH Web transport.

## Scope

v0 is the **DMS provider + DSH token bridge**, not a replacement DSH UI yet.
A later `dsh-rice` shell can consume the same palette layer while replacing
layout/sidebar/conversation presentation independently.
