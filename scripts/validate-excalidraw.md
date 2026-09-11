# Validate an Excalidraw file

From the repository root, pass a `.excalidraw` file to the standalone CLI:

```sh
node scripts/validate-excalidraw.mjs path/to/drawing.excalidraw
```

A minimal valid file contains:

```json
{ "type": "excalidraw", "elements": [] }
```

Valid input exits with code `0`.

## Errors

The CLI exits with code `1` in each of these cases:

- No path argument is provided. It prints `Usage: validate-excalidraw.mjs <path-to-file.excalidraw>`.
- The file is missing or cannot be read. It prints `Unable to read "<path>": ...`.
- The file contains malformed JSON. It prints `Malformed JSON in "<path>": ...`.
- The parsed value is not an object with `type` exactly `"excalidraw"`. A wrong or missing `type`, `null`, arrays, and other non-object values are rejected with `Invalid Excalidraw file "<path>": Expected an object with type exactly "excalidraw".`
- `elements` is missing or is not an array. It prints `Invalid Excalidraw file "<path>": Expected "elements" to be an array.`

## Tests

Run the existing tests from the repository root:

```sh
node --test scripts/validate-excalidraw.test.mjs
```
