export const RELATIONSHIP_PREVIEW_LIMIT = 5

export function isRelationshipSectionCollapsed(kind: string, count: number, override?: boolean) {
  return override ?? (count === 0 || kind === 'siblings')
}

export function getVisibleRelatives<T>(people: T[], showAll: boolean) {
  return showAll ? people : people.slice(0, RELATIONSHIP_PREVIEW_LIMIT)
}

export function pushDetailsNavigation(history: string[], currentId: string) {
  return [...history, currentId]
}

export function popDetailsNavigation(history: string[]) {
  return {
    personId: history.at(-1) ?? null,
    history: history.slice(0, -1),
  }
}
