export const appThemes = ["midnight", "warm-light", "chocolate"] as const;

export type AppTheme = (typeof appThemes)[number];

export function isAppTheme(value: string | null): value is AppTheme {
  return appThemes.some((theme) => theme === value);
}
