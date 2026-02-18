# Steering Rules Additions

> Append this content to `~/.claude/skills/PAI/USER/AISTEERINGRULES.md` during setup.
> Replace `{VM_IP}` with the actual VM IP address.

---

## Visual-First Output

Statement
: When generating reports, dashboards, or styled content, write HTML to `~/portal/{tag}/` and provide URL. Prefer visual output over terminal text dumps for anything the user will want to read or share.

Bad
: User asks for a comparison of password managers. AI dumps a huge markdown table in the terminal.

Correct
: AI creates `~/portal/password-managers/index.html` with a styled comparison page and provides `http://{VM_IP}:8080/password-managers/`.

---

## Plain Language

Statement
: Explain CLI output in plain language. Avoid jargon. Define terms when first used. This user may be new to the command line.

Bad
: "The EACCES error on port 80 indicates insufficient privileges for binding to privileged ports."

Correct
: "Port 80 requires admin access, which we don't have. I'll use port 8080 instead, which works fine."

---

## Directory Discipline

Statement
: Never create files in `~/.claude/` except PAI system files. Use `~/work/` for projects, `~/portal/` for web content, `~/exchange/` for file sharing, `~/data/` for persistent storage.

Bad
: AI creates a project folder inside `~/.claude/my-project/`.

Correct
: AI creates the project at `~/work/my-project/`.

---

## URL Always

Statement
: Always provide the full URL using the VM IP (from `~/.vm-ip`) when creating portal content. Never use localhost or 127.0.0.1 in URLs shown to the user.

Bad
: "I've created the page at http://localhost:8080/weather/"

Correct
: "I've created the page at http://{VM_IP}:8080/weather/"

---

## Clipboard Pattern

Statement
: When user needs copyable text (emails, messages, code snippets), write to the clipboard page and provide URL. The clipboard has a one-click copy button that works in the browser.

Bad
: User asks to draft an email. AI just prints it in the terminal where it's hard to copy.

Correct
: AI shows the email in chat AND writes it to `~/portal/clipboard/index.html`, then provides `http://{VM_IP}:8080/clipboard/`.

---

## Exchange Pattern

Statement
: When user needs to share or access a file, use `~/exchange/` and explain how to access it in the browser at the exchange URL.

Bad
: AI puts files in random locations and tells user to use scp.

Correct
: AI places the file in `~/exchange/`, tells user to visit `http://{VM_IP}:8080/exchange/` to download it.

---

## Portal-First Delivery

Statement
: Default to creating styled HTML pages in portal rather than dumping text in the terminal. The user can always view portal pages from their host machine's browser.

Bad
: User asks for a weekly meal plan. AI prints 50 lines of text in the terminal.

Correct
: AI creates `~/portal/meal-plan/index.html` with a styled page and provides the URL.

---

## Explain What You Did

Statement
: After completing tasks, summarize in plain language what was done and where results are. Don't assume the user knows what happened.

Bad
: AI runs 10 commands and says "Done."

Correct
: AI says "I created a comparison page for password managers. You can view it here: http://{VM_IP}:8080/password-managers/. I compared 5 options based on price, features, and security."

---

## Learning Mode

Statement
: When the user asks "how" or "why", take time to explain the CLI concepts involved. This is an opportunity to teach.

Bad
: User asks "how did you do that?" AI says "I used grep."

Correct
: AI explains: "I used a tool called grep, which searches through file contents for specific text. Think of it like Ctrl+F but for your entire computer."

---

## Bun Preference

Statement
: Use Bun for all JavaScript/TypeScript work. It's already installed and is the preferred runtime.

Bad
: AI runs `npm install express` then `node server.js`.

Correct
: AI writes a Bun-native server or runs `bun add` and `bun run`.

---

## Server Binding

Statement
: Bind web servers to `0.0.0.0` (all interfaces) and use the VM IP from `~/.vm-ip` for URLs shown to the user. Binding to localhost only makes servers inaccessible from the host machine.

Bad
: AI starts a server on `localhost:3000`. User can't access it from their Mac.

Correct
: AI starts a server on `0.0.0.0:3000` and tells user to visit `http://{VM_IP}:3000/`.

---

## Use the Dark Theme for HTML Output

Statement
: When generating HTML for `~/portal/` or any web-viewable content, use the dark theme color palette from `USER/DESIGN.md`. Do not invent new color schemes.

Bad
: AI creates a dashboard with random blues and grays that doesn't match existing pages.

Correct
: AI references DESIGN.md, uses `--bg-primary: #0d1220`, `--cyan: #12c2e9`, etc.
