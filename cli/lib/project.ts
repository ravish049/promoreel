// A project is a folder with a brand.json, its reels (reels/<id>.json) and its flows (flows/<name>.flow.json):
//
//   my-app/
//     brand.json            colours, font, logo, photo, the outro's features and voice
//     reels/launch.json     a reel spec: lines, scenes, clips, camera moves
//     flows/signup.flow.json  what the recorder does in the app
//     public/               logo + photo you add; videos/, vo/, sfx/ the CLI writes (Remotion serves this folder)
//     out/                  renders, contact sheets, manifest.json
import fs from 'node:fs'
import path from 'node:path'
import type { Brand, ReelSpec, PhoneScene, ShowcaseScene } from '../../src/reel/spec'
import { resolveSpec, type Resolved } from '../../src/reel/shared'

/** The kit's own folder (where package.json is). */
export const KIT = path.resolve(__dirname, '..', '..')

export type Project = {
  dir: string
  name: string
  brand: Brand
  publicDir: string
  outDir: string
  reels: { id: string; file: string }[]
}

export function readJson<T>(file: string): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T
  } catch (e) {
    throw new Error(`could not read ${file}: ${(e as Error).message}`)
  }
}

export function loadProject(dirArg: string | undefined): Project {
  if (!dirArg) throw new Error('which project? Pass its folder, e.g. examples/generic')
  const dir = path.resolve(dirArg)
  const brandFile = path.join(dir, 'brand.json')
  if (!fs.existsSync(brandFile)) throw new Error(`${dirArg} is not a project: no brand.json (create one with: promoreel init ${dirArg})`)
  const brand = readJson<Brand>(brandFile)
  for (const k of ['ink', 'paper', 'accent'] as const) if (!brand.colors?.[k]) throw new Error(`brand.json: colors.${k} is required`)
  if (!Array.isArray(brand.features)) brand.features = []
  if (!brand.outro) throw new Error('brand.json: outro { title, cta, lines } is required')
  const reelsDir = path.join(dir, 'reels')
  const reels = fs.existsSync(reelsDir)
    ? fs
        .readdirSync(reelsDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => ({ id: readJson<ReelSpec>(path.join(reelsDir, f)).id, file: path.join(reelsDir, f) }))
    : []
  return { dir, name: path.basename(dir), brand, publicDir: path.join(dir, 'public'), outDir: path.join(dir, 'out'), reels }
}

/** The reel to work on: --reel <id>, or the project's only reel. */
export function pickReel(p: Project, id: string | undefined): { spec: ReelSpec; file: string } {
  if (p.reels.length === 0) throw new Error(`${p.name} has no reels: add one to ${path.join(p.dir, 'reels')}/`)
  const r = id ? p.reels.find((x) => x.id === id || path.basename(x.file, '.json') === id) : p.reels.length === 1 ? p.reels[0] : null
  if (!r) throw new Error(id ? `no reel "${id}" in ${p.name} (has: ${p.reels.map((x) => x.id).join(', ')})` : `${p.name} has several reels; pick one with --reel (${p.reels.map((x) => x.id).join(', ')})`)
  const spec = readJson<ReelSpec>(r.file)
  validateSpec(spec, r.file)
  return { spec, file: r.file }
}

/** Fail early, with the reason, on the mistakes a hand-written or agent-written spec usually has. */
export function validateSpec(spec: ReelSpec, file: string) {
  const where = path.basename(file)
  if (!spec.id) throw new Error(`${where}: "id" is required`)
  if (!spec.voice?.use) throw new Error(`${where}: voice.use is required (e.g. "af_heart" or "chatterbox")`)
  const ids = new Set(spec.lines.map((l) => l.id))
  for (const s of spec.scenes) {
    const ls = (s as { lines?: { id: string }[] }).lines ?? []
    for (const l of ls) if (!ids.has(l.id)) throw new Error(`${where}: scene "${s.id}" uses line "${l.id}", which is not in "lines"`)
  }
  for (const l of spec.lines) if (/…|\.\.\./.test(l.say)) process.stderr.write(`note: ${where} line "${l.id}" has an ellipsis; TTS often pauses oddly there. Use "|" for a breath instead.\n`)
}

/** The spec with its brand merged in and project-relative media staged into public/, ready to be Remotion's props. */
export function buildProps(p: Project, spec: ReelSpec): Resolved {
  const r = resolveSpec(spec, p.brand)
  r.scenes = r.scenes.map((s) => {
    if (s.type !== 'showcase') return s
    const sc = s as ShowcaseScene
    return { ...sc, src: stage(p, sc.src) }
  })
  return r
}

/** A showcase `src` may point outside public/ (e.g. "../generic/out/todo.mp4"): copy it to public/_staged/ and use that. */
function stage(p: Project, src: string): string {
  const inPublic = path.join(p.publicDir, src)
  if (!src.startsWith('.') && fs.existsSync(inPublic)) return src
  const abs = path.resolve(p.dir, src)
  if (!fs.existsSync(abs)) throw new Error(`showcase src "${src}" not found (looked in public/ and relative to ${p.dir})`)
  const rel = `_staged/${path.basename(abs)}`
  const dst = path.join(p.publicDir, rel)
  fs.mkdirSync(path.dirname(dst), { recursive: true })
  if (!fs.existsSync(dst) || fs.statSync(dst).mtimeMs < fs.statSync(abs).mtimeMs) fs.copyFileSync(abs, dst)
  return rel
}

/** The kit's shared files every project's public/ needs (the tap sound). */
export function ensurePublic(p: Project) {
  const sfx = path.join(p.publicDir, 'sfx', 'tap.wav')
  if (!fs.existsSync(sfx)) {
    fs.mkdirSync(path.dirname(sfx), { recursive: true })
    fs.copyFileSync(path.join(KIT, 'assets', 'sfx', 'tap.wav'), sfx)
  }
}

/** The folders under public/ whose recordings a reel's phone scenes use. */
export function clipsDirsOf(spec: ReelSpec): string[] {
  return [...new Set(spec.scenes.filter((s) => s.type === 'phone').map((s) => (s as PhoneScene).clipsDir))]
}

export const rel = (p: Project, abs: string) => path.relative(p.dir, abs).split(path.sep).join('/')
