import "dotenv/config";
import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import { handleDemo } from "./routes/demo";
import { getRolePerms, saveRolePerms } from "./routes/role-perms";
import { submitContact, listContacts, listContactsCsv, updateContact, deleteContact } from "./routes/contact";
import { postPublicEnquiry, listPublicEnquiries, postPublicApplication, listPublicApplications } from "./routes/public-submissions";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  // Global safeguard: prevent DELETE by non-owner
  app.use(async (req, res, next) => {
    if (req.method !== "DELETE") return next();
    if (!adminReady) return res.status(403).json({ error: "Forbidden" });
    try {
      const authz = req.header("authorization") || req.header("Authorization");
      if (!authz?.startsWith("Bearer "))
        return res.status(401).json({ error: "Unauthorized" });
      const idToken = authz.substring("Bearer ".length);
      const decoded = await admin.auth().verifyIdToken(idToken);
      if ((decoded as any)?.role !== "owner")
        return res.status(403).json({ error: "Forbidden" });
      return next();
    } catch (e) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  });

  app.get("/api/demo", handleDemo);

  // Contact submissions
  app.post("/api/contact-submissions", submitContact);
  app.get("/api/contact-submissions", listContacts);
  app.get("/api/contact-submissions.csv", listContactsCsv);
  app.post("/api/contact-submissions/update", updateContact);
  app.post("/api/contact-submissions/delete", deleteContact);

  // Public enquiries/applications (public site -> admin dashboard)
  app.post("/api/public/enquiries", postPublicEnquiry);
  app.get("/api/public/enquiries", listPublicEnquiries);
  app.post("/api/public/applications", postPublicApplication);
  app.get("/api/public/applications", listPublicApplications);

  // Role permissions persistence (read open, write requires ADMIN_API_TOKEN)
  app.get("/api/role-perms", getRolePerms);
  app.get("/api/role-perms/:roleId", getRolePerms);
  app.post("/api/admin/role-perms", saveRolePerms);

  // Initialize Firebase Admin if service account JSON is provided via env
  let adminReady = false;
  try {
    const svc = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (svc && !admin.apps.length) {
      const cred = admin.credential.cert(JSON.parse(svc));
      admin.initializeApp({ credential: cred });
      adminReady = true;
    }
  } catch (e) {
    console.error("Firebase admin initialization failed:", e);
  }

  function authorize(req: express.Request, res: express.Response) {
    const token =
      req.header("x-admin-token") ||
      (req.query.token as string | undefined) ||
      (req.body && (req.body.token as string | undefined));
    if (!token || token !== process.env.ADMIN_API_TOKEN) {
      res.status(401).json({ error: "Unauthorized" });
      return false;
    }
    if (!adminReady) {
      res.status(500).json({ error: "Admin not configured" });
      return false;
    }
    return true;
  }

  // POST: set one or many roles (token header x-admin-token)
  app.post("/api/admin/set-role", async (req, res) => {
    if (!authorize(req, res)) return;
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];
    const results: Array<{
      email: string | null;
      ok: boolean;
      error?: string;
    }> = [];
    for (const it of items) {
      if (!it || typeof it.email !== "string" || typeof it.role !== "string") {
        results.push({
          email: it?.email ?? null,
          ok: false,
          error: "Invalid payload",
        });
        continue;
      }
      try {
        const user = await admin.auth().getUserByEmail(it.email);
        await admin.auth().setCustomUserClaims(user.uid, { role: it.role });
        results.push({ email: it.email, ok: true });
      } catch (err: any) {
        results.push({
          email: it.email,
          ok: false,
          error: err?.message ?? String(err),
        });
      }
    }
    res.json({ ok: true, results });
  });

  // POST: set roles using Firebase ID token of an owner
  app.post("/api/admin/set-role-auth", async (req, res) => {
    if (!adminReady)
      return res.status(500).json({ error: "Admin not configured" });
    const authz = req.header("authorization") || req.header("Authorization");
    if (!authz || !authz.startsWith("Bearer "))
      return res.status(401).json({ error: "Unauthorized" });
    const idToken = authz.substring("Bearer ".length);
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      const requesterRole = (decoded as any)?.role;
      if (requesterRole !== "owner")
        return res.status(403).json({ error: "Forbidden" });
    } catch (e: any) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];
    const results: Array<{
      email: string | null;
      ok: boolean;
      error?: string;
      appliedClaim?: string;
    }> = [];

    const mapToClaim = (role: string) => {
      const r = String(role).toLowerCase();
      if (
        r === "owner" ||
        r === "admin" ||
        r.includes("role-owner") ||
        r.includes("role-admin")
      )
        return "owner";
      return "limited";
    };

    for (const it of items) {
      if (!it || typeof it.email !== "string" || typeof it.role !== "string") {
        results.push({
          email: it?.email ?? null,
          ok: false,
          error: "Invalid payload",
        });
        continue;
      }
      try {
        const user = await admin.auth().getUserByEmail(it.email);
        const claim = mapToClaim(it.role);
        await admin.auth().setCustomUserClaims(user.uid, {
          role: claim,
          appRoleId: String(it.role),
        });
        results.push({ email: it.email, ok: true, appliedClaim: claim });
      } catch (err: any) {
        results.push({
          email: it.email,
          ok: false,
          error: err?.message ?? String(err),
        });
      }
    }

    res.json({ ok: true, results });
  });

  // GET: quick single role set via query (temporary convenience)
  app.get("/api/admin/set-role", async (req, res) => {
    if (!authorize(req, res)) return;
    const email = (req.query.email as string) || "";
    const role = (req.query.role as string) || "";
    if (!email || !role)
      return res.status(400).json({ error: "email and role are required" });
    try {
      const user = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(user.uid, { role });
      res.json({ ok: true, email, role });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err?.message ?? String(err) });
    }
  });

  return app;
}
