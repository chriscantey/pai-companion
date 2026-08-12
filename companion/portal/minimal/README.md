# Minimal portal

The default portal in `../public/` ships a **System hub**: eighteen pages that browse the
assistant's own brain, work, memory, and config by reading PAI v5.0.0's directory layout
(`~/.claude/PAI/SKILLS`, `MEMORY/`, `ALGORITHM/`, and friends).

Those pages are only correct on a PAI v5.0.0 install. On any other system they either sit
empty or describe a structure that isn't there, which is worse than not shipping them.

The minimal portal is the same server, the same theme, the same PWA icon. **Just the parts
that don't know or care what's underneath**:

| Kept | What it is |
|------|------------|
| `/` | Home. Lists every page your assistant creates in `~/portal/`. |
| `/clipboard/` | Text your assistant stages for you to copy on any device. |
| `/exchange/` | File drop, both directions, between your machine and the server. |
| `/shared/` | Favicon, nav, and footer used by the pages above. Required. |

Everything else is dropped: `agents`, `algorithm`, `context`, `hooks`, `identity`, `isas`,
`knowledge`, `observability`, `plugins`, `reflections`, `relationships`, `sessions`,
`settings`, `signals`, `skills`, `system`, `tasks`, `welcome`.

## Install it

**Copy only what you need. Do not install the full portal and delete the difference.**
Several of the System hub's directory names are ordinary words (`tasks`, `settings`,
`knowledge`, `context`, `identity`), so a cleanup `rm -rf` can take a page the user wrote
themselves. Copying only the minimal set can never delete anything.

```bash
mkdir -p ~/portal
cp -r ~/pai-companion/companion/portal/public/clipboard ~/portal/
cp -r ~/pai-companion/companion/portal/public/exchange  ~/portal/
cp -r ~/pai-companion/companion/portal/public/shared    ~/portal/
cp ~/pai-companion/companion/portal/public/manifest.webmanifest ~/portal/
cp ~/pai-companion/companion/portal/public/icon.svg ~/portal/
cp ~/pai-companion/companion/portal/public/icon-192.png ~/portal/
cp ~/pai-companion/companion/portal/public/icon-512.png ~/portal/
cp ~/pai-companion/companion/portal/public/icon-maskable-512.png ~/portal/
cp ~/pai-companion/companion/portal/public/apple-touch-icon.png ~/portal/
cp ~/pai-companion/companion/portal/minimal/index.html ~/portal/index.html

# then the server files and build, exactly as the full install does
cp ~/pai-companion/companion/portal/server.ts ~/portal/server.ts
cp ~/pai-companion/companion/portal/Dockerfile ~/portal/Dockerfile
cp ~/pai-companion/companion/portal/docker-compose.yml ~/portal/docker-compose.yml
cd ~/portal && docker compose up -d --build
```

The homepage is the only file that differs from the full install: it drops the Welcome and
System links from the header, and stops filtering the page list against directories that are
not there.

## Converting an existing full install

Removing pages from a portal that is already running is a judgement call, not a script.
**Look before deleting**, because any of these names might be a page you made:

```bash
ls -la ~/portal/
```

Then remove only the ones you recognise as the companion's, by absolute path:

```bash
rm -rf ~/portal/algorithm ~/portal/isas ~/portal/knowledge      # ...and so on, one at a time
cp ~/pai-companion/companion/portal/minimal/index.html ~/portal/index.html
```

The full set the companion installs is: `agents`, `algorithm`, `context`, `hooks`,
`identity`, `isas`, `knowledge`, `observability`, `plugins`, `reflections`, `relationships`,
`sessions`, `settings`, `signals`, `skills`, `system`, `tasks`, `welcome`. Anything else in
`~/portal/` is yours.

## The API surface does NOT go away, and you should read this

Deleting the pages removes the **UI**, not the routes behind it. `server.ts` is one file
shared by both variants, and it still serves every `/api/*` endpoint. Two of them read your
home directory and neither depends on the layout the deleted pages assumed:

- `GET /api/context/<path>` returns the contents of any file under `~/.claude`, which
  `docker-compose.yml` bind-mounts into the container. It is filtered only by filename, and
  only against credential-shaped names (`.env`, `.key`, `.pem`, `token`, `secret`,
  `credential`). `settings.json` and `CLAUDE.md` are served in full.
- `GET /api/browse?dir=<claude|work|data>` lists those trees.

Nothing authenticates any of this, and the container publishes port 8080 on all interfaces.

**So treat the portal as readable by anything that can reach that port**, and keep it on a
trusted LAN or a private overlay such as [Tailscale](https://tailscale.com/). Do not
port-forward it to the public internet. This is equally true of the full install; it is
called out here because the minimal variant is aimed at people who are not running PAI and
never chose to make `~/.claude` browsable.

**The minimal variant does not need any of it.** Home, clipboard, and exchange read only
`~/portal/` and `~/exchange/`, so delete the other five mounts from
`~/portal/docker-compose.yml` and rebuild. Verified: the container starts, and all three
pages plus the page-listing and exchange APIs keep working.

```yaml
    volumes:
      - ${HOME}/portal:/portal
      - ${HOME}/exchange:/exchange
      # Removed for the minimal install. These fed the System hub, and while they are
      # mounted the /api/context and /api/browse routes can read them:
      #   - ${HOME}/.claude/skills:/skills:ro
      #   - ${HOME}/.claude/agents:/agents:ro
      #   - ${HOME}/work:/work:ro
      #   - ${HOME}/data:/data:ro
      #   - ${HOME}/.claude:/dotclaude:ro
```

## Adding pages back

Copy any directory from `../public/` into `~/portal/` and add it back to the header if you
want a quick link. They're independent.
