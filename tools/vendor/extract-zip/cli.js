#!/usr/bin/env node

const path = require("path");
const extractZip = require("./");

const source = process.argv[2];
const targetDir =
  process.argv[3] && process.argv[3].trim()
    ? path.resolve(process.argv[3])
    : process.cwd();

if (!source) {
  console.error("Usage: extract-zip <source.zip> [target-dir]");
  process.exit(1);
}

extractZip(path.resolve(source), { dir: targetDir }).catch((error) => {
  console.error(error);
  process.exit(1);
});
