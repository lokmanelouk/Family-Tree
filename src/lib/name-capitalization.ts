export function capitalizeLatinWordStarts(value: string) {
  return value.replace(/(^|[\s'-])([a-z])/g, (_match, separator: string, letter: string) => `${separator}${letter.toUpperCase()}`)
}
