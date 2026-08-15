# Architecture

`dsh-matugen` is one reversible Host → Client color bridge.

```text
DankMaterialShell
  atomic dms-colors.json replacement
        │
        ▼
DSH Host
  open once → regular-file + byte bound → parse
        │
  Material roles → complete bridge-v1 token layer
        │
  canonical JSON → SHA-256 revision / ETag
        ▼
GET /dsh-matugen/palette
        │ 200 payload / 304 unchanged
        ▼
DSH Web Client
  validate schema + token set
        │
  SHA-256(canonical tokens) == revision
        ▼
ctx.theme.overrideTokens("dsh-matugen", tokens)
        │
        ▼
theme/change → existing presenters repaint
```

## Authority and effect boundaries

- DMS/Matugen owns palette production. `dsh-matugen` never writes DMS state.
- `palettePath` and `maxPaletteBytes` are Host-only facts.
- The Host exposes normalized theme tokens, not filesystem paths or raw DMS JSON.
- Bridge v1 is a closed token protocol: all required DSH aliases must exist and unknown names fail closed; the two Dank16 state aliases remain optional as a pair-by-role source.
- `revision` is content identity, not an opaque sequence number: both Host and browser compute SHA-256 over the same canonical token representation.
- The browser prefers `SubtleCrypto.digest`; when an ordinary HTTP origin does not expose SubtleCrypto it uses the package's dependency-free SHA-256 implementation instead. Missing Web Crypto therefore never downgrades or skips revision verification.
- Transient Host/network/protocol failure does not remove the last good browser layer.
- The browser effect owns exactly one current ThemeRuntime disposer. Lifecycle checks after every await prevent a completed request from publishing after unload; a synchronous install racing unload is immediately reversed.
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

## HTTP transport

The fixed same-origin route is:

```text
/dsh-matugen/palette
```

GET and HEAD are the only admitted methods. Successful payloads carry an ETag
equal to the quoted semantic revision. After first sync the browser sends
`If-None-Match`; an unchanged snapshot receives 304 with no body. The Host
currently revalidates the source file on each poll before deciding 304 — the
conditional request bounds response transfer, while producer observation stays
simple and authoritative.

## DSH Client Modules boundary

A Web plugin's `./client` export is a built lazy-CJS artifact. DSH's Host-side
Client Modules registry resolves that export and the browser module system
expects execution to register:

```text
window.__ModuleLoader__.load({ id: "dsh-matugen", factory })
```

This repository has no npm build dependency. `scripts/build-client.mjs` accepts
one deliberately tiny source graph:

```text
src/client.js → ./core.js
```

The builder requires that exact first static import, rejects additional static
imports and every dynamic `import(...)`, strips the known ESM declarations,
wraps the combined local source in the DSH factory handoff, and rejects a
generated artifact containing either `require()` or `import(...)`. The browser
artifact therefore cannot silently grow a package/runtime import boundary.

The Host and browser entry modules are namespace plugins: `inject` and `apply`
remain sibling exports and there is deliberately no `default` export. Cordis
Loader unwraps a default export preferentially, so adding `export default apply`
would discard the namespace injection metadata and is covered by the real-Loader
rc.6 regression.

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
the client; a semantic color change does. Browser verification uses the same
canonical representation and remains mandatory with or without Web Crypto.

## Why an HTTP route

The source palette is a host filesystem artifact while `ThemeRuntime` lives in
the browser. The existing DSH Web server already owns the browser origin, so a
small exact GET/HEAD route keeps localhost and reverse-proxied/Tailscale Web
sessions on the same origin without adding a second daemon, port, CORS policy,
or DSH business-RPC method.
