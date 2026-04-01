import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')
const mascotPath = join(projectRoot, 'assets', 'claude-mascot.svg')
const editorHtmlPath = join(projectRoot, 'web', 'pixel-editor', 'index.html')

const WIDTH = 24
const HEIGHT = 24

function parseSvg(svgText) {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/)
  const pathMatch = svgText.match(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*>/)

  if (!viewBoxMatch || !pathMatch) {
    throw new Error('Unsupported mascot SVG format')
  }

  const [, viewBoxText] = viewBoxMatch
  const [, pathData, fill] = pathMatch
  const [, , width, height] = viewBoxText.split(/\s+/).map(Number)
  return { width, height, pathData, fill }
}

function tokenizePath(pathData) {
  return pathData.match(/[MmHhVvZz]|-?\d*\.?\d+/g) || []
}

function parsePathSubpaths(pathData) {
  const tokens = tokenizePath(pathData)
  const subpaths = []
  let cursorX = 0
  let cursorY = 0
  let startX = 0
  let startY = 0
  let index = 0

  while (index < tokens.length) {
    const token = tokens[index]
    index += 1

    if (token === 'M' || token === 'm') {
      let x = Number(tokens[index])
      let y = Number(tokens[index + 1])
      index += 2

      if (token === 'm') {
        x += cursorX
        y += cursorY
      }

      cursorX = x
      cursorY = y
      startX = x
      startY = y
      subpaths.push([[cursorX, cursorY]])
      continue
    }

    if (token === 'H' || token === 'h') {
      let x = Number(tokens[index])
      index += 1
      if (token === 'h') x += cursorX
      cursorX = x
      subpaths.at(-1).push([cursorX, cursorY])
      continue
    }

    if (token === 'V' || token === 'v') {
      let y = Number(tokens[index])
      index += 1
      if (token === 'v') y += cursorY
      cursorY = y
      subpaths.at(-1).push([cursorX, cursorY])
      continue
    }

    if (token === 'Z' || token === 'z') {
      const current = subpaths.at(-1)
      const [lastX, lastY] = current.at(-1)
      if (lastX !== startX || lastY !== startY) {
        current.push([startX, startY])
      }
      continue
    }

    throw new Error(`Unsupported SVG path command: ${token}`)
  }

  return subpaths
}

function pointInPolygon(x, y, polygon) {
  let inside = false
  for (let index = 0; index < polygon.length - 1; index += 1) {
    const [x1, y1] = polygon[index]
    const [x2, y2] = polygon[index + 1]
    const crosses = (y1 > y) !== (y2 > y)
    if (!crosses) continue
    const edgeX = ((x2 - x1) * (y - y1)) / (y2 - y1) + x1
    if (x < edgeX) inside = !inside
  }
  return inside
}

function rasterizeEvenOdd(subpaths, width, height) {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      let filled = false
      for (const polygon of subpaths) {
        if (pointInPolygon(x + 0.5, y + 0.5, polygon)) {
          filled = !filled
        }
      }
      return filled
    }),
  )
}

function loadMascotState() {
  const svgText = readFileSync(mascotPath, 'utf8')
  const { width, height, pathData, fill } = parseSvg(svgText)
  const pixels = rasterizeEvenOdd(parsePathSubpaths(pathData), width, height)
  return { width, height, fill, pixels }
}

function pixelsToPathData(pixels) {
  const commands = []
  for (let y = 0; y < HEIGHT; y += 1) {
    let x = 0
    while (x < WIDTH) {
      if (!pixels[y][x]) {
        x += 1
        continue
      }

      let end = x + 1
      while (end < WIDTH && pixels[y][end]) end += 1
      commands.push(`M${x} ${y}H${end}V${y + 1}H${x}V${y}Z`)
      x = end
    }
  }
  return commands.join('')
}

function saveMascotState({ fill, pixels }) {
  const pathData = pixelsToPathData(pixels)
  const svg = `<svg height="1em" style="flex:none;line-height:1" viewBox="0 0 24 24" width="1em" xmlns="http://www.w3.org/2000/svg"><title>Antigravity</title><path clip-rule="evenodd" d="${pathData}" fill="${fill}" fill-rule="evenodd"></path></svg>\n`
  writeFileSync(mascotPath, svg, 'utf8')
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(JSON.parse(raw || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function validatePayload(payload) {
  if (!payload || typeof payload !== 'object') return false
  if (typeof payload.fill !== 'string') return false
  if (!Array.isArray(payload.pixels) || payload.pixels.length !== HEIGHT) return false
  return payload.pixels.every(
    row => Array.isArray(row) && row.length === WIDTH && row.every(cell => typeof cell === 'boolean'),
  )
}

function sendJson(res, statusCode, value) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(value))
}

const server = createServer(async (req, res) => {
  const method = req.method || 'GET'
  const url = req.url || '/'

  if (method === 'GET' && (url === '/' || url.startsWith('/?'))) {
    const html = readFileSync(editorHtmlPath, 'utf8')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }

  if (method === 'GET' && url === '/api/state') {
    try {
      sendJson(res, 200, loadMascotState())
    } catch (error) {
      sendJson(res, 500, { error: String(error) })
    }
    return
  }

  if (method === 'POST' && url === '/api/state') {
    try {
      const payload = await parseJsonBody(req)
      if (!validatePayload(payload)) {
        sendJson(res, 400, { error: 'Invalid payload' })
        return
      }
      saveMascotState(payload)
      sendJson(res, 200, { ok: true })
    } catch (error) {
      sendJson(res, 500, { error: String(error) })
    }
    return
  }

  sendJson(res, 404, { error: 'Not found' })
})

const port = Number(process.env.BUDDY_PIXEL_EDITOR_PORT || 4310)
server.listen(port, '127.0.0.1', () => {
  console.log(`Pixel editor running at http://127.0.0.1:${port}`)
  console.log(`Editing: ${mascotPath}`)
})
