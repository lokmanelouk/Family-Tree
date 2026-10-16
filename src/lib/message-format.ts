export type MessagePart = { type: 'text'; value: string } | { type: 'value'; key: string; value: string | number }

export function interpolateMessageParts(template: string, values: Record<string, string | number>): MessagePart[] {
  const parts: MessagePart[] = []
  const pattern = /\{([^{}]+)\}/g
  let cursor = 0
  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) parts.push({ type: 'text', value: template.slice(cursor, index) })
    const key = match[1]
    if (Object.hasOwn(values, key)) parts.push({ type: 'value', key, value: values[key] })
    else parts.push({ type: 'text', value: match[0] })
    cursor = index + match[0].length
  }
  if (cursor < template.length) parts.push({ type: 'text', value: template.slice(cursor) })
  return parts
}
