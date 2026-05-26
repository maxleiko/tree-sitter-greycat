# tree-sitter-greycat

Tree-sitter grammar for the **GreyCat language** (`.gcl`). Produces a parser
used by editors / LSPs / syntax-highlighters to understand GreyCat source.

## Layout

- [grammar.js](grammar.js) — the source of truth. Edit this, then regenerate.
- [src/scanner.c](src/scanner.c) — external scanner for `_string_fragment`
  (only token currently scanned externally).
- [src/grammar.json](src/grammar.json), [src/parser.c](src/parser.c),
  [src/node-types.json](src/node-types.json) — generated. Do not hand-edit;
  regenerate via `npx tree-sitter generate`.
- [queries/](queries/) — `highlights.scm`, `folds.scm`, `indents.scm`,
  `locals.scm`. Update when renaming nodes/fields in `grammar.js`.
- [project.gcl](project.gcl) — a scratch GreyCat snippet used to smoke-test
  the grammar against real source. Parse it with `npx tree-sitter parse
  project.gcl` to spot regressions; the file is intentionally small and may
  contain whatever the current bug-of-the-day is.
- [bindings/](bindings/) — node / rust / c bindings (boilerplate).
- `tree-sitter-greycat.wasm`, `greycat.so` — prebuilt artifacts; rebuilt by
  `npm run prestart` and `make` respectively.

## Workflow for grammar changes

1. Edit [grammar.js](grammar.js).
2. Regenerate: `npx tree-sitter generate` (rewrites `src/grammar.json`,
   `src/parser.c`, `src/node-types.json`).
3. Verify: `npx tree-sitter parse project.gcl` — should print a tree with no
   `(ERROR ...)` node. Also try any larger `.gcl` corpus you have around.
4. If queries reference renamed nodes/fields, update files under
   [queries/](queries/).
5. Run `npm test` if relevant bindings tests exist.

## Source of truth for "is this valid GreyCat?"

If you're unsure whether a construct should parse:

1. Ask the `greycat` skill or check
   `/home/leiko/.claude/plugins/cache/datathings/greycat/*/skills/greycat/`.
2. Run `greycat-analyzer lint -p <file>` — if lint accepts a snippet, the
   tree-sitter grammar must accept it too (no `ERROR` nodes). The formatter
   reshaping the code is fine; producing an `ERROR` node is not.
3. Run `greycat-analyzer fmt --check <file>` to see how the official formatter
   would reshape it (informational — formatter rewrites are not grammar
   errors).

## Things to keep in mind

- `extras` includes `\s`, `line_comment`, `_block_comment` — these are
  skipped between tokens. `doc_comment` (`///...`) is **not** in `extras`;
  it's a real node attached via `optional($.doc)` on declarations. Any
  declaration that can carry documentation must list `optional($.doc)`
  explicitly. (Historic gotcha: `mod_pragma`, `type_decl`, and `modvar`
  used to omit it, causing valid annotated/documented top-level forms to
  parse as `ERROR`.)
- `word: $.ident` — keyword tokens (`type`, `fn`, `var`, ...) are matched
  against the ident regex first, so adding new keywords means adding them
  to the appropriate rules, not as separate tokens.
- The external scanner is intentionally tiny — only `_string_fragment`. Try
  to keep new lexing in the JS grammar unless there's a real reason to push
  to `scanner.c`.
- After any rule rename, search [queries/](queries/) for the old name; the
  query compiler will silently match nothing on stale references.
