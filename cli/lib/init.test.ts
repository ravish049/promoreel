// `promoreel init --style`: each style gets its starter files (a flow only for recorded), the placeholders are filled,
// and the starter spec passes validation against the starter brand; an unknown or missing style is refused.   npm test
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { init } from '../commands/init'
import { loadProject, pickReel } from './project'

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((f) => fs.statSync(path.join(dir, f)).isFile()).map((f) => f.split(path.sep).join('/')).sort()

/** Runs init into a fresh folder with its progress lines kept off the test output. */
async function scaffold(style?: string, dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'promoreel-init-')), 'Acme Notes')): Promise<string> {
  const write = process.stdout.write
  process.stdout.write = (() => true) as typeof process.stdout.write
  try {
    await init(dir, { style, url: 'http://localhost:5173' })
  } finally {
    process.stdout.write = write
  }
  return dir
}

const expected: Record<string, string[]> = {
  recorded: ['README.md', 'brand.json', 'flows/first-flow.flow.json', 'public/sfx/tap.wav', 'reels/first-reel.json'],
  walk: ['README.md', 'brand.json', 'public/sfx/tap.wav', 'reels/walk.json'],
  launch: ['README.md', 'brand.json', 'public/sfx/tap.wav', 'reels/launch.json'],
}

for (const style of [undefined, 'recorded', 'walk', 'launch']) {
  test(`init ${style ? `--style ${style}` : '(no style)'} writes its starter files, filled in and valid`, async () => {
    const dir = await scaffold(style)
    try {
      assert.deepEqual(files(dir), expected[style ?? 'recorded'])
      for (const f of files(dir).filter((x) => /\.(json|md)$/.test(x))) assert.doesNotMatch(fs.readFileSync(path.join(dir, f), 'utf8'), /\{\{\w+\}\}/, `${f} still has a placeholder`)
      const p = loadProject(dir)
      assert.equal(p.brand.name, 'Acme Notes')
      const { spec } = pickReel(p, undefined) // validates against the brand
      assert.equal(spec.style ?? 'recorded', style ?? 'recorded')
    } finally {
      fs.rmSync(path.dirname(dir), { recursive: true, force: true })
    }
  })
}

test('init refuses an unknown style before writing anything', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'promoreel-init-')), 'x')
  try {
    await assert.rejects(scaffold('reel', dir), /--style must be one of recorded, walk, launch/)
    assert.equal(fs.existsSync(dir), false)
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true })
  }
})

test('a bare --style is refused, not read as the recorded default', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'promoreel-init-')), 'x')
  try {
    await assert.rejects(scaffold('', dir), /--style needs a value/)
    // through the CLI: `promoreel init <dir> --style` (nothing after it) and `--style --force`
    const cli = path.join(__dirname, '..', '..', 'bin', 'promoreel.cjs')
    for (const args of [['--style'], ['--style', '--force'], ['--style=']]) {
      const r = spawnSync(process.execPath, [cli, 'init', dir, ...args, '--json'], { encoding: 'utf8' })
      assert.equal(r.status, 1, `${args.join(' ')}: exits 1`)
      assert.match(r.stdout, /--style needs a value/, `${args.join(' ')}: says why`)
    }
    assert.equal(fs.existsSync(dir), false)
  } finally {
    fs.rmSync(path.dirname(dir), { recursive: true, force: true })
  }
})
