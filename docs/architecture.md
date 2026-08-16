# Architecture

`dsh-matugen` is one reversible Host → Client semantic color bridge with one
bounded optional compatibility layer for third-party categorical data colors.

```text
DankMaterialShell
  atomic dms-colors.json replacement
        │
        ▼
DSH Host
  open once → regular-file + byte bound → parse
        │
  Material roles → complete bridge-v2 --dsw-* token layer
        │                         │
        │                         └─ canonical tokens → SHA-256 `revision`
        │
  fixed dsh-context category seeds
        │
  official Material HCT → tone 40 light / tone 80 dark
        │
        └─ `contextCategories`
                 │
  revision + canonical contextCategories
                 │
                 └─ SHA-256 `snapshotRevision` → HTTP ETag
        ▼
GET /dsh-matugen/palette
        │ 200 whole snapshot / 304 unchanged
        ▼
DSH Web Client
  verify SHA-256(canonical tokens) == revision
  validate optional snapshot/category metadata
        │
        ├─ changed token revision
        │    └─ ctx.theme.overrideTokens("dsh-matugen", tokens)
        │
        └─ valid contextCategories
             └─ scoped seed-guarded compatibility style
        ▼
theme/change / body[data-ds-dark-theme] → existing presenters repaint
```

## Authority and effect boundaries

- DMS/Matugen owns Material scheme production. `dsh-matugen` never writes DMS state.
- `palettePath` and `maxPaletteBytes` are Host-only facts.
- The Host exposes normalized theme tokens and bounded presentation metadata, not filesystem paths or raw DMS JSON.
- Bridge v2 is a closed ThemeRuntime token protocol: all required DSH aliases must exist and unknown token names fail closed; the Dank16 success/warning aliases remain optional by role.
- `revision` is the cryptographic identity of exactly the normalized `--dsw-*` ThemeRuntime token layer. Host and browser compute SHA-256 over the same canonical token representation.
- `snapshotRevision` is a separate whole-response transport identity. The Host hashes the token `revision` plus canonical `contextCategories`; the browser shape-validates it and uses it for conditional polling. It is not a replacement for browser verification of `revision`.
- The six dsh-context category seeds are package-owned compatibility identities for the currently supported dsh-context 0.10.x surface. They are not Material primary/secondary/tertiary roles and do not inherit wallpaper hue.
- The browser prefers `SubtleCrypto.digest`; when an ordinary HTTP origin does not expose SubtleCrypto it uses the package's dependency-free SHA-256 implementation instead. Missing Web Crypto therefore never downgrades or skips token revision verification.
- Transient Host/network/protocol failure does not remove the last good ThemeRuntime layer. Invalid optional category metadata is not acknowledged as the current transport revision, so a later poll asks the Host for the full snapshot again.
- The browser effect owns exactly one current ThemeRuntime disposer and one optional context-category style tag. Lifecycle checks after every await prevent a completed request from publishing after unload; a synchronous token install racing unload is immediately reversed and the style tag is removed on disposal.
- Diagnostics stay browser-local and rate-limited; they add no model-visible prompt/context surface.

## Filesystem observation

The producer may replace `dms-colors.json` while the bridge is polling. The Host
therefore does not `stat(path) → readFile(path)` as two pathname observations.
It opens the path once and keeps that descriptor through validation and reading:

```text
open(path)
  → fstat(fd): regular file + size <= max
  → read(fd): at most max + 1 bytes
  → parse / map
  → close(fd)
```

If DMS renames a new palette over the path, the open descriptor continues to
name one complete old or new file. Growth beyond the configured bound is still
detected by the independent `max + 1` read ceiling.

## Semantic token compiler

Bridge v2 treats DMS/Matugen as the semantic color authority for DSH alias and
specific tokens while leaving the built-in `--dsw-static-*` scales untouched.
Direct mappings cover the Material surface hierarchy, primary/secondary/tertiary
accent families, foreground/outline roles, inverse roles, and error semantics.
DSH state layers without a one-to-one Material role are derived from semantic
role pairs through bounded alpha or foreground mixes.

Newer Material roles prefer exact DMS values. Explicit fallbacks preserve the
older DMS role floor where possible; changing the required DSH token corpus is a
wire-contract change rather than a silent extension of bridge v2.

## HCT extended colors for dsh-context

`dsh-context` 0.10.x uses six literal colors as categorical identities:

```text
system      #6366f1
tools       #f59e0b
user        #22c55e
inject      #a855f7
assistant   #3b82f6
tool        #14b8a6
```

Those categories describe data identity, not UI prominence. Reassigning them to
Material primary/secondary/tertiary would make category meaning drift with the
wallpaper, so the Host instead compiles each fixed seed through the official
Material Color Utilities HCT implementation. The seed's HCT hue/chroma intent is
kept while tone is selected by presentation mode:

```text
light → tone 40
dark  → tone 80
```

Material does not publish 40/80 as a categorical-chart recipe; these are this
bridge's bounded extended-color policy. HCT may reduce requested chroma when a
hue/tone combination is outside the renderable gamut, so the contract preserves
hue/chroma intent rather than promising identical numeric chroma.

The Host returns the resulting pairs as optional `contextCategories` metadata.
They deliberately remain outside ThemeRuntime and outside the token `revision`.
The browser requires exactly the six known category keys, exact known seeds, and
lowercase `#RRGGBB` light/dark values before publishing the compatibility sheet.

