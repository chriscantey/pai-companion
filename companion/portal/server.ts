#!/usr/bin/env bun
/**
 * PAI Companion Portal Server
 *
 * Simplified HTTP server for ~/portal/ content.
 * Serves portal pages, clipboard, and file exchange.
 *
 * Designed to run inside Docker, mounted volumes:
 *   - ~/portal/  → /portal  (web content)
 *   - ~/exchange/ → /exchange (file exchange)
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, extname, dirname, resolve, basename } from "path";

const PORT = Number(process.env.PORT) || 8080;
const VIEW_DIR = process.env.VIEW_DIR || "/portal";
const EXCHANGE_DIR = process.env.EXCHANGE_DIR || "/exchange";
const SKILLS_DIR = process.env.SKILLS_DIR || "/skills";
const AGENTS_DIR = process.env.AGENTS_DIR || "/agents";
const WORK_DIR = process.env.WORK_DIR || "/work";
const DATA_DIR = process.env.DATA_DIR || "/data";
const CLAUDE_DIR = process.env.CLAUDE_DIR || "/dotclaude";
const MAX_UPLOAD_SIZE = Number(process.env.MAX_UPLOAD_SIZE) || 1024 * 1024 * 1024; // 1GB

/** Allowed directories for the browse API */
const BROWSE_DIRS: Record<string, string> = {
  portal: VIEW_DIR,
  exchange: EXCHANGE_DIR,
  work: WORK_DIR,
  data: DATA_DIR,
  claude: CLAUDE_DIR,
};

/** Sensitive filename patterns to hide when browsing */
const SENSITIVE_PATTERNS = [/\.env$/i, /\.key$/i, /\.pem$/i, /token/i, /secret/i, /credential/i];

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".stl": "model/stl",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".csv": "text/csv",
  ".xml": "application/xml",
  ".zip": "application/zip",
};

/** Get portal directory listing (subdirectories of VIEW_DIR) */
function getDirectoryListing(): { name: string; modified: string }[] {
  const items: { name: string; modified: string }[] = [];
  try {
    const entries = readdirSync(VIEW_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        const stat = statSync(join(VIEW_DIR, entry.name));
        items.push({
          name: entry.name,
          modified: stat.mtime.toISOString(),
        });
      }
    }
    items.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
  } catch (e) {
    console.error("Error reading directory:", e);
  }
  return items;
}

/** Validate path is safe and within a root directory */
function safePath(root: string, subpath: string): string | null {
  if (subpath.includes("..")) return null;
  const full = resolve(root, subpath);
  if (!full.startsWith(root)) return null;
  return full;
}

/** Skip hidden/system files */
function isHidden(name: string): boolean {
  return name.startsWith(".") || name.startsWith("._");
}

