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

    // ── API: Skills listing ────────────────────────────────────────────
    if (reqPath === "/api/skills") {
      try {
        const skills: { name: string; description: string }[] = [];
        const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "PAI") continue;
          const skillFile = join(SKILLS_DIR, entry.name, "SKILL.md");
          if (!existsSync(skillFile)) continue;
          try {
            const content = readFileSync(skillFile, "utf-8");
            const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
            if (!fmMatch) continue;
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            if (nameMatch && descMatch) {
              // Strip "USE WHEN..." from description for cleaner display
              let desc = descMatch[1].trim();
              const useWhen = desc.indexOf("USE WHEN");
              if (useWhen > 0) desc = desc.substring(0, useWhen).trim().replace(/\.\s*$/, "");
              skills.push({ name: nameMatch[1].trim(), description: desc });
            }
          } catch { /* skip unreadable skills */ }
        }
        skills.sort((a, b) => a.name.localeCompare(b.name));
        return new Response(JSON.stringify(skills), { headers: JSON_HEADERS });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to read skills" }), { status: 500, headers: JSON_HEADERS });
      }
    }

    // ── API: Single skill detail ───────────────────────────────────────
    if (reqPath.startsWith("/api/skill/")) {
      const skillName = reqPath.slice("/api/skill/".length);
      if (!skillName || skillName.includes("..") || skillName.includes("/")) {
        return new Response(JSON.stringify({ error: "Invalid skill name" }), { status: 400, headers: JSON_HEADERS });
      }
      const skillFile = join(SKILLS_DIR, skillName, "SKILL.md");
      if (!existsSync(skillFile)) {
        return new Response(JSON.stringify({ error: "Skill not found" }), { status: 404, headers: JSON_HEADERS });
      }
      try {
        const content = readFileSync(skillFile, "utf-8");
        // List additional files in the skill directory for structure info
        const skillDir = join(SKILLS_DIR, skillName);
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
        return new Response(JSON.stringify({ name: skillName, content, files }), { headers: JSON_HEADERS });
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
        // Algorithm version
        const algLatest = join(SKILLS_DIR, "PAI", "Components", "Algorithm", "LATEST");
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
