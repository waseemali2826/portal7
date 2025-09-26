import { RequestHandler } from "express";
import { promises as fs } from "fs";
import path from "path";

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  message: string;
  createdAt: string; // ISO
  ip?: string | null;
};

const dataDir = path.join(import.meta.dirname, "../data");
const dataFile = path.join(dataDir, "contact-submissions.json");

async function ensureStore() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readAll(): Promise<ContactSubmission[]> {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ContactSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: ContactSubmission[]) {
  await ensureStore();
  await fs.writeFile(dataFile, JSON.stringify(items, null, 2), "utf8");
}

export const submitContact: RequestHandler = async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (
      !name || typeof name !== "string" ||
      !email || typeof email !== "string" ||
      !message || typeof message !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload" });
    }
    const items = await readAll();
    const sub: ContactSubmission = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      createdAt: new Date().toISOString(),
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
    };
    items.push(sub);
    await writeAll(items);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const listContacts: RequestHandler = async (_req, res) => {
  try {
    const items = await readAll();
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const listContactsCsv: RequestHandler = async (_req, res) => {
  try {
    const items = await readAll();
    const header = ["id","name","email","message","createdAt","ip"].join(",");
    const rows = items.map((it) =>
      [
        it.id,
        quoteCsv(it.name),
        it.email,
        quoteCsv(it.message),
        it.createdAt,
        it.ip ?? "",
      ].join(","),
    );
    const csv = [header, ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=contact-submissions.csv");
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const updateContact: RequestHandler = async (req, res) => {
  try {
    const { id, name, email, message } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id required" });
    }
    const items = await readAll();
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    if (typeof name === "string") items[idx].name = name.trim();
    if (typeof email === "string") items[idx].email = email.trim().toLowerCase();
    if (typeof message === "string") items[idx].message = message.trim();
    await writeAll(items);
    res.json({ ok: true, item: items[idx] });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const deleteContact: RequestHandler = async (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "id required" });
    }
    const items = await readAll();
    const idx = items.findIndex((x) => x.id === id);
    if (idx === -1) return res.status(404).json({ error: "Not found" });
    const [removed] = items.splice(idx, 1);
    await writeAll(items);
    res.json({ ok: true, removed });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

function quoteCsv(s: string) {
  const needs = /[",\n]/.test(s);
  const v = s.replace(/"/g, '""');
  return needs ? `"${v}"` : v;
}