const CORS_HEADERS = { "Access-Control-Allow-Origin": "*" };
const JSON_HEADERS = { "Content-Type": "application/json", ...CORS_HEADERS };

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  maxRequestBodySize: Infinity, // Bun RSTs connections exceeding this — enforce limit in handler instead
  async fetch(req) {
    const url = new URL(req.url);
    let reqPath = decodeURIComponent(url.pathname);

    // CORS preflight
    if (req.method === "OPTIONS" && reqPath.startsWith("/api/")) {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // ── API: Portal directory listing ──────────────────────────────────
    if (reqPath === "/api/list") {
      return new Response(JSON.stringify(getDirectoryListing()), {
        headers: JSON_HEADERS,
      });
    }

    // ── API: Skills listing (with sub-skills) ──────────────────────────
    if (reqPath === "/api/skills") {
      try {
        function parseSkillMd(filePath: string) {
          if (!existsSync(filePath)) return null;
          const content = readFileSync(filePath, "utf-8");
          const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
          if (!fmMatch) return null;
          const fm = fmMatch[1];
          const nameMatch = fm.match(/^name:\s*(.+)$/m);
          const descMatch = fm.match(/^description:\s*(.+)$/m);
          if (!nameMatch) return null;
          let desc = descMatch ? descMatch[1].trim() : "";
          const useWhen = desc.indexOf("USE WHEN");
          if (useWhen > 0) desc = desc.substring(0, useWhen).trim().replace(/\.\s*$/, "");
          return { name: nameMatch[1].trim(), description: desc };
        }

        const skills: { name: string; dirName: string; description: string; source: string; subSkills: { name: string; dirName: string; description: string }[] }[] = [];
        const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "PAI") continue;
          const parsed = parseSkillMd(join(SKILLS_DIR, entry.name, "SKILL.md"));
          if (!parsed) continue;

          // Find sub-skills (subdirectories with their own SKILL.md)
          const subSkills: { name: string; dirName: string; description: string }[] = [];
          try {
            const subEntries = readdirSync(join(SKILLS_DIR, entry.name), { withFileTypes: true });
            for (const sub of subEntries) {
              if (!sub.isDirectory() || sub.name.startsWith(".") || sub.name === "node_modules") continue;
              const subParsed = parseSkillMd(join(SKILLS_DIR, entry.name, sub.name, "SKILL.md"));
              if (subParsed) {
                subSkills.push({ name: subParsed.name, dirName: sub.name, description: subParsed.description });
              }
            }
            subSkills.sort((a, b) => a.name.localeCompare(b.name));
          } catch { /* no sub-skills */ }

          skills.push({
            name: parsed.name,
            dirName: entry.name,
            description: parsed.description,
            source: entry.name === "Custom" ? "custom" : "upstream",
            subSkills,
          });
        }
        skills.sort((a, b) => a.name.localeCompare(b.name));
        return new Response(JSON.stringify(skills), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read skills" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Single skill detail (supports nested paths) ───────────────
    if (reqPath.startsWith("/api/skill/")) {
      const skillPath = decodeURIComponent(reqPath.slice("/api/skill/".length));
      if (!skillPath || skillPath.includes("..")) {
        return new Response(JSON.stringify({ error: "Invalid skill path" }), { status: 400, headers: JSON_HEADERS });
      }
      const parts = skillPath.split("/").filter(Boolean);
      if (parts.length < 1 || parts.length > 2) {
        return new Response(JSON.stringify({ error: "Invalid skill path" }), { status: 400, headers: JSON_HEADERS });
      }
      const skillDir = join(SKILLS_DIR, ...parts);
      const skillFile = join(skillDir, "SKILL.md");
      if (!existsSync(skillFile)) {
        return new Response(JSON.stringify({ error: "Skill not found" }), { status: 404, headers: JSON_HEADERS });
      }
      try {
        const content = readFileSync(skillFile, "utf-8");
        const files: string[] = [];
        function listFiles(dir: string, prefix: string) {
          for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (e.name.startsWith(".") || e.name === "node_modules") continue;
            const path = prefix ? `${prefix}/${e.name}` : e.name;
            if (e.isDirectory()) listFiles(join(dir, e.name), path);
            else files.push(path);
          }
        }
        listFiles(skillDir, "");
        return new Response(JSON.stringify({ name: parts[parts.length - 1], content, files }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read skill" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Single agent detail ─────────────────────────────────────
    if (reqPath.startsWith("/api/agent/")) {
      const agentName = reqPath.slice("/api/agent/".length);
      if (!agentName || agentName.includes("..") || agentName.includes("/")) {
        return new Response(JSON.stringify({ error: "Invalid agent name" }), { status: 400, headers: JSON_HEADERS });
      }
      const agentFile = join(AGENTS_DIR, agentName + ".md");
      if (!existsSync(agentFile)) {
        return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404, headers: JSON_HEADERS });
      }
      try {
        const content = readFileSync(agentFile, "utf-8");
        return new Response(JSON.stringify({ name: agentName, content }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read agent" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Hooks listing ───────────────────────────────────────────
    if (reqPath === "/api/hooks") {
      try {
        const hooksDir = join(SKILLS_DIR, "..", "hooks");
        if (!existsSync(hooksDir)) {
          return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
        }
        const hooks: { name: string; size: number }[] = [];
        for (const entry of readdirSync(hooksDir, { withFileTypes: true })) {
          if (!entry.isFile() || entry.name.startsWith(".")) continue;
          const stat = statSync(join(hooksDir, entry.name));
          hooks.push({ name: entry.name, size: stat.size });
        }
        hooks.sort((a, b) => a.name.localeCompare(b.name));
        return new Response(JSON.stringify(hooks), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read hooks" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: System info ─────────────────────────────────────────────
    if (reqPath === "/api/system") {
      try {
        const info: Record<string, any> = {};
        // Count skills
        const skillEntries = readdirSync(SKILLS_DIR, { withFileTypes: true });
        info.skillCount = skillEntries.filter(e => e.isDirectory() && !e.name.startsWith(".") && e.name !== "PAI" && existsSync(join(SKILLS_DIR, e.name, "SKILL.md"))).length;
        // Count agents
        try {
          const agentEntries = readdirSync(AGENTS_DIR, { withFileTypes: true });
          info.agentCount = agentEntries.filter(e => e.isFile() && e.name.endsWith(".md")).length;
        } catch { info.agentCount = 0; }
        // Algorithm version — PAI 5 uses ALGORITHM (uppercase); fall back to PAI 4's lowercase Algorithm
        const algLatestV5 = join(CLAUDE_DIR, "PAI", "ALGORITHM", "LATEST");
        const algLatestV4 = join(CLAUDE_DIR, "PAI", "Algorithm", "LATEST");
        const algLatest = existsSync(algLatestV5) ? algLatestV5 : algLatestV4;
        info.algorithmVersion = existsSync(algLatest) ? readFileSync(algLatest, "utf-8").trim() : "unknown";
        // Directory info
        const dirs = [
          { name: "portal", path: VIEW_DIR },
          { name: "exchange", path: EXCHANGE_DIR },
        ];
        info.directories = dirs.map(d => ({
          name: d.name,
          exists: existsSync(d.path),
        }));
        return new Response(JSON.stringify(info), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read system info" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Agents listing ────────────────────────────────────────────
    if (reqPath === "/api/agents") {
      try {
        const agents: { name: string; description: string; model: string; color: string }[] = [];
        const entries = readdirSync(AGENTS_DIR, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
          try {
            const content = readFileSync(join(AGENTS_DIR, entry.name), "utf-8");
            const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!fmMatch) continue;
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            const modelMatch = fm.match(/^model:\s*(.+)$/m);
            const colorMatch = fm.match(/^color:\s*(.+)$/m);
            if (nameMatch) {
              let desc = descMatch ? descMatch[1].trim() : "";
              // Truncate long descriptions for display
              const useWhen = desc.indexOf("USE WHEN");
              if (useWhen > 0) desc = desc.substring(0, useWhen).trim().replace(/\.\s*$/, "");
              if (desc.length > 200) desc = desc.substring(0, 200).replace(/\s\S*$/, "") + "...";
              agents.push({
                name: nameMatch[1].trim(),
                description: desc,
                model: modelMatch ? modelMatch[1].trim() : "unknown",
                color: colorMatch ? colorMatch[1].trim() : "cyan",
              });
            }
          } catch { /* skip unreadable agents */ }
        }
        agents.sort((a, b) => a.name.localeCompare(b.name));
        return new Response(JSON.stringify(agents), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read agents" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Cron jobs ────────────────────────────────────────────────
    if (reqPath === "/api/cron") {
      const cronFile = join(DATA_DIR, "crontab.txt");
      if (!existsSync(cronFile)) {
        return new Response(JSON.stringify({ jobs: [], raw: "" }), { headers: JSON_HEADERS });
      }
      try {
        const raw = readFileSync(cronFile, "utf-8").trim();
        const jobs = raw.split("\n")
          .filter(line => line && !line.startsWith("#"))
          .map(line => {
            const parts = line.split(/\s+/);
            const schedule = parts.slice(0, 5).join(" ");
            const command = parts.slice(5).join(" ");
            // Friendly schedule description
            let when = schedule;
            if (schedule === "0 0 * * *") when = "Daily at midnight";
            else if (schedule === "5 0 * * *") when = "Daily at 12:05 AM";
            else if (schedule === "0 * * * *") when = "Every hour";
            else if (schedule === "0 0 * * 0") when = "Weekly (Sunday midnight)";
            // Extract a short label from the command
            let label = command;
            const commentMatch = line.match(/# (.+)$/);
            if (commentMatch) label = commentMatch[1];
            else if (command.includes("daily snapshot")) label = "Auto-commit snapshot";
            else if (command.includes("crontab.txt")) label = "Export crontab";
            return { schedule, when, command, label };
          });
        return new Response(JSON.stringify({ jobs, raw }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read crontab" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Directory browser ────────────────────────────────────────
    if (reqPath === "/api/browse") {
      const dirName = url.searchParams.get("dir") || "";
      const subpath = url.searchParams.get("path") || "";

      const rootDir = BROWSE_DIRS[dirName];
      if (!rootDir) {
        return new Response(JSON.stringify({ error: "Invalid directory", allowed: Object.keys(BROWSE_DIRS) }), { status: 400, headers: JSON_HEADERS });
      }

      const targetPath = safePath(rootDir, subpath);
      if (!targetPath) {
        return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: JSON_HEADERS });
      }

      if (!existsSync(targetPath) || !statSync(targetPath).isDirectory()) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: JSON_HEADERS });
      }

      try {
        const entries = readdirSync(targetPath, { withFileTypes: true });
        const items = entries
          .filter(e => !isHidden(e.name) && !SENSITIVE_PATTERNS.some(p => p.test(e.name)))
          .map(e => {
            const stat = statSync(join(targetPath, e.name));
            return {
              name: e.name,
              type: e.isDirectory() ? "dir" as const : "file" as const,
              size: e.isDirectory() ? 0 : stat.size,
              modified: stat.mtime.toISOString(),
            };
          })
          .sort((a, b) => {
            if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
            return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
          });

        return new Response(JSON.stringify(items), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read directory" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Exchange file manager ─────────────────────────────────────
    if (reqPath.startsWith("/api/exchange")) {
      // GET /api/exchange?path= — List directory
      if (req.method === "GET" && reqPath === "/api/exchange") {
        const subpath = url.searchParams.get("path") || "";
        const dirPath = safePath(EXCHANGE_DIR, subpath);
        if (!dirPath) {
          return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: JSON_HEADERS });
        }
        if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
          return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: JSON_HEADERS });
        }

        try {
          const entries = readdirSync(dirPath, { withFileTypes: true });
          const items = entries
            .filter(e => !isHidden(e.name))
            .map(e => {
              const stat = statSync(join(dirPath, e.name));
              return {
                name: e.name,
                type: e.isDirectory() ? "dir" as const : "file" as const,
                size: e.isDirectory() ? 0 : stat.size,
                modified: stat.mtime.toISOString(),
              };
            })
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
              return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
            });

          return new Response(JSON.stringify(items), { headers: JSON_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Failed to read directory" }), { status: 500, headers: JSON_HEADERS });
        }
      }

      // GET /api/exchange/download/... — Download file
      if (req.method === "GET" && reqPath.startsWith("/api/exchange/download/")) {
        const fileSub = reqPath.slice("/api/exchange/download/".length);
        const filePath = safePath(EXCHANGE_DIR, fileSub);
        if (!filePath) {
          return new Response("Forbidden", { status: 403, headers: CORS_HEADERS });
        }
        if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
          return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
        }

        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";
        const fileName = basename(filePath);

        return new Response(Bun.file(filePath), {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${fileName}"`,
            ...CORS_HEADERS,
          },
        });
      }

      // POST /api/exchange/upload?path=&filename= — Upload file (raw body)
      if (req.method === "POST" && reqPath === "/api/exchange/upload") {
        const subpath = url.searchParams.get("path") || "";
        const filename = url.searchParams.get("filename") || "";
        const dirPath = safePath(EXCHANGE_DIR, subpath);
        if (!dirPath) {
          return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: JSON_HEADERS });
        }
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }
        if (!filename) {
          return new Response(JSON.stringify({ error: "Filename required" }), { status: 400, headers: JSON_HEADERS });
        }

        // Enforce upload size limit with proper HTTP error (not connection reset)
        const contentLength = Number(req.headers.get("content-length") || 0);
        if (contentLength > MAX_UPLOAD_SIZE) {
          return new Response(JSON.stringify({ error: `File too large (max ${Math.round(MAX_UPLOAD_SIZE / 1024 / 1024 / 1024)}GB)` }), { status: 413, headers: JSON_HEADERS });
        }

        try {
          const name = filename.replace(/\.\./g, "").replace(/\//g, "_");
          const dest = join(dirPath, name);
          const writer = Bun.file(dest).writer();
          for await (const chunk of req.body!) {
            writer.write(chunk);
          }
          await writer.end();
          return new Response(JSON.stringify({ ok: true, files: [name] }), { headers: JSON_HEADERS });
        } catch (e) {
          console.error("Upload error:", e);
          return new Response(JSON.stringify({ error: "Upload failed" }), { status: 500, headers: JSON_HEADERS });
        }
      }

      // DELETE /api/exchange/delete — Delete file
      if (req.method === "DELETE" && reqPath === "/api/exchange/delete") {
        try {
          const body = await req.json();
          const filePath = safePath(EXCHANGE_DIR, body.path || "");
          if (!filePath) {
            return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: JSON_HEADERS });
          }
          if (!existsSync(filePath)) {
            return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: JSON_HEADERS });
          }
          if (statSync(filePath).isDirectory()) {
            return new Response(JSON.stringify({ error: "Cannot delete directories" }), { status: 400, headers: JSON_HEADERS });
          }

          unlinkSync(filePath);
          return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Delete failed" }), { status: 500, headers: JSON_HEADERS });
        }
      }

      return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: JSON_HEADERS });
    }

    // ── API: Context files listing ────────────────────────────────────
    if (reqPath === "/api/context") {
      try {
        const PAI_USER_DIR = join(CLAUDE_DIR, "PAI", "USER");
        const PAI_SYSTEM_DIR = join(CLAUDE_DIR, "PAI");
        const SETTINGS_PATH = join(CLAUDE_DIR, "settings.json");
        const CLAUDE_MD_PATH = join(CLAUDE_DIR, "CLAUDE.md");

        let settings: any = {};
        try { settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8")); } catch {}
        const loadAtStartup: string[] = settings.loadAtStartup?.files || [];
        const contextFilesList: string[] = settings.contextFiles || [];

        interface ContextFile {
          name: string;
          relativePath: string;
          size: number;
          category: string;
          loading: string;
          loadingDetail: string;
        }
        const files: ContextFile[] = [];
        const listedPaths = new Set<string>();

        // CLAUDE.md — always loaded natively
        if (existsSync(CLAUDE_MD_PATH)) {
          const stat = statSync(CLAUDE_MD_PATH);
          files.push({ name: "CLAUDE.md", relativePath: "CLAUDE.md", size: stat.size, category: "system", loading: "always", loadingDetail: "Claude Code native — loaded every session" });
          listedPaths.add(CLAUDE_MD_PATH);
        }

        // loadAtStartup files
        for (const rel of loadAtStartup) {
          const full = join(CLAUDE_DIR, rel);
          if (!existsSync(full)) continue;
          const stat = statSync(full);
          if (stat.isDirectory()) continue;
          const isUser = rel.includes("/USER/");
          files.push({ name: basename(full), relativePath: rel, size: stat.size, category: isUser ? "user" : "system", loading: "always", loadingDetail: "loadAtStartup — force-injected by LoadContext hook" });
          listedPaths.add(full);
        }

        // contextFiles
        for (const rel of contextFilesList) {
          const full = join(CLAUDE_DIR, rel);
          if (!existsSync(full)) continue;
          const stat = statSync(full);
          if (stat.isDirectory()) continue;
          files.push({ name: basename(full), relativePath: rel, size: stat.size, category: "user", loading: "on-demand", loadingDetail: "contextFiles — Claude Code injects when relevant" });
          listedPaths.add(full);
        }

        // USER directory files
        function scanUserDir(dir: string, prefix: string) {
          if (!existsSync(dir)) return;
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith(".")) continue;
            const full = join(dir, entry.name);
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
              scanUserDir(full, rel);
            } else {
              if (listedPaths.has(full)) continue;
              const stat = statSync(full);
              files.push({ name: entry.name, relativePath: `PAI/USER/${rel}`, size: stat.size, category: "user", loading: "on-demand", loadingDetail: "CONTEXT_ROUTING — loaded when task requires it" });
            }
          }
        }
        scanUserDir(PAI_USER_DIR, "");

        // PAI system docs
        if (existsSync(PAI_SYSTEM_DIR)) {
          for (const entry of readdirSync(PAI_SYSTEM_DIR, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
            const full = join(PAI_SYSTEM_DIR, entry.name);
            if (listedPaths.has(full)) continue;
            const stat = statSync(full);
            const relFromClaude = `PAI/${entry.name}`;
            const isStartup = loadAtStartup.includes(relFromClaude);
            files.push({ name: entry.name, relativePath: relFromClaude, size: stat.size, category: "system", loading: isStartup ? "always" : "on-demand", loadingDetail: isStartup ? "loadAtStartup — force-injected by LoadContext hook" : "CONTEXT_ROUTING — loaded when task requires it" });
          }
        }

        // Skill customizations
        const customizations: { skill: string; files: string[] }[] = [];
        const scDir = join(PAI_USER_DIR, "SKILLCUSTOMIZATIONS");
        if (existsSync(scDir)) {
          for (const entry of readdirSync(scDir, { withFileTypes: true })) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
            const skillFiles: string[] = [];
            for (const f of readdirSync(join(scDir, entry.name))) { skillFiles.push(f); }
            if (skillFiles.length > 0) { customizations.push({ skill: entry.name, files: skillFiles }); }
          }
        }

        return new Response(JSON.stringify({ files, customizations, loadAtStartup, contextFiles: contextFilesList }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read context files" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Single context file detail ─────────────────────────────────
    if (reqPath.startsWith("/api/context/")) {
      const filePath = decodeURIComponent(reqPath.slice("/api/context/".length));
      if (!filePath || filePath.includes("..")) {
        return new Response(JSON.stringify({ error: "Invalid path" }), { status: 400, headers: JSON_HEADERS });
      }
      const fullPath = join(CLAUDE_DIR, filePath);
      if (!fullPath.startsWith(CLAUDE_DIR) || !existsSync(fullPath) || statSync(fullPath).isDirectory()) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: JSON_HEADERS });
      }
      // Never serve credential-shaped files, even by exact name — same
      // filter the browse API applies to listings.
      if (SENSITIVE_PATTERNS.some((p) => p.test(basename(fullPath)))) {
        return new Response(JSON.stringify({ error: "File not found" }), { status: 404, headers: JSON_HEADERS });
      }
      try {
        const content = readFileSync(fullPath, "utf-8");
        return new Response(JSON.stringify({ name: basename(fullPath), path: filePath, content }), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read file" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API v2: page-renderer endpoints (Portal v2 — return Array<{title,meta,snippet,content}>)
    if (reqPath.startsWith("/api/") && ["algorithm","identity","hooks-detail","reflections","signals","observability","voice-events","isas","tasks","sessions","knowledge","relationships","settings","plugins"].some(s => reqPath === "/api/" + s)) {
      const readSafe = (p: string): string | null => { try { return existsSync(p) ? readFileSync(p, "utf-8") : null; } catch { return null; } };
      const shortSnip = (s: string, n = 200): string => s.replace(/^---[\s\S]*?---\s*/, "").replace(/\s+/g, " ").trim().slice(0, n);
      const lsDir = (d: string): string[] => { try { return readdirSync(d).filter(n => !n.startsWith(".")).sort(); } catch { return []; } };

      try {
        if (reqPath === "/api/algorithm") {
          const latestV5 = join(CLAUDE_DIR, "PAI", "ALGORITHM", "LATEST");
          const latestV4 = join(CLAUDE_DIR, "PAI", "Algorithm", "LATEST");
          const latestPath = existsSync(latestV5) ? latestV5 : latestV4;
          const version = (readSafe(latestPath) || "").trim() || "unknown";
          const algDirV5 = join(CLAUDE_DIR, "PAI", "ALGORITHM", `v${version}.md`);
          const algDirV4 = join(CLAUDE_DIR, "PAI", "Algorithm", `v${version}.md`);
          const content = readSafe(existsSync(algDirV5) ? algDirV5 : algDirV4);
          return new Response(JSON.stringify([{
            title: `Algorithm v${version}`,
            meta: "7-phase: Observe · Think · Plan · Build · Execute · Verify · Learn",
            snippet: content ? shortSnip(content, 250) : "Algorithm file not found",
            content: content || "(file not found at " + latestPath + ")"
          }]), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/identity") {
          const files = ["PRINCIPAL_IDENTITY.md", "DA_IDENTITY.md", "BASICINFO.md", "AISTEERINGRULES.md", "DESIGN.md", "OPINIONS.md", "CONTACTS.md"];
          const out: any[] = [];
          for (const f of files) {
            const c = readSafe(join(CLAUDE_DIR, "PAI", "USER", f));
            if (!c) continue;
            const titleMatch = c.match(/^#\s+(.+)$/m);
            out.push({ title: titleMatch ? titleMatch[1] : f, meta: `PAI/USER/${f}`, snippet: shortSnip(c, 220), content: c });
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/hooks-detail") {
          const dir = join(CLAUDE_DIR, "hooks");
          const out: any[] = [];
          for (const f of lsDir(dir).filter(n => n.endsWith(".hook.ts"))) {
            const fullPath = join(dir, f);
            const c = readSafe(fullPath); if (!c) continue;
            const headerMatch = c.match(/\/\*\*([\s\S]*?)\*\//);
            const header = headerMatch ? headerMatch[1].replace(/^\s*\*\s?/gm, "").trim() : "";
            out.push({ title: f.replace(/\.hook\.ts$/, ""), meta: `${(statSync(fullPath).size / 1024).toFixed(1)}KB`, snippet: shortSnip(header || c, 220), content: c.slice(0, 16000) });
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/reflections") {
          const path = join(CLAUDE_DIR, "PAI", "MEMORY", "LEARNING", "REFLECTIONS", "algorithm-reflections.jsonl");
          const c = readSafe(path);
          if (!c) return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
          const lines = c.trim().split("\n").reverse().slice(0, 30);
          const out = lines.map(line => { try { const j = JSON.parse(line); return { title: j.task_description || j.prd_id || "Reflection", meta: `${j.timestamp || ""} · ${j.effort_level || ""}`, snippet: j.reflection_q1 || j.reflection_q2 || JSON.stringify(j).slice(0, 200), content: JSON.stringify(j, null, 2) }; } catch { return null; } }).filter(Boolean);
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/signals" || reqPath === "/api/observability") {
          const dir = reqPath === "/api/signals" ? join(CLAUDE_DIR, "PAI", "MEMORY", "LEARNING") : join(CLAUDE_DIR, "PAI", "MEMORY", "OBSERVABILITY");
          const out: any[] = [];
          for (const f of lsDir(dir).filter(n => n.endsWith(".jsonl"))) {
            const c = readSafe(join(dir, f)); if (!c) continue;
            const count = c.trim().split("\n").filter(Boolean).length;
            out.push({ title: f.replace(/\.jsonl$/, ""), meta: `${count} entries`, snippet: c.split("\n").slice(0, 3).join(" ").slice(0, 200), content: c.split("\n").slice(-50).join("\n") });
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/voice-events") {
          const path = join(CLAUDE_DIR, "PAI", "MEMORY", "VOICE", "voice-events.jsonl");
          const c = readSafe(path);
          if (!c) return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
          const lines = c.trim().split("\n").reverse().slice(0, 30);
          const out = lines.map(line => { try { const j = JSON.parse(line); return { title: j.message || "Voice event", meta: j.timestamp || "", snippet: j.message || "", content: JSON.stringify(j, null, 2) }; } catch { return null; } }).filter(Boolean);
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/isas") {
          const workDir = join(CLAUDE_DIR, "PAI", "MEMORY", "WORK");
          const out: any[] = [];
          for (const slug of lsDir(workDir)) {
            const p = join(workDir, slug, "ISA.md");
            const c = readSafe(p); if (!c) continue;
            const fmMatch = c.match(/^---\s*\n([\s\S]*?)\n---/);
            const fm: Record<string, string> = {};
            if (fmMatch) { for (const m of fmMatch[1].matchAll(/^(\w+):\s*(.*)$/gm)) fm[m[1]] = m[2].trim(); }
            out.push({ title: fm.task || slug, meta: `${fm.effort || "E?"} · ${fm.phase || "?"} · ${fm.progress || "?"}`, snippet: shortSnip(c.replace(fmMatch?.[0] || "", ""), 220), content: c });
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/tasks") {
          const tasksDir = join(CLAUDE_DIR, "tasks");
          const out: any[] = [];
          for (const sid of lsDir(tasksDir)) {
            const d = join(tasksDir, sid);
            try { if (!statSync(d).isDirectory()) continue; const files = lsDir(d); out.push({ title: `Session ${sid.slice(0, 8)}`, meta: `${files.length} task files`, snippet: files.slice(0, 5).join(" · "), content: files.join("\n") }); } catch {}
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/sessions") {
          const p = join(CLAUDE_DIR, "PAI", "MEMORY", "STATE", "work.json");
          const c = readSafe(p);
          if (!c) return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
          try { const j = JSON.parse(c); const sessions = Array.isArray(j) ? j : Object.values(j); return new Response(JSON.stringify(sessions.map((s: any) => ({ title: s.task || s.slug || s.sessionId || "Session", meta: `${s.effort || ""} · ${s.phase || ""} · ${s.progress || ""}`, snippet: s.task || s.slug || "", content: JSON.stringify(s, null, 2) }))), { headers: JSON_HEADERS }); } catch { return new Response(JSON.stringify([]), { headers: JSON_HEADERS }); }
        }
        if (reqPath === "/api/knowledge") {
          const baseDir = join(CLAUDE_DIR, "PAI", "MEMORY", "KNOWLEDGE");
          const out: any[] = [];
          for (const cat of ["People", "Companies", "Ideas", "Research"]) {
            const d = join(baseDir, cat);
            for (const f of lsDir(d).filter(n => n.endsWith(".md")).slice(0, 30)) {
              const c = readSafe(join(d, f)); if (!c) continue;
              out.push({ title: f.replace(/\.md$/, ""), meta: cat, snippet: shortSnip(c, 200), content: c });
            }
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/relationships") {
          const dir = join(CLAUDE_DIR, "PAI", "MEMORY", "RELATIONSHIP");
          const out: any[] = [];
          for (const f of lsDir(dir).filter(n => n.endsWith(".md") || n.endsWith(".jsonl"))) {
            const c = readSafe(join(dir, f)); if (!c) continue;
            out.push({ title: f.replace(/\.(md|jsonl)$/, ""), meta: f.endsWith(".jsonl") ? `${c.split("\n").filter(Boolean).length} entries` : "note", snippet: shortSnip(c, 200), content: c.slice(0, 16000) });
          }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
        if (reqPath === "/api/settings") {
          const c = readSafe(join(CLAUDE_DIR, "settings.json"));
          if (!c) return new Response(JSON.stringify([]), { headers: JSON_HEADERS });
          try { const j = JSON.parse(c); const sections = [{ k: "permissions", v: j.permissions }, { k: "hooks", v: j.hooks }, { k: "enabledPlugins", v: j.enabledPlugins }, { k: "daidentity", v: j.daidentity }, { k: "principal", v: j.principal }, { k: "preferences", v: j.preferences }]; return new Response(JSON.stringify(sections.filter(s => s.v != null).map(s => ({ title: s.k, meta: `settings.json :: ${s.k}`, snippet: JSON.stringify(s.v).slice(0, 200), content: JSON.stringify(s.v, null, 2) }))), { headers: JSON_HEADERS }); } catch { return new Response(JSON.stringify([{ title: "settings.json", meta: "raw", snippet: c.slice(0, 200), content: c }]), { headers: JSON_HEADERS }); }
        }
        if (reqPath === "/api/plugins") {
          const pluginsDir = join(CLAUDE_DIR, "plugins");
          const out: any[] = [];
          const known = readSafe(join(pluginsDir, "known_marketplaces.json"));
          if (known) { try { const j = JSON.parse(known); for (const [name, info] of Object.entries(j)) { out.push({ title: name, meta: "marketplace", snippet: (info as any)?.source?.url || "", content: JSON.stringify(info, null, 2) }); } } catch {} }
          const cacheDir = join(pluginsDir, "cache");
          if (existsSync(cacheDir)) { for (const mp of lsDir(cacheDir)) { try { for (const plugin of lsDir(join(cacheDir, mp))) { out.push({ title: `${plugin}@${mp}`, meta: "enabled plugin", snippet: `Cache: plugins/cache/${mp}/${plugin}`, content: `Plugin: ${plugin}\nMarketplace: ${mp}` }); } } catch {} } }
          return new Response(JSON.stringify(out), { headers: JSON_HEADERS });
        }
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message || "Failed" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── Block path traversal ───────────────────────────────────────────
    if (reqPath.includes("..")) {
      return new Response("Forbidden", { status: 403 });
    }

    // ── Static file serving from VIEW_DIR ──────────────────────────────
    let filePath = join(VIEW_DIR, reqPath);

    // Directory: try index.html
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    // Root: serve index.html
    if (reqPath === "/" || reqPath === "") {
      filePath = join(VIEW_DIR, "index.html");
    }

    if (!existsSync(filePath)) {
      return new Response("Not Found", { status: 404 });
    }

    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const fileSize = statSync(filePath).size;

    // Handle Range requests (for audio/video playback)
    const rangeHeader = req.headers.get("range");
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        return new Response(Bun.file(filePath).slice(start, end + 1), {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Content-Length": String(chunkSize),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            ...CORS_HEADERS,
          },
        });
      }
    }

    return new Response(Bun.file(filePath), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
        ...CORS_HEADERS,
      },
    });
  },
});

console.log(`Portal server running on http://0.0.0.0:${PORT}`);
console.log(`Serving portal: ${VIEW_DIR}`);
console.log(`Exchange dir:   ${EXCHANGE_DIR}`);
console.log(`Skills dir:     ${SKILLS_DIR}`);
console.log(`Agents dir:     ${AGENTS_DIR}`);
console.log(`Work dir:       ${WORK_DIR}`);
console.log(`Data dir:       ${DATA_DIR}`);
console.log(`Claude dir:     ${CLAUDE_DIR}`);
