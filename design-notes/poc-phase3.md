# PoC Phase 3 — Specification of a Working Blog SPA Implementation

English · [日本語](./poc-phase3.ja.md)

## Goal

Running `kumiki build` with `examples/apps/03-blog/app.kumiki` as input, opening the result in the browser makes the following work:

- `/` → redirect → `/posts` (the post list)
- Clicking a post card → `/posts/:id` (post detail, Markdown rendering)
- `/about` shows the About page
- Unknown paths go to `/404`
- Back/forward buttons follow history too
- The `link` element does not do a full reload
- The "Edit" link redirects to `/login` (with a fake auth)
- HTTP fetches come from a mock backend (static JSON)

In addition to the language + runtime implemented in Phase 2, add **routing** and **HTTP**.

## Support Scope (Phase 3 additions)

| Covered | Details |
|---|---|
| `route` slot | The runtime automatically manages `{path, pattern, params, query, hash}` |
| Route matching | Parameter extraction such as `/posts/:id`, the `/404` fallback, static redirect `->>` |
| `link(to=...)` element | Emits an `<a>` with `href=path` and fires a navigate effect on click |
| `navigate` effect | `nav.push` / `nav.replace` / `nav.back` capability |
| `route.enter(pattern)` reducer | On route entry |
| `route.leave(pattern)` reducer | On route exit |
| `error-boundary` tile attribute | parse + acceptance (runtime behavior is minimal in Phase 3) |
| `app.http` configuration | base-url, headers (slot references allowed), on-401 |
| `http.get` / `http.post` / `http.put` / `http.delete` | Implemented with fetch(), builds URL/body via `map-request`, decodes types via `Decoder.Json` |
| `app.http-401` lifecycle | A reducer for when a 401 is received |
| Standard effects: `toast`, `navigate`, `navigate-replace`, `navigate-back` | Auto-registered |
| Standard tiles: `link`, `markdown` | Added |

**Not handled** in Phase 3:
- SSR / Edge
- Full theme reflection
- i18n
- A11y checks
- WebSocket / SSE
- IndexedDB
- Advanced optimistic-update machinery (optimistic state retention / rollback)
- The entire authentication flow (after submitting the login form, it stops at a mock 401)

## Acceptance Criteria (AC)

### AC-Parse

The following in examples/apps/03-blog/app.kumiki parse successfully:
- The static redirect `"/" ->> "/posts"` inside `routes`
- The `error-boundary = ErrorFallback` tile attribute
- `app.http = { base-url: ..., headers: ..., on-401: doLogout, timeout: 10s }` (the parser accepts the values, and typecheck permits them loosely)
- `app.meta = {...}` (same as above)

### AC-Typecheck

examples/apps/03-blog/app.kumiki passes with **errors=0**.

### AC-Routing

- The initial display accesses `/` → is redirected and the `/posts` PostList renders
- Accessing `/about` via a link → About is shown
- The `:id` of `/posts/:id` can be obtained via `$route.params["id"]`
- The `route.enter("/posts/:id/edit")` reducer fires on that route (recorded in a slot for testing)
- Back/forward buttons also respond (in jsdom, `history.back()` is simulated)

### AC-HTTP

- On initialization (`app.start`), `loadSession()` and `fetchIndex()` are emitted and reach storage / http respectively
- Fetching the mock backend's `/api/posts` → `Loaded([id1, id2, ...])` goes into postIndex
- Fetching each post's `/api/posts/:id` → `Loaded(Post)` goes into posts[id]
- Hitting a URL that returns 401 calls the `doLogout` reducer

### AC-E2E

- `test/blog.e2e.test.ts`: with fetch mocked, verify the above routing + HTTP flow in jsdom

### AC-Browser

Opening the result of `pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build examples/apps/03-blog/app.kumiki out/blog` in the browser, with the mock JSON bundled, posts → detail → about → 404 cycles.

## Mock Backend Strategy

We do not stand up a real backend. Instead, place static JSON under `out/blog/api/` and have the current `benchmarks/scripts/serve.mjs` serve it as-is.

```
out/blog/
├── index.html
├── app.js
├── runtime.js
└── api/
    ├── posts                  ← /api/posts (the list, returns List<PostId>)
    ├── posts/<id>             ← /api/posts/:id (returns a Post)
    └── auth/login             ← /api/auth/login (returns 401)
```

Extend `benchmarks/scripts/serve.mjs` so that placing JSON without an extension at the end of the URL path is enough.

Set `app.http.base-url` to `""` (same origin) and use relative paths such as `/api/posts`.

The `base-url: "https://api.example.com"` in examples/apps/03-blog/app.kumiki is handled by commenting it out or overwriting it with an empty string at build time, or by **editing app.kumiki**.

## Implementation Order

| step | Content | Validation |
|---|---|---|
| 1 | Parser/Typecheck: additional app fields and tile attributes | parser tests pass |
| 2 | Codegen: glue for routing and http | snapshot test |
| 3 | Runtime: history + route matching + route slot | router unit test |
| 4 | Runtime: http effect dispatcher | http unit test |
| 5 | Runtime: link / markdown / toast / spinner | runtime test |
| 6 | Mock backend (static JSON) | benchmarks/scripts/serve.mjs extension |
| 7 | Blog SPA build + E2E | jsdom fetch mock |
| 8 | Manual browser check | Screenshots |

## Design Decisions

| Decision | Reason |
|---|---|
| http is entirely fetch()-based | No need to add a polyfill in Phase 2, and jsdom supports it |
| The route slot is automatically managed by the runtime | The app side only reads it |
| link is `<a>` output + preventDefault | For a11y and middle-button support |
| error-boundary is acceptance only | Runtime panic capture is detailed in v0.2 |
| markdown is a minimal implementation (1 paragraph = 1 newline, no link conversion) | A full implementation would depend on a library |
| The mock is static JSON | Avoid adding another server to start |
| The Decoder is actually ignored (always JSON parse) | Looser than the spec |

## Definition of Done

- All AC pass
- The Blog SPA build has errors=0
- The jsdom E2E (list → detail → 404 → back) passes
- Manual browser check is OK
