const PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi

function tokenizePath(path: string) {
  const tokens = path.match(PATH_TOKEN)
  if (!tokens) return null
  return tokens.map((token) => /^[A-Za-z]$/.test(token)
    ? { command: token, value: null }
    : { command: null, value: Number(token) })
}

function formatPathNumber(value: number) {
  const rounded = Math.round(value * 1000) / 1000
  return Object.is(rounded, -0) ? '0' : String(rounded)
}

export function interpolateSvgPath(from: string, to: string, progress: number) {
  const start = tokenizePath(from)
  const end = tokenizePath(to)
  if (!start || !end || start.length !== end.length) return null
  if (start.some((token, index) => token.command !== end[index].command || (token.command === null) !== (end[index].command === null))) return null
  if (progress <= 0) return from
  if (progress >= 1) return to
  return start.map((token, index) => token.command ?? formatPathNumber(token.value! + (end[index].value! - token.value!) * progress)).join(' ')
}
