const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => parser.setLanguage(require(".")));
});

test("hello world", () => {
  const sourceCode = `fn main() { prinln("Hello, world!"); }`;
  const parser = new Parser();
  parser.setLanguage(require("."));
  const tree = parser.parse(sourceCode);

  // Get the root node
  const root = tree.rootNode;
  assert.strictEqual(
    root.toString(),
    "(module (mod_stmt (fn_decl name: (ident) params: (fn_params) body: (block (expr_stmt (call_expr fn: (ident) (args (string (string_fragment)))))))))"
  );
});

test("object creation", () => {
  const sourceCode = `
    fn main() {
      foo(Bar {
        field_0: 42,
        field_1: "Hello, world",
      });
    }`;
  const parser = new Parser();
  parser.setLanguage(require("."));
  const tree = parser.parse(sourceCode);

  // Get the root node
  const root = tree.rootNode;
  assert.strictEqual(
    root.toString(),
    "(module (mod_stmt (fn_decl name: (ident) params: (fn_params) body: (block (expr_stmt (call_expr fn: (ident) (args (object_expr type: (type_ident name: (ident)) (object_fields (object_field name: (ident) value: (number)) (object_field name: (ident) value: (string (string_fragment))))))))))))"
  );
});

/**
 * @param {import("tree-sitter").SyntaxNode} node
 */
function format(node) {
  /**
   * @param {import("tree-sitter").SyntaxNode} node
   * @param {number=} depth
   */
  function walk(node, depth = 0) {
    console.group(node.type);
    // src += node.text;
    for (const child of node.children) {
      walk(child, depth + 1);
    }
    console.groupEnd();
  }

  walk(node);
}

test("format", () => {
  const sourceCode = `
    fn main(/* foo */) {
      foo(Bar {
        field_0: 42, // field 0
        field_1: "Hello, world", // field 1
      });
    }`;
  const parser = new Parser();
  parser.setLanguage(require("."));
  const tree = parser.parse(sourceCode);

  // Get the root node
  const root = tree.rootNode;
  const text = format(root);
  console.log(text);
});
