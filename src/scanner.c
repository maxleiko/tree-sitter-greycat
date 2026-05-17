#include "tree_sitter/parser.h"

#include <wctype.h>

// Order MUST match the `externals` array in grammar.js — tree-sitter
// indexes `valid_symbols` by this enum.
enum TokenType {
    STRING_FRAGMENT,
    NUMBER_SUFFIX,
    AUTOMATIC_SEMICOLON,
};

void *tree_sitter_greycat_external_scanner_create() { return NULL; }

void tree_sitter_greycat_external_scanner_destroy(UNUSED void *p) {}

void tree_sitter_greycat_external_scanner_reset(UNUSED void *p) {}

unsigned tree_sitter_greycat_external_scanner_serialize(UNUSED void *p, UNUSED char *buffer) { return 0; }

void tree_sitter_greycat_external_scanner_deserialize(UNUSED void *p, UNUSED const char *b, UNUSED unsigned n) {}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }
static void skip(TSLexer *lexer) { lexer->advance(lexer, true); }

// POC for experiment (c): walk forward across horizontal whitespace
// looking for a real line break / `}` / EOF. If found, emit a
// zero-width `AUTOMATIC_SEMICOLON` token. Only invoked when the
// parser is in a state where the current statement is grammatically
// closable (`_semi` is in `valid_symbols`), so it cannot fire
// mid-expression where `;` would itself be invalid.
//
// Pattern mirrors tree-sitter-javascript / tree-sitter-go: scanner
// runs BEFORE the standard extras pass, so `lexer->lookahead` is the
// raw next char. `skip()` advances the position without contributing
// to the emitted token's text — ASI nodes are zero-width in the CST.
//
// Continuation suppression: after spotting a newline, the scanner
// peeks at the next non-whitespace char. If it's an operator that
// continues the prior expression (`.`, `?`, `[`, `(`, `+`, `-`, `*`,
// `/`, `%`, `^`, `<`, `>`, `=`, `!`, `&`, `|`), ASI is NOT emitted —
// the user line-broke mid-chain (e.g. `var x = obj\n  .method()`).
// Letters/digits/`{` start a new stmt, so ASI fires. The `}` and EOF
// cases short-circuit without continuation suppression (you can't
// continue an expression past a brace or EOF).
//
// Known limitation: line-breaks BEFORE keyword binary operators
// (`as`, `is`) will incorrectly trigger ASI because they look like
// new-stmt starts. Mitigation is same-line usage or explicit `;`.
static bool is_continuation_char(int32_t c) {
    switch (c) {
        case '.':
        case '?':
        case '[':
        case '(':
        case '+':
        case '-':
        case '*':
        case '/':
        case '%':
        case '^':
        case '<':
        case '>':
        case '=':
        case '!':
        case '&':
        case '|':
        case ',':
            return true;
        default:
            return false;
    }
}

static bool scan_automatic_semicolon(TSLexer *lexer) {
    lexer->result_symbol = AUTOMATIC_SEMICOLON;
    bool saw_newline = false;
    for (;;) {
        switch (lexer->lookahead) {
            case ' ':
            case '\t':
            case '\r':
                skip(lexer);
                break;
            case '\n':
                skip(lexer);
                saw_newline = true;
                break;
            default:
                if (!saw_newline) {
                    return false;
                }
                if (lexer->lookahead == '\0' || lexer->lookahead == '}') {
                    lexer->mark_end(lexer);
                    return true;
                }
                if (is_continuation_char(lexer->lookahead)) {
                    return false;
                }
                lexer->mark_end(lexer);
                return true;
        }
    }
}

static bool scan_string_fragment(TSLexer *lexer) {
    lexer->result_symbol = STRING_FRAGMENT;
    for (bool has_content = false;; has_content = true) {
        lexer->mark_end(lexer);
        switch (lexer->lookahead) {
            case '"':
                return has_content;
            case '\0':
                return false;
            case '$':
                advance(lexer);
                if (lexer->lookahead == '{') {
                    return has_content;
                }
                break;
            case '\\':
                return has_content;
            default:
                advance(lexer);
        }
    }
}

// `number_suffix` greedily consumes a letter / underscore cluster
// directly after a number value (or after the previous letter cluster
// in a compound chain like `2hour_42ms`). The scanner is only called
// when the parser is inside `number_suffixed` expecting a suffix — so
// `ident` is not a competing candidate at this position, even though
// its regex would match a longer span. Compound durations work because
// after the suffix consumes letters, the next char is a digit, the
// scanner stops, and the parser shifts to expecting another value
// (number_int / number_decimal / number_scientific) which the internal
// lexer then handles.
//
// Whitespace handling: tree-sitter consumes `extras` (whitespace,
// comments) before invoking the external scanner. To enforce the
// "suffix must hug the value" semantics (so `42 time` doesn't parse as
// suffixed), we'd need to detect whether extras were consumed. The
// current implementation does not — `42 time` will parse as suffixed.
// If that turns out to bite, switch to a stateful scanner that tracks
// the previous token's end column.
static bool scan_number_suffix(TSLexer *lexer) {
    if (!iswalpha(lexer->lookahead) && lexer->lookahead != '_') {
        return false;
    }
    while (iswalpha(lexer->lookahead) || lexer->lookahead == '_') {
        advance(lexer);
    }
    lexer->mark_end(lexer);
    lexer->result_symbol = NUMBER_SUFFIX;
    return true;
}

bool tree_sitter_greycat_external_scanner_scan(UNUSED void *payload, TSLexer *lexer, const bool *valid_symbols) {
    if (valid_symbols[NUMBER_SUFFIX]) {
        if (scan_number_suffix(lexer)) {
            return true;
        }
    }
    if (valid_symbols[STRING_FRAGMENT]) {
        if (scan_string_fragment(lexer)) {
            return true;
        }
    }
    if (valid_symbols[AUTOMATIC_SEMICOLON]) {
        if (scan_automatic_semicolon(lexer)) {
            return true;
        }
    }

    return false;
}
