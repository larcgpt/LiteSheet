export interface CellValue {
  v: string | number | boolean | null
  m?: string
  f?: string
  ct?: CellType
  s?: CellStyle
}

export interface CellType {
  t: 'n' | 's' | 'b' | 'd' | 'e'
  fa?: string
}

export interface CellStyle {
  ff?: string
  fs?: number
  fc?: string
  bc?: string
  bl?: number
  it?: number
  ul?: number
  st?: number
  vt?: number
  ht?: number
  tb?: number
  tr?: number
  rt?: number
  ct?: number
  indent?: number
}

export interface WorksheetData {
  name: string
  index: number
  celldata: CellData[]
  row: number
  column: number
  config: WorksheetConfig
}

export interface CellData {
  r: number
  c: number
  v: CellValue
}

export interface WorksheetConfig {
  rowlen?: Record<number, number>
  columnlen?: Record<number, number>
  merge?: Record<string, MergeCell>
  border?: Record<string, BorderInfo>
  frozen?: { row: number; column: number }
  rowhidden?: Record<number, boolean>
}

export interface MergeCell {
  r: number
  c: number
  rs: number
  cs: number
}

export interface BorderInfo {
  style: number
  color: string
}

export interface WorkbookData {
  sheets: WorksheetData[]
  activeSheetIndex: number
}

export interface Selection {
  row: number[]
  column: number[]
}

export interface Point {
  x: number
  y: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export type EventHandler = (...args: any[]) => void

export interface Plugin {
  name: string
  init: (workbook: any) => void
  destroy: () => void
}
