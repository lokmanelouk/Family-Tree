const supportedPhotoTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function isSupportedPhotoType(type: string) {
  return supportedPhotoTypes.has(type.toLowerCase())
}