The sheet exposes `--dsh-matugen-context-{category}` variables. Light values live
on `:root`; `body[data-ds-dark-theme]`, owned by DSH ui-theme, overrides them with
the dark values. Rules are scoped to `.lc-root` and `.lc-modal-card` and target
only known dsh-context category marks whose inline `background` still contains
the original seed. `!important` is required because dsh-context currently writes
those category colors inline. The turn strip (`.lc-turn`) is deliberately not
recolored.

The seed guard is a compatibility fuse: if dsh-context changes a category seed
or the relevant markup, that rule stops matching instead of silently assigning
an old identity to a new category. The adapter can be removed if dsh-context
later exposes its own theme-aware extended-color contract.

No harmonization with the wallpaper is performed. DMS still controls ordinary
DSH surfaces and semantic accents; category hue identity stays fixed and only
its HCT tone follows light/dark presentation.

## HTTP transport and two revisions

The fixed same-origin route is:

```text
/dsh-matugen/palette
```

GET and HEAD are the only admitted methods. Current successful payloads contain:

```text
version / provider
revision          SHA-256 proof of canonical ThemeRuntime tokens
tokens            bridge-v2 --dsw-* light/dark layer
snapshotRevision  SHA-256 identity of revision + canonical contextCategories
contextCategories optional HCT extended-color metadata
```

The HTTP ETag is the quoted `snapshotRevision`, not the token `revision`. After a
successful 200 the browser sends that transport identity in `If-None-Match`; a
304 therefore means the whole normalized snapshot is unchanged. A metadata-only
category-policy change cannot be hidden behind an unchanged token digest.

The current Host always emits `snapshotRevision`. The client retains a bounded
compatibility fallback to `revision` when talking to an older response that does
not contain the new field. An invalid `snapshotRevision` or invalid category
extension is diagnosed and not acknowledged as the current transport identity.

The Host revalidates the source file on each poll before deciding 304. Conditional
requests bound response transfer; producer observation stays simple and
authoritative.

## DSH Client Modules boundary

A Web plugin's `./client` export is a built lazy-CJS artifact. DSH's Host-side
Client Modules registry resolves that export and the browser module system
expects execution to register:

```text
window.__ModuleLoader__.load({ id: "dsh-matugen", factory })
```

`scripts/build-client.mjs` accepts one deliberately tiny browser source graph:

```text
src/client.js → ./core.js
```

The builder requires that exact first static import, rejects additional static
imports and every dynamic `import(...)`, strips the known ESM declarations,
wraps the combined local source in the DSH factory handoff, and rejects a
generated artifact containing either `require()` or `import(...)`. The browser
artifact therefore has zero npm runtime imports even though the Host package now
has one runtime dependency.

The Host pins `@material/material-color-utilities` exactly at `0.4.0` for HCT.
That package's root barrel currently traverses an extensionless scheme import
that Node 22 does not resolve. The Host therefore uses `import.meta.resolve()` to
locate the official installed package, then imports its concrete `hct/hct.js`
and `utils/string_utils.js` modules. No Material algorithm is vendored and none
of this code enters the browser artifact.

Those concrete module paths are a physical-layout dependency, not a package
exports guarantee. The exact version pin prevents an ordinary install from
silently changing that layout; any Material Color Utilities upgrade must
revalidate these paths and the HCT tests before the pin moves.

The Host and browser entry modules are namespace plugins: `inject` and `apply`
remain sibling exports and there is deliberately no `default` export. Cordis
Loader unwraps a default export preferentially, so adding `export default apply`
would discard the namespace injection metadata. Exact rc.6 CI loads the Host
entry through the real Cordis Loader rather than hand-calling `apply`, pinning
this failure mode.

The Web boot graph carries package ids, bundle URLs/revisions, dependency edges,
and the immediate-prefetch bit. It does not serialize the Host Loader row's
plugin config into the browser entry. Therefore the values that must agree
across Host and Client remain package-fixed:

```text
route   /dsh-matugen/palette
poll    1000 ms
source  dsh-matugen
```

Only Host-local facts (`palettePath`, `maxPaletteBytes`) are configurable.

## Revision semantics

`revision` hashes the normalized ThemeRuntime token layer in sorted token-name
order. Whitespace or key-order changes in `dms-colors.json` therefore do not
reinstall that layer; a semantic token change does. Browser verification uses
the same canonical representation and remains mandatory with or without Web
Crypto.

`snapshotRevision` hashes `revision`, one newline, and the canonical
`contextCategories` object with sorted category keys and stable `seed/light/dark`
field order. It is the conditional-HTTP identity for everything the current
response can publish. A new `snapshotRevision` with the same token `revision`
updates compatible presentation metadata without redundantly reinstalling the
ThemeRuntime token layer.

## Why an HTTP route

The source palette is a host filesystem artifact while `ThemeRuntime` and the
optional compatibility style live in the browser. The existing DSH Web server
already owns the browser origin, so a small exact GET/HEAD route keeps localhost
and reverse-proxied/Tailscale Web sessions on the same origin without adding a
second daemon, port, CORS policy, or DSH business-RPC method.

## Evidence boundary

Repository CI covers the real Host Loader path, the exact rc.6 WebServer/theme
seams, deterministic browser-artifact closure, token digest verification with
and without SubtleCrypto, HCT category generation, seed-guarded compatibility
CSS, separate token/snapshot revisions, conditional polling, and deterministic
async lifecycle/diagnostics.

Physical Creator Lab dogfood has additionally confirmed the current Host route,
browser module activation, distinct `revision`/`snapshotRevision` values, and
rendered dsh-context category colors in both dark (HCT tone 80) and light (HCT
tone 40) Context-tab presentation. That evidence does not imply every physical
surface has been exercised: `/context` modal rendering, live wallpaper changes,
unload/reload behavior, and remote/iPad presentation remain separate physical
checks.
