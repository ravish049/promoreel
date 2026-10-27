// promoreel repo <owner/repo | github URL | local path> [--dir apps/<name>]
// Points the kit at the developer's own app. A GitHub repo is cloned with the developer's own `gh` login (the kit never
// sees or stores a token) into apps/<name>/ (git-ignored); a local path is used where it is. Then it prints what an
// agent needs to plan reels: the README, how to run the app, the framework, and the routes it can find.
// It never starts the app or installs anything: the agent (or you) does that, after reading the README.
import fs from 'node:fs'
import path from 'node:path'
import { KIT } from '../lib/project'
import { step } from '../lib/progress'
import { has, run } from '../lib/sh'

const ROUTE_DIRS = ['app', 'src/app', 'pages', 'src/pages', 'src/routes', 'app/routes', 'routes']
const PAGE_FILE = /^(page|index|\+page)\.(tsx|ts|jsx|js|svelte|vue|astro|mdx)$|^[^_.][^/]*\.(tsx|jsx|vue|svelte|astro)$/

function detectFramework(pkg: Record<string, Record<string, string>> | null, dir: string): string {
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
  const pick = [
    ['next', 'Next.js'],
    ['@remix-run/react', 'Remix'],
    ['@sveltejs/kit', 'SvelteKit'],
    ['nuxt', 'Nuxt'],
    ['astro', 'Astro'],
    ['@angular/core', 'Angular'],
    ['vite', 'Vite'],
    ['react-scripts', 'Create React App'],
    ['express', 'Express'],
  ].find(([d]) => deps[d])
  if (pick) return pick[1]
  if (fs.existsSync(path.join(dir, 'Gemfile'))) return 'Ruby (Rails?)'
  if (fs.existsSync(path.join(dir, 'manage.py'))) return 'Django'
  if (fs.existsSync(path.join(dir, 'composer.json'))) return 'PHP (Laravel?)'
  return 'unknown'
}

/** File-system routes (Next app/ and pages/, SvelteKit, Remix, Nuxt): URL paths guessed from folder names. */
function findRoutes(dir: string): string[] {
  const routes = new Set<string>()
  for (const rd of ROUTE_DIRS) {
    const root = path.join(dir, rd)
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) continue
    const walk = (d: string, depth: number) => {
      if (depth > 6 || routes.size > 200) return
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'api' || e.name === 'components') continue
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p, depth + 1)
        else if (PAGE_FILE.test(e.name)) {
          let r = '/' + path.relative(root, d).split(path.sep).join('/')
          if (!/^(page|index|\+page)\./.test(e.name)) r = (r === '/' ? '' : r) + '/' + e.name.replace(/\.[^.]+$/, '')
          // (group) folders don't show in the URL
          r = r.replace(/\/\([^)]+\)/g, '').replace(/\/+/g, '/').replace(/\/$/, '') || '/'
          routes.add(r)
        }
      }
    }
    walk(root, 0)
  }
  return [...routes].sort()
}

export async function repo(target: string | undefined, opts: { dir?: string }) {
  const st = step('repo')
  if (!target) throw new Error('usage: promoreel repo <owner/repo | https://github.com/owner/repo | ./local/path>')
  let dir: string
  if (fs.existsSync(target)) {
    dir = path.resolve(target)
    st.start(`using the local folder ${dir}`)
  } else {
    const m = /^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(target)
    if (!m) throw new Error(`"${target}" is neither a folder nor owner/repo`)
    if (!has('gh')) throw new Error('the GitHub CLI is required to clone: https://cli.github.com, then gh auth login')
    try {
      run('gh', ['auth', 'status'])
    } catch {
      throw new Error('gh is not signed in: run gh auth login (promoreel uses your gh session and never stores a token)')
    }
    dir = path.resolve(opts.dir ?? path.join(KIT, 'apps', m[2]))
    if (fs.existsSync(dir)) st.start(`${m[1]}/${m[2]} is already cloned at ${dir}`)
    else {
      st.start(`cloning ${m[1]}/${m[2]} with your gh login`)
      fs.mkdirSync(path.dirname(dir), { recursive: true })
      run('gh', ['repo', 'clone', `${m[1]}/${m[2]}`, dir, '--', '--depth', '1'])
    }
  }
  st.progress(50, 'reading the app')
  const pkgFile = path.join(dir, 'package.json')
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : null
  const readme = ['README.md', 'readme.md', 'README.MD', 'README'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f))
  const envExample = ['.env.example', '.env.sample', '.env.local.example'].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f))
  const summary = {
    dir,
    readme: readme ?? null,
    framework: detectFramework(pkg, dir),
    scripts: pkg?.scripts ?? {},
    packageManager: fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm' : fs.existsSync(path.join(dir, 'yarn.lock')) ? 'yarn' : fs.existsSync(path.join(dir, 'bun.lockb')) ? 'bun' : pkg ? 'npm' : null,
    envExample: envExample ?? null,
    routes: findRoutes(dir),
    next: 'Read the README, run the app locally with a TEST account, then propose 3–5 reel ideas from real flows (see .claude/skills/promoreel/SKILL.md).',
  }
  st.done(`${summary.framework} app, ${summary.routes.length} route(s) found`, summary)
}
