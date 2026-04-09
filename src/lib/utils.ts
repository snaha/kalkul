import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type WithElementRef<T, El extends HTMLElement = HTMLElement> = T & { ref?: El | null }

export type WithoutChild<T> = T extends { child?: infer _C } ? Omit<T, 'child'> : T
export type WithoutChildrenOrChild<T> = T extends { children?: infer _C; child?: infer _C2 }
  ? Omit<T, 'children' | 'child'>
  : T

export function getYearOptions(count = 50): string[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: count }, (_, i) => String(currentYear + i))
}

export function getMonthOptions(): { value: string; label: string }[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: new Date(2000, i).toLocaleString(undefined, { month: 'long' }),
  }))
}

export function notImplemented() {
  alert('Not implemented yet')
}

export function formatCurrency(value: number, currencyLabel: string): string {
  return `${value.toLocaleString()} ${currencyLabel}`
}

export function calculateAge(
  birthDate: Date | undefined,
  currentYear: number,
  currentMonth: number,
): string {
  if (!birthDate) return ''
  let age = currentYear - birthDate.getFullYear()
  if (currentMonth < birthDate.getMonth()) age--
  return String(age)
}
