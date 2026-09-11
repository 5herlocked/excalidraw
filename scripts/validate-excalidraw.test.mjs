import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validate } from "./validate-excalidraw.mjs";

const scriptPath = fileURLToPath(
  new URL("./validate-excalidraw.mjs", import.meta.url),
);

const runCli = (filePath) =>
  spawnSync(process.execPath, filePath ? [scriptPath, filePath] : [scriptPath], {
    encoding: "utf8",
  });

const withTempFile = async (contents, callback) => {
  const directory = await mkdtemp(path.join(tmpdir(), "validate-excalidraw-"));
  const filePath = path.join(directory, "scene.excalidraw");

  try {
    await writeFile(filePath, contents);
    await callback(filePath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

test("accepts a valid empty scene", () => {
  assert.deepEqual(validate({ type: "excalidraw", elements: [] }), {
    valid: true,
  });
});

test("accepts a valid scene with elements", async () => {
  await withTempFile(
    JSON.stringify({ type: "excalidraw", elements: [{ id: "element-1" }] }),
    async (filePath) => {
      const result = runCli(filePath);
      assert.equal(result.status, 0);
      assert.equal(result.stderr, "");
    },
  );
});

test("rejects malformed JSON", async () => {
  await withTempFile("{not json", async (filePath) => {
    const result = runCli(filePath);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Malformed JSON/);
  });
});

test("rejects a wrong type and non-object values", () => {
  assert.equal(validate({ type: "other", elements: [] }).valid, false);
  assert.equal(validate(null).valid, false);
  assert.match(validate([]).message, /type exactly/);
});

test("rejects missing and non-array elements", () => {
  assert.deepEqual(validate({ type: "excalidraw" }), {
    valid: false,
    message: 'Expected "elements" to be an array.',
  });
  assert.equal(
    validate({ type: "excalidraw", elements: {} }).valid,
    false,
  );
});

test("rejects a missing input path", () => {
  const result = runCli();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
});

test("rejects a missing or unreadable file", () => {
  const result = runCli(
    path.join(tmpdir(), `missing-excalidraw-${process.pid}`, "scene.excalidraw"),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unable to read/);
});
