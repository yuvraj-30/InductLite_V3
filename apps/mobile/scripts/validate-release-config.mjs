#!/usr/bin/env node

import fs from "fs";
import path from "path";

const rootDir = path.resolve(process.cwd());
const envPath = path.join(rootDir, ".env");
const easPath = path.join(rootDir, "eas.json");

function parseDotEnv(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const raw = trimmed.slice(idx + 1).trim();
    const unquoted = raw.replace(/^"|"$/g, "");
    values[key] = unquoted;
  }
  return values;
}

const envFromFile = fs.existsSync(envPath)
  ? parseDotEnv(fs.readFileSync(envPath, "utf8"))
  : {};

function readEnv(name) {
  const direct = process.env[name];
  if (typeof direct === "string" && direct.trim().length > 0) {
    return direct.trim();
  }
  const file = envFromFile[name];
  return typeof file === "string" ? file.trim() : "";
}

function hasPlaceholder(value) {
  const lower = value.toLowerCase();
  return (
    !value ||
    lower.includes("placeholder") ||
    lower.includes("replace") ||
    lower.includes("000000") ||
    value === "ABC123XYZ9"
  );
}

function assertEnvValue(errors, name, validator, description) {
  const value = readEnv(name);
  if (!value) {
    errors.push(`${name} is missing (${description}).`);
    return;
  }
  if (validator(value) === false) {
    errors.push(`${name} is invalid (${description}).`);
  }
}

function isLikelyBundleId(value) {
  return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z0-9_-]+)+$/.test(value);
}

function isLikelyPackage(value) {
  return /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value);
}

function isLikelyUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function validateJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    JSON.parse(fs.readFileSync(filePath, "utf8"));
    return true;
  } catch {
    return false;
  }
}

const errors = [];

assertEnvValue(
  errors,
  "EXPO_PUBLIC_MOBILE_IOS_BUNDLE_ID",
  (value) => isLikelyBundleId(value) && !value.startsWith("com.placeholder."),
  "must be a real iOS bundle identifier",
);

assertEnvValue(
  errors,
  "EXPO_PUBLIC_MOBILE_ANDROID_PACKAGE",
  (value) => isLikelyPackage(value) && !value.startsWith("com.placeholder."),
  "must be a real Android package name",
);

assertEnvValue(
  errors,
  "EXPO_PUBLIC_MOBILE_EAS_PROJECT_ID",
  (value) => isLikelyUuid(value) && value !== "00000000-0000-0000-0000-000000000000",
  "must be a real EAS project ID",
);

assertEnvValue(
  errors,
  "IOS_ASC_APP_ID",
  (value) => /^\d{6,}$/.test(value) && !/^0+$/.test(value),
  "must be your App Store Connect numeric app ID",
);

assertEnvValue(
  errors,
  "APP_STORE_CONNECT_ISSUER_ID",
  (value) => isLikelyUuid(value) && value !== "00000000-0000-0000-0000-000000000000",
  "must be your App Store Connect issuer ID",
);

assertEnvValue(
  errors,
  "APP_STORE_CONNECT_KEY_ID",
  (value) => /^[A-Z0-9]{8,12}$/.test(value) && !hasPlaceholder(value),
  "must be your App Store Connect key ID",
);

assertEnvValue(
  errors,
  "APP_STORE_CONNECT_ASC_APP_ID",
  (value) => /^\d{6,}$/.test(value) && !/^0+$/.test(value),
  "must be your App Store Connect app ID",
);

const iosKeyPath = readEnv("APP_STORE_CONNECT_API_KEY_PATH");
if (!iosKeyPath) {
  errors.push("APP_STORE_CONNECT_API_KEY_PATH is missing (path to .p8 key).");
} else {
  const resolved = path.resolve(rootDir, iosKeyPath);
  if (!resolved.endsWith(".p8") || !fs.existsSync(resolved)) {
    errors.push("APP_STORE_CONNECT_API_KEY_PATH must point to an existing .p8 file.");
  }
}

if (!fs.existsSync(easPath)) {
  errors.push("eas.json is missing.");
} else {
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  const serviceAccountKeyPath =
    eas?.submit?.production?.android?.serviceAccountKeyPath || "";
  if (!serviceAccountKeyPath) {
    errors.push("eas.json submit.production.android.serviceAccountKeyPath is missing.");
  } else {
    const resolved = path.resolve(rootDir, serviceAccountKeyPath);
    if (!validateJsonFile(resolved)) {
      errors.push("Android service account file is missing or invalid JSON.");
    } else {
      const raw = fs.readFileSync(resolved, "utf8");
      if (hasPlaceholder(raw)) {
        errors.push("Android service account file still contains placeholder values.");
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Mobile release readiness check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Mobile release readiness check passed.");
