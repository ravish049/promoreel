#!/usr/bin/env node
// Runs the TypeScript CLI (cli/index.ts) through tsx, from any folder: npx promoreel …, npm run promoreel -- …
'use strict'
const path = require('path')
const { spawn } = require('child_process')

const kit = path.resolve(__dirname, '..')
const tsx = path.join(kit, 'node_modules', 'tsx', 'dist', 'cli.mjs')
const child = spawn(process.execPath, [tsx, path.join(kit, 'cli', 'index.ts'), ...process.argv.slice(2)], { stdio: 'inherit' })
child.on('exit', (code, signal) => (signal ? process.kill(process.pid, signal) : process.exit(code ?? 1)))
