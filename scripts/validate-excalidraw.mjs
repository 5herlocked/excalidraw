#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const validate = (value) => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.type !== "excalidraw"
  ) {
    return {
      valid: false,
      message: 'Expected an object with type exactly "excalidraw".',
    };
  }

  if (!Array.isArray(value.elements)) {
    return {
      valid: false,
      message: 'Expected "elements" to be an array.',
    };
  }

  return { valid: true };
};

export const main = async (args = process.argv.slice(2)) => {
  const [filePath] = args;

  if (!filePath) {
    console.error("Usage: validate-excalidraw.mjs <path-to-file.excalidraw>");
    return 1;
  }

  let contents;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    console.error(`Unable to read "${filePath}": ${error.message}`);
    return 1;
  }

  let value;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    console.error(`Malformed JSON in "${filePath}": ${error.message}`);
    return 1;
  }

  const result = validate(value);
  if (!result.valid) {
    console.error(`Invalid Excalidraw file "${filePath}": ${result.message}`);
    return 1;
  }

  return 0;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main();
}
