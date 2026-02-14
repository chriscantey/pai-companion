# Identity Additions

> Append this content to `~/.claude/skills/PAI/USER/IDENTITY.md` during setup.
> Replace `{VM_IP}` with the actual VM IP address detected during Phase 1.

---

## Host Environment

**VM IP Address:** `{VM_IP}` (detected automatically, stored in `~/.vm-ip`)

Use this IP when providing URLs (not localhost/127.0.0.1). The user accesses this VM from their host machine's browser.

**Server Protocol:** HTTP (no TLS needed for local network VM)

---

## File Exchange

Three tiers for sharing content:

| Tier | Location | Access | Use Case |
|------|----------|--------|----------|
| **Portal** | `~/portal/` | HTTP `:8080` | Dashboards, reports, styled pages |
| **Exchange** | `~/exchange/` | HTTP `:8080/exchange/` | File upload/download |
| **Clipboard** | `~/portal/clipboard/` | HTTP `:8080/clipboard/` | Copyable text |

### Portal (Web Content)
**Location:** `~/portal/`
**URL:** `http://{VM_IP}:8080/{tag}/`

Write to `~/portal/{tag}/index.html`, provide URL to user. Use the dark theme from `USER/DESIGN.md`.

### Exchange (File Sharing)
**Location:** `~/exchange/`
**URL:** `http://{VM_IP}:8080/exchange/`

For sharing files between the user and the assistant. User can drag-and-drop files via browser. Assistant can read/write files directly.

### Clipboard (Copyable Text)
**Location:** `~/portal/clipboard/index.html`
**URL:** `http://{VM_IP}:8080/clipboard/`

When the user needs to copy text (emails, messages, code), write it to the clipboard page and provide the URL. The page has a one-click copy button.

**Clipboard is a persistent tool.** Never delete the folder.

---

## Directory Structure

| Location | Purpose |
|----------|---------|
| `~/portal/` | Web content via HTTP :8080 |
| `~/exchange/` | File exchange via HTTP :8080/exchange/ |
| `~/work/` | Active projects |
| `~/data/` | Persistent data storage |
| `~/upstream/` | External reference repos (read-only) |

---

## Sudo Constraints

I cannot run `sudo` commands (not available without password).

**Planning implication:** When elevated privileges are needed, present the sudo commands the user needs to run manually, then continue after confirmation.

---

## Dependency Management

### Runtime Preference (in order)
1. **Bun** (strongly preferred, already installed)
2. **npm/node** - Only if project requires it
3. **Python** - When JS isn't appropriate

### JavaScript/TypeScript (Bun)
```bash
bun add <package>      # Not: npm install
bun run <script>       # Not: npm run
bunx <tool>            # Not: npx
```

---

## Upstream References

| Location | Purpose |
|----------|---------|
| `~/upstream/pai/` | Upstream PAI (read-only reference) |
| `~/upstream/TheAlgorithm/` | The Algorithm spec (read-only reference) |
| `~/.claude/` | Our customized PAI implementation |

When asked to check for updates, pull latest in `~/upstream/` and compare with the installed version.

---

## Output Formatting

### Copyable Text (Emails, Messages)

1. Show text in chat
2. Write to `~/portal/clipboard/index.html` with copy button
3. Provide URL: `http://{VM_IP}:8080/clipboard/`
