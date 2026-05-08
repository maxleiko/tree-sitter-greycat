#include "tree_sitter/parser.h"

#include <wctype.h>

// Order MUST match the `externals` array in grammar.js — tree-sitter
// indexes `valid_symbols` by this enum.
enum TokenType {
    STRING_FRAGMENT,
    NUMBER_SUFFIX,
};

void *tree_sitter_greycat_external_scanner_create() { return NULL; }

void tree_sitter_greycat_external_scanner_destroy(UNUSED void *p) {}

void tree_sitter_greycat_external_scanner_reset(UNUSED void *p) {}

unsigned tree_sitter_greycat_external_scanner_serialize(UNUSED void *p, UNUSED char *buffer) { return 0; }

void tree_sitter_greycat_external_scanner_deserialize(UNUSED void *p, UNUSED const char *b, UNUSED unsigned n) {}

static void advance(TSLexer *lexer) { lexer->advance(lexer, false); }

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
        return scan_string_fragment(lexer);
    }

    return false;
}
