# Architecture

`dsh-matugen` v0 is one reversible Host → Client color bridge.

```text
DankMaterialShell
  dms-colors.json
      │
      │ atomic producer-owned replacement
      ▼
DSH Host
  readDmsSnapshot()
      │ validate + map + semantic SHA-256
      ▼
  GET /dsh-matugen/palette
      │ normalized tokens only
      ▼
DSH Web Client
  poll / validate revision
      │
      ▼
  ctx.theme.overrideTokens("dsh-matugen", tokens)
      │
      ▼
  theme/change → existing presenters repaint
```

## Boundaries

- DMS/Matugen owns palette generation. The bridge never writes its state.
- The Host exposes only normalized `--dsw-*` token pairs; configured paths and raw palette bytes stay host-local.
- The browser accepts only bridge version 1, provider `dms`, a lowercase SHA-256 revision, valid DSH token names, and exact `{ light, dark }` hex pairs.
- A transient read, parse, or network failure leaves the last good override layer in place.
- Plugin disposal removes the current override layer through the disposer returned by `ThemeRuntime.overrideTokens()`.
- The bridge does not need DSH HMR: palette changes are runtime theme state changes rather than module-code replacement.

## DSH Client Modules boundary

A web plugin's `./client` export is a built artifact, not a browser ESM entry.
DSH's Host-side Client Modules registry resolves that export, hashes it into the
boot graph, and serves it below `/plugins`. Executing the artifact must register
a lazy factory with:

```text
window.__ModuleLoader__.load({ id: "dsh-matugen", factory })
```

`tsdown.config.mjs` emits exactly that shape into `lib/client.js`; the artifact
test executes the built file in a fresh VM and proves that the factory
materializes with no undeclared external client dependency.

The Web boot graph carries package ids, bundle URLs/revisions, dependency edges,
and the immediate-prefetch bit. It does not serialize the Host Loader row's
plugin config into the browser entry. Therefore v0 deliberately pins the values
that must agree across Host and Client:

```text
route   /dsh-matugen/palette
poll    1000 ms
source  dsh-matugen
```

Only Host-local facts (`palettePath`, `maxPaletteBytes`) are configurable.

## Semantic revision

The revision hashes the normalized token layer in sorted token-name order.
Whitespace or key-order changes in `dms-colors.json` therefore do not repaint
the client; a semantic color change does.

## Why an HTTP route

The source palette is a host filesystem artifact while `ThemeRuntime` lives in
the browser. The existing DSH Web server already owns the browser origin, so a
small exact GET/HEAD route keeps localhost and reverse-proxied/Tailscale Web
sessions on the same origin without adding a second daemon, port, CORS policy,
or DSH business-RPC method.
