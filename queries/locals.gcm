; function parameters introduce locals
(fn_param name: (ident) @local.definition)

; variable declarations
(var_decl name: (ident) @local.definition)

; blocks define scopes
(block) @local.scope
(fn_decl body: (_) @local.scope)
(type_method body: (_) @local.scope)
