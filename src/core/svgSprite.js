import { readFileSync } from 'node:fs'

function parseSvg(svgText) {
  const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/)
  const pathMatch = svgText.match(/<path[^>]*d="([^"]+)"[^>]*fill="([^"]+)"[^>]*>/)

  if (!viewBoxMatch || !pathMatch) {
    throw new Error('Unsupported SVG sprite asset')
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

function cloneGrid(grid) {
  return grid.map(row => [...row])
}

function fillRect(grid, left, top, width, height, value) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      if (grid[y] && typeof grid[y][x] === 'boolean') {
        grid[y][x] = value
      }
    }
  }
}

function shiftGrid(grid, offsetX, offsetY) {
  const height = grid.length
  const width = grid[0]?.length || 0
  const shifted = Array.from({ length: height }, () => Array(width).fill(false))

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nextX = x + offsetX
      const nextY = y + offsetY
      if (grid[y][x] && shifted[nextY] && typeof shifted[nextY][nextX] === 'boolean') {
        shifted[nextY][nextX] = true
      }
    }
  }

  return shifted
}

function squashFeet(grid) {
  const next = cloneGrid(grid)
  fillRect(next, 4, 21, 4, 3, false)
  fillRect(next, 16, 21, 4, 3, false)
  fillRect(next, 5, 20, 2, 2, true)
  fillRect(next, 17, 20, 2, 2, true)
  return next
}

function renderGridToTerminal(grid) {
  const lines = []

  for (let y = 0; y < grid.length; y += 2) {
    let line = ''
    for (let x = 0; x < grid[0].length; x += 1) {
      const top = Boolean(grid[y]?.[x])
      const bottom = Boolean(grid[y + 1]?.[x])

      if (top && bottom) line += '█'
      else if (top) line += '▀'
      else if (bottom) line += '▄'
      else line += ' '
    }
    lines.push(line)
  }

  return lines
}

function trimVerticalWhitespace(lines) {
  let start = 0
  let end = lines.length - 1

  while (start <= end && !lines[start].trim()) start += 1
  while (end >= start && !lines[end].trim()) end -= 1

  return lines.slice(start, end + 1)
}

export function loadSvgSpriteSet(svgPath) {
  const svgText = readFileSync(svgPath, 'utf8')
  const { width, height, pathData, fill } = parseSvg(svgText)
  const baseGrid = rasterizeEvenOdd(parsePathSubpaths(pathData), width, height)

  const blinkGrid = cloneGrid(baseGrid)
  fillRect(blinkGrid, 6, 8, 2, 3, true)
  fillRect(blinkGrid, 16, 8, 2, 3, true)
  fillRect(blinkGrid, 6, 9, 2, 1, false)
  fillRect(blinkGrid, 16, 9, 2, 1, false)

  // Keep focused shape aligned with source raster silhouette.
  const focusedGrid = cloneGrid(baseGrid)
  const focusedLeftGrid = shiftGrid(baseGrid, -1, 0)
  const focusedRightGrid = shiftGrid(baseGrid, 1, 0)
  const alertGrid = shiftGrid(baseGrid, 1, 0)
  const focusedLiftGrid = shiftGrid(baseGrid, 0, -1)
  const focusedDropGrid = shiftGrid(baseGrid, 0, 1)

  const petGrid = squashFeet(shiftGrid(baseGrid, 1, 0))

  const mutedGrid = cloneGrid(baseGrid)
  fillRect(mutedGrid, 6, 8, 2, 3, false)
  fillRect(mutedGrid, 16, 8, 2, 3, false)
  fillRect(mutedGrid, 6, 9, 2, 1, true)
  fillRect(mutedGrid, 16, 9, 2, 1, true)
  fillRect(mutedGrid, 4, 20, 16, 4, false)

  const renderVariant = grid => trimVerticalWhitespace(renderGridToTerminal(grid))

  return {
    accent: fill,
    variants: {
      idle: renderVariant(baseGrid),
      blink: renderVariant(blinkGrid),
      pet: renderVariant(petGrid),
      alert: renderVariant(alertGrid),
      focused: renderVariant(focusedGrid),
      focused_left: renderVariant(focusedLeftGrid),
      focused_right: renderVariant(focusedRightGrid),
      focused_lift: renderVariant(focusedLiftGrid),
      focused_drop: renderVariant(focusedDropGrid),
      muted: renderVariant(mutedGrid),
    },
  }
}
