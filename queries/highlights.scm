;────────────────────────────
; Keywords
;────────────────────────────
[
  "type" "enum" "extends" "fn" "var" "return" "throw"
  "break" "continue" "breakpoint" "if" "else" "for" "in" "while"
  "do" "try" "catch" "at" "as" "is" "sampling" "limit"
  "skip" "typeof" "abstract" "native" "private" "static"
] @keyword

;────────────────────────────
; Comments and documentation
;────────────────────────────
(line_comment) @comment
(block_comment) @comment
(doc_comment) @comment.documentation

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
; Functions & Methods
;────────────────────────────
(fn_decl name: (ident) @function)
(type_method name: (ident) @function.method)
(fn_param name: (ident) @parameter)
(lambda_expr) @function

;────────────────────────────
; Fields and properties
;────────────────────────────
(member_expr
  property: (ident) @variable.member)
(member_expr
  property: (string) @variable.member)
(arrow_expr
  property: (ident) @variable.member)
(arrow_expr
  property: (string) @variable.member)
(static_expr
  property: (ident) @variable.member.static)
(static_expr
  property: (string) @variable.member.static)

;────────────────────────────
; Function Calls
;────────────────────────────
(call_expr
  fn: (ident) @function.call)
(call_expr
  fn: (member_expr
        property: (ident) @function.method.call))
(call_expr
  fn: (arrow_expr
        property: (ident) @function.method.call))
(call_expr
  fn: (static_expr
        property: (ident) @function.static.call))

;────────────────────────────
; Literals
;────────────────────────────
(number_int) @number
(number_decimal) @number.float
(number_scientific) @number.float

; Suffixed literals: color the value parts as numbers and the suffix distinctly
(number_suffixed
  (number_int) @number)
(number_suffixed
  (number_decimal) @number.float)
(number_suffixed
  (number_scientific) @number.float)
(number_suffixed
  (number_suffix) @number.special)

(char) @character
(string) @string
(string_fragment) @string
(string_escape_sequence) @string.escape
(string_substitution) @punctuation.special
(this) @variable.builtin

;────────────────────────────
; Language constants
;────────────────────────────
(null) @constant.builtin
(true) @constant.builtin
(false) @constant.builtin
; Runtime value-position globals — no `.gcl` decl, parse as plain idents.
((ident) @constant.builtin
 (#any-of? @constant.builtin "NaN" "Infinity"))

;────────────────────────────
; Operators
;────────────────────────────
[
  "+" "-" "*" "/" "%" "^"
  "=" "==" "!=" "<" "<=" ">" ">=" "&&" "||" "!"
  "->" "::" "." "," ";" ":" "??"
] @operator

;────────────────────────────
; Punctuation
;────────────────────────────
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
["<" ">"] @punctuation.bracket
["@"] @punctuation.special

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
(breakpoint_stmt "breakpoint" @keyword.control)

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
(modifiers) @keyword.modifier
(annotation "@" @punctuation.special)
(annotation (ident) @attribute)
(annotation (args) @parameter)
(optional) @punctuation.special
