#!/usr/bin/env node
import admin from "firebase-admin";

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!svcJson) fail("Missing FIREBASE_SERVICE_ACCOUNT_JSON env var");

let serviceAccount;
try {
  serviceAccount = JSON.parse(svcJson);
} catch (e) {
  fail("Invalid FIREBASE_SERVICE_ACCOUNT_JSON: not valid JSON");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

let assignments = [];
const rawAssignments = process.env.ROLE_ASSIGNMENTS;
if (!rawAssignments) fail("Missing ROLE_ASSIGNMENTS env var (JSON array)");
try {
  assignments = JSON.parse(rawAssignments);
} catch (e) {
  fail("Invalid ROLE_ASSIGNMENTS: not valid JSON array");
}

if (!Array.isArray(assignments) || assignments.length === 0) {
  fail("ROLE_ASSIGNMENTS must be a non-empty JSON array");
}

async function setRoleByEmail(email, role) {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().setCustomUserClaims(user.uid, { role });
  console.log(`Set role '${role}' for ${email}`);
}

async function main() {
  for (const a of assignments) {
    if (!a || typeof a.email !== "string" || typeof a.role !== "string") {
      console.warn("Skipping invalid assignment:", a);
      continue;
    }
    try {
      await setRoleByEmail(a.email, a.role);
    } catch (err) {
      console.error(`Failed for ${a.email}:`, err?.message || err);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
