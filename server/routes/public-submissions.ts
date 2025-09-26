import { RequestHandler } from "express";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

export type PublicEnquiry = {
  id: string;
  name: string;
  course: string;
  contact: string;
  email?: string;
  preferredStart?: string; // ISO date
  createdAt: string; // ISO
};

export type PublicApplication = {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  preferredStart?: string; // ISO date
  createdAt: string; // ISO
};

const isServerless = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const baseDir = isServerless ? os.tmpdir() : path.join(import.meta.dirname, "../data");
const dataDir = baseDir;

const enquiriesFile = path.join(dataDir, "public-enquiries.json");
const applicationsFile = path.join(dataDir, "public-applications.json");

async function ensure(file: string) {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.access(file);
  } catch {
    await fs.writeFile(file, "[]", "utf8");
  }
}

async function readAll<T>(file: string): Promise<T[]> {
  await ensure(file);
  const raw = await fs.readFile(file, "utf8");
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

async function writeAll<T>(file: string, items: T[]) {
  await ensure(file);
  await fs.writeFile(file, JSON.stringify(items, null, 2), "utf8");
}

export const postPublicEnquiry: RequestHandler = async (req, res) => {
  try {
    const { name, course, contact, email, preferredStart } = req.body || {};
    if (!name || !course || !contact) return res.status(400).json({ error: "Invalid payload" });
    const items = await readAll<PublicEnquiry>(enquiriesFile);
    const it: PublicEnquiry = {
      id: `ENQ-${Date.now()}`,
      name: String(name),
      course: String(course),
      contact: String(contact),
      email: email ? String(email) : undefined,
      preferredStart: preferredStart ? String(preferredStart) : undefined,
      createdAt: new Date().toISOString(),
    };
    items.unshift(it);
    await writeAll(enquiriesFile, items);
    res.json({ ok: true, item: it });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const listPublicEnquiries: RequestHandler = async (_req, res) => {
  try {
    const items = await readAll<PublicEnquiry>(enquiriesFile);
    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const postPublicApplication: RequestHandler = async (req, res) => {
  try {
    const { name, email, phone, course, preferredStart } = req.body || {};
    if (!name || !email || !phone || !course) return res.status(400).json({ error: "Invalid payload" });
    const items = await readAll<PublicApplication>(applicationsFile);
    const it: PublicApplication = {
      id: `APP-${Date.now()}`,
      name: String(name),
      email: String(email),
      phone: String(phone),
      course: String(course),
      preferredStart: preferredStart ? String(preferredStart) : undefined,
      createdAt: new Date().toISOString(),
    };
    items.unshift(it);
    await writeAll(applicationsFile, items);
    res.json({ ok: true, item: it });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};

export const listPublicApplications: RequestHandler = async (_req, res) => {
  try {
    const items = await readAll<PublicApplication>(applicationsFile);
    res.json({ ok: true, items });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Server error" });
  }
};
