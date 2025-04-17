#include "tree_sitter/parser.h"

#include <wctype.h>

enum TokenType {
    STRING_FRAGMENT,
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

bool tree_sitter_greycat_external_scanner_scan(UNUSED void *payload, TSLexer *lexer, const bool *valid_symbols) {
    if (valid_symbols[STRING_FRAGMENT]) {
        return scan_string_fragment(lexer);
    }

    return false;
}
