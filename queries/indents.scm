; start indent after opening tokens
["{" "[" "("] @indent.begin

; end indent after closing tokens
["}" "]" ")"] @indent.end

; align multi-line constructs
(fn_params) @indent.align
(argument_list) @indent.align
(type_params) @indent.align

; dedent inside strings and comments
(comment) @indent.dedent
(string) @indent.dedent