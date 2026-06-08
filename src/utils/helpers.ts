export function getColumnName(col: number): string {
  let name = ''
  let c = col
  while (c >= 0) {
    name = String.fromCharCode(65 + (c % 26)) + name
    c = Math.floor(c / 26) - 1
  }
  return name
}

export function parseCellRef(ref: string): [number, number] | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/)
  if (!match) return null

  const colStr = match[1]
  const rowStr = match[2]

  let col = 0
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64)
  }
  col -= 1

  const row = parseInt(rowStr) - 1
  return [row, col]
}

export function cellRefToString(row: number, col: number): string {
  return `${getColumnName(col)}${row + 1}`
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15)
}
