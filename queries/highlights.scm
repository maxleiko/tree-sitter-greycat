;────────────────────────────
; Keywords
;────────────────────────────
[
  "type" "enum" "extends" "fn" "var" "return" "throw"
  "break" "continue" "if" "else" "for" "in" "while"
  "do" "try" "catch" "at" "as" "is" "sampling" "limit"
  "skip" "typeof" "abstract" "native" "private" "static"
  "true" "false" "null" "this"
] @keyword

;────────────────────────────
; Comments and documentation
;────────────────────────────
(line_comment) @comment
(block_comment) @comment
(doc_comment) @comment.documentation
(doc) @comment.documentation

;────────────────────────────
; Identifiers and types
;────────────────────────────
(ident) @variable
(type_ident name: (ident) @type)
(type_decl name: (ident) @type.definition)
(enum_decl name: (ident) @type.definition)
(enum_field (ident) @constant)
(type_attr name: (ident) @field)

;────────────────────────────
; Function & methods
;────────────────────────────
(fn_decl name: (ident) @function)
(type_method name: (ident) @function.method)
(lambda_expr) @function
(fn_param name: (ident) @parameter)

;────────────────────────────
; Literals
;────────────────────────────
(number) @number
(duration) @number
(char) @character
(string) @string
(string_fragment) @string
(string_escape_sequence) @string.escape
(string_substitution) @punctuation.special

;────────────────────────────
; Operators and punctuation
;────────────────────────────
[
  "+" "-" "*" "/" "%" "^"
  "=" "==" "!=" "<" "<=" ">" ">=" "&&" "||" "!"
  "->" "::" "." "," ";" ":" "?" "??"
] @operator

["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["<" ">"] @punctuation.bracket
["@" "#"] @punctuation.special

;────────────────────────────
; Declarations and modifiers
;────────────────────────────
(type_modifiers) @keyword.modifier
(attr_modifiers) @keyword.modifier
(method_modifiers) @keyword.modifier
(fn_modifiers) @keyword.modifier

;────────────────────────────
; Control flow structures
;────────────────────────────
(if_stmt "if" @keyword.control)
(if_stmt "else" @keyword.control)
(for_stmt "for" @keyword.control)
(for_in_stmt "for" @keyword.control)
(for_in_stmt "in" @keyword.operator)
(while_stmt "while" @keyword.control)
(do_while_stmt "do" @keyword.control)
(do_while_stmt "while" @keyword.control)
(try_stmt "try" @keyword.control)
(try_stmt "catch" @keyword.control)
(at_stmt "at" @keyword.control)
(return_stmt "return" @keyword.control)
(throw_stmt "throw" @keyword.control)
(break_stmt "break" @keyword.control)
(continue_stmt "continue" @keyword.control)

;────────────────────────────
; Object / struct / enum body
;────────────────────────────
(type_body) @structure
(enum_body) @structure
(object_field name: (_) @field)
(object_expr) @constructor
(array_expr) @constructor
(tuple_expr) @constructor

;────────────────────────────
; Misc
;────────────────────────────
(annotation "@" @punctuation.special)
(annotation ident: (ident) @attribute)
(optional) @punctuation.special
