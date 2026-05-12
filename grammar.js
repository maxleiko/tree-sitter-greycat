/**
 * @file GreyCat Language Parser
 * @author Maxime Tricoire <maxime.tricoire@datathings.com>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "greycat",

  // see src/scanner.c for those
  externals: ($) => [$._string_fragment, $.number_suffix],

  word: ($) => $.ident,

  extras: ($) => [/\s/, $.line_comment, $._block_comment],

  conflicts: ($) => [
    [$.type_ident],
    [$._expr, $.type_ident],
    // P19.12 — `]..]` (interval with closing `]`) followed by
    // `..` — the closing `]` could either close the interval or
    // start another one. Real source never chains intervals
    // (`]a..]..]b..]` is meaningless) so let GLR eagerly close
    // the first interval at `]`.
    [$.interval_expr],
  ],

  rules: {
    module: ($) => repeat(choice($.modvar, $.fn_decl, $.type_decl, $.enum_decl, $.mod_pragma)),

    mod_pragma: ($) => seq(optional($.doc), $.annotation, $._semi),

    modifiers: () => repeat1(choice("private", "static", "abstract", "native")),

    type_decl: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "type",
        field("name", $.ident),
        field("params", optional($.type_params)),
        // P19.14 — `field("supertype", ...)` tags the inner
        // `type_ident` directly (not the surrounding `seq("extends",
        // type_ident)`), so `child_by_field_name("supertype")` in
        // the HIR lowering returns the type node, not the
        // "extends" keyword. The HIR's `lower_type_ref` expects a
        // `type_ident` here.
        optional(seq("extends", field("supertype", $.type_ident))),
        field("body", $.type_body),
      ),

    type_params: ($) => seq("<", sepBy1(",", $.ident), ">"),
    type_body: ($) => seq("{", repeat(choice($.type_attr, $.type_method)), "}"),

    type_attr: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        field("name", choice($.ident, $.string)),
        field("type", optional($.attr_type)),
        field("init", optional($.attr_init)),
        // Trailing semicolon is optional so a final attr without `;`
        // before the closing `}` parses cleanly. Drains the last
        // entry from `KNOWN_GRAMMAR_GAPS` (P7.1).
        optional($._semi),
      ),
    attr_type: ($) => seq(":", $.type_ident),
    attr_init: ($) => seq("=", $._expr),

    type_method: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "fn",
        field("name", $.ident),
        field("generics", optional($.type_params)),
        field("params", $.fn_params),
        optional(seq(":", field("return_type", $.type_ident))),
        choice(
          // Permissive: a trailing `;` after a method body is invalid
          // GreyCat (the runtime rejects it) but a common copy-paste
          // habit from JS/TS. Accept it at the grammar layer so a stray
          // `};` doesn't open an `(ERROR)` recovery span that swallows
          // the rest of the type. The analyzer's `redundant-semicolon`
          // lint flags `block_trailing_semi` nodes with a quickfix
          // that removes the offending `;`.
          seq(field("body", $.block), optional($.block_trailing_semi)),
          $._semi,
        ),
      ),

    enum_decl: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "enum",
        field("name", $.ident),
        field("body", $.enum_body),
      ),

    enum_body: ($) => seq("{", sepBy(choice($._semi, ","), $.enum_field), "}"),
    enum_field: ($) => seq(choice($.ident, $.string), optional(seq("(", $._expr, ")"))),

    fn_decl: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "fn",
        field("name", $.ident),
        field("generics", optional($.type_params)),
        field("params", $.fn_params),
        optional(seq(":", field("return_type", $.type_ident))),
        choice(
          // See `type_method` — same permissive `block_trailing_semi`
          // shape so a stray `};` after a top-level fn body doesn't
          // cascade. Flagged by the `redundant-semicolon` analyzer lint.
          seq(field("body", $.block), optional($.block_trailing_semi)),
          $._semi,
        ),
      ),

    modvar: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "var",
        field("name", $.ident),
        ":",
        field("type", $.type_ident),
        $._semi,
      ),

    type_decorator: ($) => seq(":", field("type", $.type_ident)),

    fn_params: ($) => seq("(", sepBy(",", field("param", $.fn_param)), ")"),

    fn_param: ($) =>
      seq(field("name", $.ident), ":", optional("typeof"), field("type", $.type_ident)),

    args: ($) => seq("(", sepBy(",", $._expr), ")"),

    block: ($) => seq("{", repeat($._stmt), "}"),

    // Block statements
    _stmt: ($) =>
      choice(
        $.return_stmt,
        $.var_decl,
        $.expr_stmt,
        $.throw_stmt,
        $.continue_stmt,
        $.break_stmt,
        $.breakpoint_stmt,
        $.try_stmt,
        $.at_stmt,
        $.while_stmt,
        $.do_while_stmt,
        $.if_stmt,
        $.for_stmt,
        $.for_in_stmt,
      ),

    var_decl: ($) =>
      seq(
        "var",
        field("name", $.ident),
        optional($.type_decorator),
        optional($.initializer),
        $._semi,
      ),

    initializer: ($) => seq("=", field("expr", $._expr)),

    return_stmt: ($) => seq("return", optional($._expr), $._semi),

    throw_stmt: ($) => seq("throw", $._expr, $._semi),

    break_stmt: ($) => seq("break", $._semi),

    continue_stmt: ($) => seq("continue", $._semi),

    // `breakpoint;` pauses the GreyCat worker for debugging. Not a
    // control-flow terminator — execution resumes from the next stmt
    // after the debugger detaches — and not loop-scoped (valid anywhere
    // a statement is). Shape mirrors break/continue.
    breakpoint_stmt: ($) => seq("breakpoint", $._semi),

    expr_stmt: ($) => seq($._expr, $._semi),

    try_stmt: ($) =>
      seq(
        "try",
        field("try_block", $.block),
        "catch",
        // Parens and ident are independently optional so partial states
        // during editing (`catch () { … }`) still parse — analyzer /
        // formatter normalize. `field("error_param", …)` wraps only the
        // `$.ident` so the field tag does not smear over the parens (a
        // hidden-rule inlining hazard with tree-sitter's field semantics).
        optional(seq("(", optional(field("error_param", $.ident)), ")")),
        field("catch_block", $.block),
      ),

    at_stmt: ($) => seq("at", "(", field("expr", $._expr), ")", field("block", $.block)),

    while_stmt: ($) => seq("while", "(", field("condition", $._expr), ")", field("block", $.block)),

    do_while_stmt: ($) =>
      seq("do", field("block", $.block), "while", "(", field("condition", $._expr), ")", $._semi),

    if_stmt: ($) =>
      seq(
        "if",
        "(",
        field("condition", $._expr),
        ")",
        field("then_branch", $.block),
        field("else_branch", optional($._else_branch)),
      ),

    _else_branch: ($) => seq("else", choice($.if_stmt, $.block)),

    for_stmt: ($) =>
      seq(
        "for",
        "(",
        seq(
          "var",
          field("it_name", $.ident),
          field("it_type", optional(seq(":", $.type_ident))),
          "=",
          field("it_value", $._expr),
        ),
        $._semi,
        field("it_condition", $._expr),
        $._semi,
        field("it_increment", $._expr),
        ")",
        field("block", $.block),
      ),

    for_in_stmt: ($) =>
      seq(
        "for",
        "(",
        sepBy2(",", $.for_in_param),
        "in",
        field("iterator", $._expr),
        optional($.optional),
        // P19.12 — math-style range clause AFTER the iterator,
        // used for half-open / open intervals where the bracket
        // shape encodes inclusivity (`]a..]`, `]a..b[`, ...).
        // Bracketless ranges (`arr[from..to]` / `arr[from..]`)
        // already parse as `offset_expr` containing a
        // `range_expr`, so they don't go through this field.
        field("range", optional($.interval_expr)),
        field("sampling", optional(seq("sampling", $._expr))),
        field("limit", optional(seq("limit", $._expr))),
        field("skip", optional(seq("skip", $._expr))),
        ")",
        field("block", $.block),
      ),

    for_in_param: ($) =>
      seq(field("name", $.ident), optional(seq(":", field("type", $.type_ident)))),

    annotations: ($) => repeat1($.annotation),

    annotation: ($) => seq("@", $.ident, optional($.args)),

    // Expressions
    _expr: ($) =>
      choice(
        $.unary_expr,
        $.binary_expr,
        $.range_expr,
        $.interval_expr,
        $.tuple_expr,
        $.paren_expr,
        $.object_expr,
        $.array_expr,
        $.call_expr,
        $.offset_expr,
        $.lambda_expr,
        $.member_expr,
        $.arrow_expr,
        $.static_expr,
        $.string,
        $.number,
        $.char,
        $.true,
        $.false,
        $.null,
        $.this,
        $.ident,
      ),

    // P19.12 — `from..to` range as a first-class expression. Covers
    // the canonical `arr[from..to]` / `arr[from..]` / `arr[..to]`
    // slice forms used by `nodeTime` / `nodeList` / `nodeIndex`
    // time-window queries. `..` binds looser than every arithmetic
    // / comparison operator (prec 1) so `arr[a + b .. c - d]`
    // parses as `(a + b) .. (c - d)`. Open-ended ranges drop one
    // endpoint (`arr[startDate..]` is "from startDate to end").
    range_expr: ($) =>
      choice(
        prec.left(1, seq(field("from", $._expr), "..", field("to", $._expr))),
        prec.left(1, seq(field("from", $._expr), "..")),
        prec.left(1, seq("..", field("to", $._expr))),
      ),

    // P19.12 — math-style interval expression with explicit
    // exclusive (`]`) brackets on the open side. Used in
    // iterator-slot ranges where the inclusivity matters:
    // `]from..to]` (exclusive lower, inclusive upper),
    // `]from..to[` (exclusive lower, exclusive upper), etc.
    // Endpoints are optional (`]from..]` is "exclusive lower, open
    // upper"). Open bracket is restricted to `]` (the exclusive
    // marker) — `[from..to]` already parses as
    // `offset_expr` + `range_expr` when wrapped in a receiver, and
    // as `array_expr` containing a `range_expr` when standalone, so
    // there's no syntactic room for `[` here. Distinct from
    // `range_expr` because the bracket markers are *part of* the
    // syntax: they can't be replaced by the surrounding
    // `offset_expr`'s `[` / `]`.
    interval_expr: ($) =>
      prec(
        2,
        seq(
          choice("]", "["),
          field("from", optional($._expr)),
          "..",
          field("to", optional($._expr)),
          choice("]", "["),
        ),
      ),

    paren_expr: ($) => seq("(", field("expr", $._expr), ")"),
    tuple_expr: ($) => seq("(", field("left", $._expr), ",", field("right", $._expr), ")"),

    object_expr: ($) =>
      seq(field("type", $.type_ident), choice($.object_initializers, $.object_fields)),

    object_initializers: ($) => prec(2, seq("{", sepBy(",", $._expr), "}")),

    object_fields: ($) => seq("{", sepBy(",", $.object_field), "}"),

    object_field: ($) => seq(field("name", $._expr), ":", field("value", $._expr)),

    ident_or_strlit: ($) => choice($.ident, $.string),

    array_expr: ($) => seq("[", sepBy(",", $._expr), "]"),

    // Postfix / primary-tail expressions. These must bind TIGHTER than every
    // binary operator (max prec 11 — `??`) and tighter than unary prefix (prec 12),
    // otherwise tree-sitter resolves shift-reduce on the trailing `.`/`[`/`(`
    // by reducing the binary first and re-wrapping its right operand into the
    // postfix — i.e. `o.x * o.y` mis-parses as `(o.x * o).y`. Sitting at 13
    // (above prefix unary at 12) means `-o.b` parses as `-(o.b)`, matching
    // every C-family language and the GreyCat reference.
    call_expr: ($) =>
      prec.right(
        13,
        seq(field("fn", choice($.ident, $.member_expr, $.arrow_expr, $.static_expr)), $.args),
      ),

    lambda_expr: ($) => seq("fn", field("params", $.fn_params), field("body", $.block)),

    offset_expr: ($) =>
      prec.right(
        13,
        seq($._expr, optional($.optional), "[", $._expr, "]", optional($.optional)),
      ),

    member_expr: ($) =>
      prec.right(
        13,
        seq(
          $._expr,
          optional($.optional),
          ".",
          field("property", choice($.ident, $.string)),
          optional($.optional),
        ),
      ),
    arrow_expr: ($) =>
      prec.right(
        13,
        seq(
          $._expr,
          optional($.optional),
          "->",
          field("property", choice($.ident, $.string)),
          optional($.optional),
        ),
      ),
    static_expr: ($) =>
      prec.right(
        13,
        seq(
          choice($.static_expr, $.type_ident),
          "::",
          field("property", choice($.ident, $.string)),
        ),
      ),

    unary_expr: ($) =>
      choice(
        prec(
          12,
          choice(
            seq("-", $._expr),
            seq("!", $._expr),
            seq("+", $._expr),
            seq("*", $._expr),
            seq("--", $._expr),
            seq("++", $._expr),
          ),
        ),
        prec(11, choice(seq($._expr, "--"), seq($._expr, "++"), seq($._expr, "!!"))),
      ),

    binary_expr: ($) =>
      choice(
        // `??` is the highest-precedence binary, above `^`. Matches
        // the runtime parser (and the TS reference parser, where
        // `opPrecedence` falls through to `default: 15` for
        // `QuestionQuestion`). User code like
        // `count ?? 0 > 0` and `row < tw.values?.rows() ?? 0` parses
        // as `(count ?? 0) > 0` / `row < (tw.values?.rows() ?? 0)`,
        // which is what the source intends.
        prec.left(11, seq(field("left", $._expr), "??", field("right", $._expr))),
        prec.left(10, seq(field("left", $._expr), "^", field("right", $._expr))),
        prec.left(9, seq(field("left", $._expr), "/", field("right", $._expr))),
        prec.left(9, seq(field("left", $._expr), "*", field("right", $._expr))),
        prec.left(9, seq(field("left", $._expr), "%", field("right", $._expr))),
        prec.left(8, seq(field("left", $._expr), "+", field("right", $._expr))),
        prec.left(8, seq(field("left", $._expr), "-", field("right", $._expr))),
        prec.left(7, seq(field("left", $._expr), ">", field("right", $._expr))),
        prec.left(7, seq(field("left", $._expr), ">=", field("right", $._expr))),
        prec.left(7, seq(field("left", $._expr), "<", field("right", $._expr))),
        prec.left(7, seq(field("left", $._expr), "<=", field("right", $._expr))),
        prec.left(6, seq(field("left", $._expr), "==", field("right", $._expr))),
        prec.left(6, seq(field("left", $._expr), "!=", field("right", $._expr))),
        prec.left(5, seq(field("left", $._expr), "as", field("right", $.type_ident))),
        prec.left(5, seq(field("left", $._expr), "is", field("right", $.type_ident))),
        prec.left(4, seq(field("left", $._expr), "&&", field("right", $._expr))),
        prec.left(3, seq(field("left", $._expr), "||", field("right", $._expr))),
        prec.left(2, seq(field("left", $._expr), "=", field("right", $._expr))),
        prec.left(2, seq(field("left", $._expr), "?=", field("right", $._expr))),
      ),

    type_ident: ($) =>
      seq(
        optional("typeof"),
        repeat(seq($.ident, "::")),
        field("name", $.ident),
        optional(seq("<", sepBy1(",", field("params", $.type_ident)), ">")),
        optional($.optional),
      ),

    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            $.string_substitution,
            alias($._string_fragment, $.string_fragment),
            $.string_escape_sequence,
          ),
        ),
        '"',
      ),

    string_escape_sequence: (_) =>
      token.immediate(
        seq("\\", choice(/[^xu0-7]/, /[0-7]{1,3}/, /x[0-9a-fA-F]{2}/, /u[0-9a-fA-F]{4}/)),
      ),
    string_substitution: ($) => seq("${", $._expr, "}"),

    ident: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    _semi: ($) => seq(";", repeat($.extra_semi)),
    extra_semi: () => ";",
    // Permissive trailing-`;` after a `block` body in `type_method` /
    // `fn_decl`. Captured as a named node so the analyzer's
    // `redundant-semicolon` lint can locate it via a CST walk and
    // emit a structural error keyed to its byte range.
    block_trailing_semi: ($) => $._semi,

    time: () =>
      token(
        seq(
          "'",

          "'",
        ),
      ),

    char: ($) =>
      seq(
        "'",
        optional(
          choice(
            seq("\\", choice(/[^xu]/, /u[0-9a-fA-F]{4}/, /x[0-9a-fA-F]{2}/)),
            $.iso8601,
            /[^\\']/,
          ),
        ),
        "'",
      ),

    iso8601: () =>
      /[0-9]{4}(-[0-9]{2}(-[0-9]{2}(T[0-9]{2}(:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?)?(Z|[+-][0-9]{2}(:[0-9]{2})?)?)?)?)?/,

    // Each notation form is a single `token(...)` so the lexer's
    // longest-match resolves ambiguity at the boundary between the literal
    // and whatever follows. The previous shape kept `number_suffix` as a
    // separate token, which lost its tie-break against `ident` in
    // `attr_init` position: `static x: time = 42_time;` lexed `42_` then
    // `time` as the start of a ghost `type_attr`, dropping the suffix.
    // With every form a single token, the lexer commits to the longest
    // candidate (`number_suffixed` for `42_time`) and the next thing it
    // sees is `;`, no ambiguity. HIR lowering reads `number`'s child kind
    // to distinguish a suffixed literal from a plain one and extracts the
    // suffix (when present) by regex on the literal text.
    number: ($) =>
      choice(
        $.number_int,
        $.number_decimal,
        $.number_scientific,
        $.number_suffixed,
      ),
    number_int: () => /[0-9][0-9_]*/,
    number_decimal: () => token(seq(/[0-9][0-9_]*/, ".", /[0-9][0-9_]*/)),
    number_scientific: () =>
      token(
        seq(
          /[0-9][0-9_]*/,
          optional(seq(".", /[0-9][0-9_]*/)),
          /[eE]/,
          optional(/[+-]/),
          /[0-9][0-9_]*/,
          optional(seq(".", /[0-9][0-9_]*/)),
        ),
      ),
    // `number_suffixed` keeps value-parts and letter-suffixes as
    // separate visible tokens so highlights / theming can color them
    // distinctly. Compound duration-like forms repeat the
    // `(value suffix)` group so each `value` and each `suffix` is its
    // own visible token in the CST: `2hour_42ms` →
    // `(number_int "2") (number_suffix "hour_") (number_int "42") (number_suffix "ms")`.
    // The grammar does NOT enforce which letter sequences are real
    // units or known typed-suffix names — bogus `42xyz` parses fine
    // and the analyzer emits a semantic diagnostic. Subsumes the old
    // `duration` rule.
    number_suffixed: ($) =>
      seq(
        choice($.number_int, $.number_decimal, $.number_scientific),
        $.number_suffix,
        repeat(
          seq(
            choice($.number_int, $.number_decimal, $.number_scientific),
            $.number_suffix,
          ),
        ),
      ),
    // `number_suffix` is scanned by the external C scanner (see
    // `src/scanner.c`). It only fires when the parser is inside
    // `number_suffixed` expecting a suffix — that's the only way to
    // beat the maximal-munch rule that otherwise gives `ident` the win
    // on compound durations like `2hour_42ms` (where `ident` would
    // greedily match `hour_42ms` 9-chars and a letters-only
    // `token.immediate` regex would only match `hour_` 5-chars). The
    // scanner also enforces the immediate (no-whitespace) constraint
    // by rejecting if the previous char wasn't a digit / letter.

    true: (_) => "true",
    false: (_) => "false",
    null: (_) => "null",
    this: (_) => "this",
    optional: (_) => "?",

    doc: ($) => repeat1($.doc_comment),
    doc_comment: (_) => token(seq("///", /.*/)),
    line_comment: (_) => token(seq("//", /.*/)),
    _block_comment: (_) => token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

/**
 * Creates a rule to match two or more of the rules separated by the separator.
 *
 * This rule allows for an extraneous last separator at the end.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function sepBy2(sep, rule) {
  return seq(rule, sep, rule, repeat(seq(sep, rule)), optional(sep));
}

/**
 * Creates a rule to match one or more of the rules separated by the separator.
 *
 * This rule allows for an extraneous last separator at the end.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @return {SeqRule}
 *
 */
function sepBy1(sep, rule) {
  return seq(rule, repeat(seq(sep, rule)), optional(sep));
}

/**
 * Creates a rule to match zero or more of the rules separated by the separator.
 *
 * This rule allows for an extraneous last separator at the end.
 *
 * @param {RuleOrLiteral} sep - The separator to use.
 * @param {RuleOrLiteral} rule
 *
 * @return {ChoiceRule}
 *
 */
function sepBy(sep, rule) {
  return optional(sepBy1(sep, rule));
}
