// version-badge.test.mjs — the header version constant (src/version.js) is a
// second copy of the version, so keep it in agreement with package.json (the
// source of truth), the same way the CHANGELOG and README lines are checked.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VERSION } from "../src/version.js";

test("src/version.js matches package.json", () => {
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url)));
  assert.equal(VERSION, pkg.version, "version.js VERSION must equal package.json version");
});

test("VERSION is valid SemVer", () => {
  assert.match(VERSION, /^\d+\.\d+\.\d+([-+][0-9A-Za-z.]+)?$/);
});
