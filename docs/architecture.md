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
  Web Crypto SHA-256 == revision
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

The builder requires that exact first import, rejects additional imports, strips
the known ESM declarations, wraps the combined local source in the DSH factory
handoff, and rejects a generated artifact containing `require()`. The artifact
test executes `lib/client.js` in a fresh VM and materializes its factory with a
`require` function that throws if called.

The Web boot graph carries package ids, bundle URLs/revisions, dependency edges,
and the immediate-prefetch bit. It does not serialize Host Loader-row config
into the browser fiber. The three cross-face values are therefore package
contract, not configuration:

```text
route   /dsh-matugen/palette
poll    1000 ms
source  dsh-matugen
```

## rc.6 compatibility evidence

CI has a separate exact `@deepseek-ai/dsh@0.1.0-rc.6` seam job. It:

1. mounts the actual rc.6 `@deepseek-ai/dsh-host-webserver` on an ephemeral loopback port;
2. mounts the dsh-matugen Host route and performs a real HTTP request;
3. verifies the installed rc.6 theme package version;
4. verifies its published `ThemeRuntime.overrideTokens(source, ThemeTokenOverrides): () => void` declaration and `{ light, dark }` mode contract;
5. verifies the rc.6 theme client export itself is a DSH lazy `window.__ModuleLoader__.load` artifact.

The last browser integration boundary remains physical dogfood: a full DSH Web
boot with this package composed, followed by a real DMS palette change and
plugin unload/reload. CI does not claim that evidence until it exists.
