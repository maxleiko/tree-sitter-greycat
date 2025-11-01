; allow `${ ... }` inside strings to be parsed as GreyCat expressions
(string_substitution (_expr) @injection.content
 (#set! injection.language "greycat"))
