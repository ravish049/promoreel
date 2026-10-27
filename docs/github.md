# Pointing promoreel at your app (GitHub or a local folder)

promoreel films **your own app, running on your machine**. It uses your own `gh` login for GitHub, so the kit never sees,
asks for, or stores a token.

## 1. Bring the app in
```bash
gh auth login                                  # once, if you haven't
npx promoreel repo your-name/your-app            # shallow clone → apps/your-app/ (git-ignored)
npx promoreel repo https://github.com/you/app    # same
npx promoreel repo ../your-app                   # or use a folder you already have
```
`repo` prints a summary for you or your agent:
- the README path;
- the framework (Next.js, Vite, SvelteKit, Remix, Nuxt, Astro, Rails, Django, …);
- the package scripts and package manager;
- an `.env.example` if there is one;
- the routes it can find in the file system.

It doesn't install, run or change anything.

## 2. Run it locally
Follow the app's README (`npm install`, `npm run dev`, a seed script). Use **test data and a test account**:
- Credentials go in environment variables (`PROMOREEL_LOGIN_EMAIL`, `PROMOREEL_LOGIN_PASSWORD`), never in files.
- The recorder refuses to sign in to a non-local host unless you set `PROMOREEL_ALLOW_REMOTE_LOGIN=1`.

## 3. Let your agent plan and make the reel
In Claude Code, run `claude` in this repo and ask:

> Make a 35-second promo reel of apps/your-app. Propose a few ideas first.

The `promoreel` skill (`.claude/skills/promoreel/SKILL.md`) walks it through:
1. read the README and routes;
2. suggest 3–5 reel ideas from real flows;
3. write the flow scripts and the question-hook script;
4. record, voice, caption and render;
5. check the frames;
6. report.

Codex reads the same steps from `AGENTS.md`: run `codex` in this repo and ask the same thing.

## 4. Attach the reel to a release (only when you say so)
```bash
gh release create v1.2.0 --repo your-name/your-app --notes "…"         # if the release doesn't exist yet
npx promoreel release projects/your-app --tag v1.2.0 --repo your-name/your-app --dry-run   # shows the gh command
npx promoreel release projects/your-app --tag v1.2.0 --repo your-name/your-app             # uploads out/<id>.mp4
```
This runs `gh release upload` with your login. `--clobber` replaces a file of the same name. The agent instructions
forbid running it unless you ask.

## Notes
- Clones are shallow (`--depth 1`). Delete `apps/<name>` to start over.
- A private repo works the same, if your `gh` login can read it.
- Nothing is pushed anywhere. The kit's own output stays in `projects/<app>/out/`.
