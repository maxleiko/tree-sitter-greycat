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
  externals: ($) => [$._string_fragment],

  word: ($) => $.ident,

  extras: ($) => [/\s/, $.line_comment, $._block_comment],

  conflicts: ($) => [[$.type_ident], [$._expr, $.type_ident]],

  rules: {
    module: ($) =>
      repeat(
        choice($.modvar, $.fn_decl, $.type_decl, $.enum_decl, $.mod_pragma)
      ),

    mod_pragma: ($) => seq($.annotation, $._semi),

    modifiers: () =>
      repeat1(choice("private", "static", "abstract", "native")),

    type_decl: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "type",
        field("name", $.ident),
        field("params", optional($.type_params)),
        field("supertype", optional(seq("extends", $.type_ident))),
        field("body", $.type_body)
      ),

    type_params: ($) => seq("<", sepBy1(",", $.ident), ">"),
    type_body: ($) => seq("{", repeat(choice($.type_attr, $.type_method)), "}"),

    type_attr: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        field("name", $.ident),
        field("type", optional($.attr_type)),
        field("init", optional($.attr_init)),
        $._semi
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
        choice(field("body", $.block), $._semi)
      ),

    enum_decl: ($) =>
      seq(
        optional($.doc),
        optional($.annotations),
        field("modifiers", optional($.modifiers)),
        "enum",
        field("name", $.ident),
        field("body", $.enum_body)
      ),

    enum_body: ($) => seq("{", sepBy($._semi, $.enum_field), "}"),
    enum_field: ($) => seq($.ident, optional(seq("(", $._expr, ")"))),

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
        choice(field("body", $.block), $._semi)
      ),

    modvar: ($) =>
      seq(
        "var",
        field("name", $.ident),
        ":",
        field("type", $.type_ident),
        $._semi
      ),

    type_decorator: ($) => seq(":", field("type", $.type_ident)),

    fn_params: ($) => seq("(", sepBy(",", field("param", $.fn_param)), ")"),

    fn_param: ($) =>
      seq(
        field("name", $.ident),
        ":",
        optional("typeof"),
        field("type", $.type_ident)
      ),

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
        $.try_stmt,
        $.at_stmt,
        $.while_stmt,
        $.do_while_stmt,
        $.if_stmt,
        $.for_stmt,
        $.for_in_stmt
      ),

    var_decl: ($) =>
      seq(
        "var",
        field("name", $.ident),
        optional($.type_decorator),
        optional($.initializer),
        $._semi
      ),

    initializer: ($) => seq("=", field("expr", $._expr)),

    return_stmt: ($) => seq("return", optional($._expr), $._semi),

    throw_stmt: ($) => seq("throw", $._expr, $._semi),

    break_stmt: ($) => seq("break", $._semi),

    continue_stmt: ($) => seq("continue", $._semi),

    expr_stmt: ($) => seq($._expr, $._semi),

    try_stmt: ($) =>
      seq(
        "try",
        field("try_block", $.block),
        "catch",
        field("error_param", optional($._catch_param)),
        field("catch_block", $.block)
      ),

    _catch_param: ($) => seq("(", $.ident, ")"),

    at_stmt: ($) =>
      seq("at", "(", field("expr", $._expr), ")", field("block", $.block)),

    while_stmt: ($) =>
      seq(
        "while",
        "(",
        field("condition", $._expr),
        ")",
        field("block", $.block)
      ),

    do_while_stmt: ($) =>
      seq(
        "do",
        field("block", $.block),
        "while",
        "(",
        field("condition", $._expr),
        ")",
        $._semi
      ),

    if_stmt: ($) =>
      seq(
        "if",
        "(",
        field("condition", $._expr),
        ")",
        field("then_branch", $.block),
        field("else_branch", optional($._else_branch))
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
          field("it_value", $._expr)
        ),
        $._semi,
        field("it_condition", $._expr),
        $._semi,
        field("it_increment", $._expr),
        ")",
        field("block", $.block)
      ),

    for_in_stmt: ($) =>
      seq(
        "for",
        "(",
        sepBy2(",", $.for_in_param),
        "in",
        field("iterator", $._expr),
        field("range", optional($.iterator_range)),
        optional($.optional),
        field("sampling", optional(seq("sampling", $._expr))),
        field("limit", optional(seq("limit", $._expr))),
        field("skip", optional(seq("skip", $._expr))),
        ")",
        field("block", $.block)
      ),

    for_in_param: ($) =>
      seq(
        field("name", $.ident),
        optional(seq(":", field("type", $.type_ident)))
      ),

    iterator_range: ($) =>
      seq(
        choice("]", "["),
        field("from", optional($._expr)),
        "..",
        field("to", optional($._expr)),
        choice("]", "[")
      ),

    annotations: ($) => repeat1($.annotation),

    annotation: ($) => seq("@", $.ident, optional($.args)),

    // Expressions
    _expr: ($) =>
      choice(
        $.unary_expr,
        $.binary_expr,
        $.tuple_expr,
        $.paren_expr,
        $.object_expr,
        $.array_expr,
        $.call_expr,
        $.offset_expr,
        $.lambda_expr,
        prec.right($.member_expr),
        prec.right($.arrow_expr),
        prec.right($.static_expr),
        $.string,
        $.duration,
        $.number,
        $.char,
        $.true,
        $.false,
        $.null,
        $.this,
        $.ident
      ),

    paren_expr: ($) => seq("(", field("expr", $._expr), ")"),
    tuple_expr: ($) =>
      seq("(", field("left", $._expr), ",", field("right", $._expr), ")"),

    object_expr: ($) =>
      seq(
        field("type", $.type_ident),
        choice($.object_initializers, $.object_fields)
      ),

    object_initializers: ($) => prec(2, seq("{", sepBy(",", $._expr), "}")),

    object_fields: ($) => seq("{", sepBy(",", $.object_field), "}"),

    object_field: ($) =>
      seq(field("name", $._expr), ":", field("value", $._expr)),

    ident_or_strlit: ($) => choice($.ident, $.string),

    array_expr: ($) => seq("[", sepBy(",", $._expr), "]"),

    call_expr: ($) =>
      seq(
        field(
          "fn",
          choice($.ident, $.member_expr, $.arrow_expr, $.static_expr)
        ),
        prec.left($.args)
      ),

    lambda_expr: ($) =>
      seq("fn", field("params", $.fn_params), field("body", $.block)),

    offset_expr: ($) =>
      prec.right(
        seq(
          $._expr,
          optional($.optional),
          "[",
          $._expr,
          "]",
          optional($.optional)
        )
      ),

    member_expr: ($) =>
      prec.right(
        seq(
          $._expr,
          optional($.optional),
          ".",
          field("property", $.ident),
          optional($.optional)
        )
      ),
    arrow_expr: ($) =>
      prec.right(
        seq(
          $._expr,
          optional($.optional),
          "->",
          field("property", $.ident),
          optional($.optional)
        )
      ),
    static_expr: ($) =>
      prec.right(
        seq(
          choice(prec.right($.static_expr), prec.right($.type_ident)),
          "::",
          field("property", $.ident)
        )
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
            seq("++", $._expr)
          )
        ),
        prec(
          11,
          choice(seq($._expr, "--"), seq($._expr, "++"), seq($._expr, "!!"))
        )
      ),

    binary_expr: ($) =>
      choice(
        prec.left(
          10,
          seq(field("left", $._expr), "^", field("right", $._expr))
        ),
        prec.left(9, seq(field("left", $._expr), "/", field("right", $._expr))),
        prec.left(9, seq(field("left", $._expr), "*", field("right", $._expr))),
        prec.left(9, seq(field("left", $._expr), "%", field("right", $._expr))),
        prec.left(8, seq(field("left", $._expr), "+", field("right", $._expr))),
        prec.left(8, seq(field("left", $._expr), "-", field("right", $._expr))),
        prec.left(7, seq(field("left", $._expr), ">", field("right", $._expr))),
        prec.left(
          7,
          seq(field("left", $._expr), ">=", field("right", $._expr))
        ),
        prec.left(7, seq(field("left", $._expr), "<", field("right", $._expr))),
        prec.left(
          7,
          seq(field("left", $._expr), "<=", field("right", $._expr))
        ),
        prec.left(
          6,
          seq(field("left", $._expr), "==", field("right", $._expr))
        ),
        prec.left(
          6,
          seq(field("left", $._expr), "!=", field("right", $._expr))
        ),
        prec.left(
          5,
          seq(field("left", $._expr), "as", field("right", $.type_ident))
        ),
        prec.left(
          5,
          seq(field("left", $._expr), "is", field("right", $.type_ident))
        ),
        prec.left(
          4,
          seq(field("left", $._expr), "&&", field("right", $._expr))
        ),
        prec.left(
          3,
          seq(field("left", $._expr), "||", field("right", $._expr))
        ),
        prec.left(
          3,
          seq(field("left", $._expr), "??", field("right", $._expr))
        ),
        prec.left(2, seq(field("left", $._expr), "=", field("right", $._expr))),
        prec.left(2, seq(field("left", $._expr), "?=", field("right", $._expr)))
      ),

    type_ident: ($) =>
      seq(
        field("name", $.ident),
        optional(seq("<", sepBy1(",", field("params", $.type_ident)), ">")),
        optional($.optional)
      ),

    string: ($) =>
      seq(
        '"',
        repeat(
          choice(
            $.string_substitution,
            alias($._string_fragment, $.string_fragment),
            $.string_escape_sequence
          )
        ),
        '"'
      ),

    string_escape_sequence: (_) =>
      token.immediate(
        seq(
          "\\",
          choice(/[^xu0-7]/, /[0-7]{1,3}/, /x[0-9a-fA-F]{2}/, /u[0-9a-fA-F]{4}/)
        )
      ),
    string_substitution: ($) => seq("${", $._expr, "}"),

    ident: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    _semi: ($) => seq(";", repeat($.extra_semi)),
    extra_semi: () => ";",

    time: () =>
      token(
        seq(
          "'",

          "'"
        )
      ),

    char: ($) =>
      seq(
        "'",
        optional(
          choice(
            seq("\\", choice(/[^xu]/, /u[0-9a-fA-F]{4}/, /x[0-9a-fA-F]{2}/)),
            $.iso8601,
            /[^\\']/
          )
        ),
        "'"
      ),

    iso8601: () =>
      /[0-9]{4}(-[0-9]{2}(-[0-9]{2}(T[0-9]{2}(:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?)?(Z|[+-][0-9]{2}(:[0-9]{2})?)?)?)?)?/,

    number: ($) =>
      prec.right(
        seq(
          /[0-9][0-9_]*/,
          optional($._number_decimal),
          optional($._number_scientific),
          optional($.number_suffix)
        )
      ),
    _number_decimal: () => seq(".", /[0-9][0-9_]*/),
    _number_scientific: ($) =>
      prec.right(
        seq(
          choice("e", "E"),
          optional(choice("-", "+")),
          /[0-9][0-9_]*/,
          optional($._number_decimal)
        )
      ),
    number_suffix: (_) => /[a-z_A-Z]+/,
    duration: (_) =>
      token(
        repeat1(/(([0-9][_0-9]*(\.[0-9][_0-9]*)?)(us|ms|s|min|hour|day))[_]*/)
      ),

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
