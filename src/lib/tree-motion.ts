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
  return createSvgPathInterpolator(from, to)?.(progress) ?? null
}

export function getRemovedMemberIds(previousIds: string[], nextIds: string[]) {
  const next = new Set(nextIds)
  return previousIds.filter((id) => !next.has(id))
}

export function getExitAnimationIds(removedIds: string[], selectedId: string | null) {
  if (removedIds.length === 1) return removedIds
  return selectedId && removedIds.includes(selectedId) ? [selectedId] : []
}

export function getStableConnectorSegments(paths: string[], childIds: string[]) {
  const firstChildPathIndex = paths.length - childIds.length
  return paths.map((path, index) => {
    if (index === 0) return { key: 'parent-stem', path, childId: null }
    if (index < firstChildPathIndex) return { key: 'child-bus', path, childId: null }
    const childId = childIds[index - firstChildPathIndex] ?? null
    return { key: childId ? `child-${childId}` : `child-${index}`, path, childId }
  })
}

export function removeMotionArtifactOnFinishOrCancel(animation: Animation, artifact: Pick<Element, 'remove'>) {
  const remove = () => artifact.remove()
  animation.onfinish = remove
  animation.oncancel = remove
}

export function createSvgPathInterpolator(from: string, to: string) {
  const start = tokenizePath(from)
  const end = tokenizePath(to)
  if (!start || !end || start.length !== end.length) return null
  if (start.some((token, index) => token.command !== end[index].command || (token.command === null) !== (end[index].command === null))) return null
  const values = start.map((token, index) => token.command === null
    ? { from: token.value!, delta: end[index].value! - token.value! }
    : null)
  return (progress: number) => {
    if (progress <= 0) return from
    if (progress >= 1) return to
    return start.map((token, index) => {
      if (token.command !== null) return token.command
      const value = values[index]!
      return formatPathNumber(value.from + value.delta * progress)
    }).join(' ')
  }
}
