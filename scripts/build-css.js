import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const srcPath = path.join(__dirname, '..', 'style.source.css')
const outPath = path.join(__dirname, '..', 'public', 'style.css')

function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s*([{}:;,])\s*/g, '$1')
        .replace(/;}/g, '}')
        .trim()
}

const src = fs.readFileSync(srcPath, 'utf-8')
fs.writeFileSync(outPath, minifyCss(src))
console.log(`built ${path.relative(process.cwd(), outPath)} from ${path.relative(process.cwd(), srcPath)}`)
