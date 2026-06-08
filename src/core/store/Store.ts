import { WorkbookData, WorksheetData, CellValue, Selection, MergeCell, CellStyle } from '../../types'

export interface WorkbookState {
  data: WorkbookData
  activeSheetIndex: number
  selection: Selection | null
  selections: Selection[]
  editingCell: { row: number; col: number } | null
}

type StateListener = (state: WorkbookState) => void

export class Store {
  private state: WorkbookState
  private listeners: Set<StateListener> = new Set()
  private history: WorkbookState[] = []
  private historyIndex: number = -1

  constructor(initialData?: WorkbookData) {
    this.state = {
      data: initialData || { sheets: [], activeSheetIndex: 0 },
      activeSheetIndex: 0,
      selection: null,
      selections: [],
      editingCell: null,
    }
    this.saveHistory()
  }

  getState(): Readonly<WorkbookState> {
    return this.state
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.listeners.forEach(listener => listener(this.state))
  }

  private saveHistory(): void {
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push(JSON.parse(JSON.stringify(this.state)))
    this.historyIndex = this.history.length - 1
  }

  getActiveSheet(): WorksheetData | undefined {
    return this.state.data.sheets[this.state.activeSheetIndex]
  }

  getCell(row: number, col: number): CellValue | undefined {
    const sheet = this.getActiveSheet()
    if (!sheet) return undefined
    return sheet.celldata.find(cell => cell.r === row && cell.c === col)?.v
  }

  setCell(row: number, col: number, value: CellValue): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return

    const existingIndex = sheet.celldata.findIndex(
      cell => cell.r === row && cell.c === col
    )

    if (existingIndex >= 0) {
      sheet.celldata[existingIndex].v = value
    } else {
      sheet.celldata.push({ r: row, c: col, v: value })
    }

    this.saveHistory()
    this.notify()
  }

  setActiveSheet(index: number): void {
    if (index >= 0 && index < this.state.data.sheets.length) {
      this.state.activeSheetIndex = index
      this.state.data.activeSheetIndex = index
      this.state.selection = null
      this.state.selections = []
      this.state.editingCell = null
      this.saveHistory()
      this.notify()
    }
  }

  private expandSelectionWithMerge(selection: Selection | null): Selection | null {
    if (!selection) return null
    const sheet = this.getActiveSheet()
    if (!sheet || !sheet.config.merge) return selection

    let [rStart, rEnd] = [selection.row[0], selection.row[1]]
    let [cStart, cEnd] = [selection.column[0], selection.column[1]]

    let expanded = true
    while (expanded) {
      expanded = false
      for (const m of Object.values(sheet.config.merge)) {
        const mRowStart = m.r
        const mRowEnd = m.r + m.rs - 1
        const mColStart = m.c
        const mColEnd = m.c + m.cs - 1

        const intersect = !(
          mRowStart > rEnd ||
          mRowEnd < rStart ||
          mColStart > cEnd ||
          mColEnd < cStart
        )

        if (intersect) {
          const newRStart = Math.min(rStart, mRowStart)
          const newREnd = Math.max(rEnd, mRowEnd)
          const newCStart = Math.min(cStart, mColStart)
          const newCEnd = Math.max(cEnd, mColEnd)

          if (newRStart !== rStart || newREnd !== rEnd || newCStart !== cStart || newCEnd !== cEnd) {
            rStart = newRStart
            rEnd = newREnd
            cStart = newCStart
            cEnd = newCEnd
            expanded = true
          }
        }
      }
    }

    return {
      row: [rStart, rEnd],
      column: [cStart, cEnd]
    }
  }

  setSelection(selection: Selection | null): void {
    const expanded = this.expandSelectionWithMerge(selection)
    this.state.selection = expanded
    this.state.selections = expanded ? [expanded] : []
    this.notify()
  }

  setSelections(selections: Selection[]): void {
    const expandedSelections = selections.map(s => this.expandSelectionWithMerge(s)).filter(Boolean) as Selection[]
    this.state.selections = expandedSelections
    this.state.selection = expandedSelections[expandedSelections.length - 1] || null
    this.notify()
  }

  setEditingCell(cell: { row: number; col: number } | null): void {
    this.state.editingCell = cell
    this.notify()
  }

  setFrozen(row: number, col: number): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    sheet.config.frozen = { row, column: col }
    this.saveHistory()
    this.notify()
  }

  setRowHidden(row: number, hidden: boolean): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    if (!sheet.config.rowhidden) sheet.config.rowhidden = {}
    if (hidden) {
      sheet.config.rowhidden[row] = true
    } else {
      delete sheet.config.rowhidden[row]
    }
    this.saveHistory()
    this.notify()
  }

  insertRow(r: number): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    sheet.celldata.forEach(cell => {
      if (cell.r >= r) cell.r++
    })
    sheet.row++

    if (sheet.config.merge) {
      const newMerge: Record<string, MergeCell> = {}
      Object.entries(sheet.config.merge).forEach(([_, m]) => {
        if (m.r >= r) {
          m.r++
        } else if (m.r + m.rs > r) {
          m.rs++
        }
        newMerge[`${m.r},${m.c}`] = m
      })
      sheet.config.merge = newMerge
    }

    if (sheet.config.rowlen) {
      const newRowLen: Record<number, number> = {}
      Object.entries(sheet.config.rowlen).forEach(([key, len]) => {
        const rowIdx = parseInt(key)
        if (rowIdx >= r) {
          newRowLen[rowIdx + 1] = len
        } else {
          newRowLen[rowIdx] = len
        }
      })
      sheet.config.rowlen = newRowLen
    }

    this.saveHistory()
    this.notify()
  }

  insertCol(c: number): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    sheet.celldata.forEach(cell => {
      if (cell.c >= c) cell.c++
    })
    sheet.column++

    if (sheet.config.merge) {
      const newMerge: Record<string, MergeCell> = {}
      Object.entries(sheet.config.merge).forEach(([_, m]) => {
        if (m.c >= c) {
          m.c++
        } else if (m.c + m.cs > c) {
          m.cs++
        }
        newMerge[`${m.r},${m.c}`] = m
      })
      sheet.config.merge = newMerge
    }

    if (sheet.config.columnlen) {
      const newColLen: Record<number, number> = {}
      Object.entries(sheet.config.columnlen).forEach(([key, len]) => {
        const colIdx = parseInt(key)
        if (colIdx >= c) {
          newColLen[colIdx + 1] = len
        } else {
          newColLen[colIdx] = len
        }
      })
      sheet.config.columnlen = newColLen
    }

    this.saveHistory()
    this.notify()
  }

  deleteRow(r: number): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    sheet.celldata = sheet.celldata.filter(cell => cell.r !== r)
    sheet.celldata.forEach(cell => {
      if (cell.r > r) cell.r--
    })
    sheet.row--

    if (sheet.config.merge) {
      const newMerge: Record<string, MergeCell> = {}
      Object.entries(sheet.config.merge).forEach(([_, m]) => {
        if (m.r === r && m.rs === 1) return
        if (m.r > r) {
          m.r--
        } else if (m.r + m.rs > r) {
          m.rs--
        }
        newMerge[`${m.r},${m.c}`] = m
      })
      sheet.config.merge = newMerge
    }

    if (sheet.config.rowlen) {
      const newRowLen: Record<number, number> = {}
      Object.entries(sheet.config.rowlen).forEach(([key, len]) => {
        const rowIdx = parseInt(key)
        if (rowIdx === r) return
        if (rowIdx > r) {
          newRowLen[rowIdx - 1] = len
        } else {
          newRowLen[rowIdx] = len
        }
      })
      sheet.config.rowlen = newRowLen
    }

    this.saveHistory()
    this.notify()
  }

  deleteCol(c: number): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    sheet.celldata = sheet.celldata.filter(cell => cell.c !== c)
    sheet.celldata.forEach(cell => {
      if (cell.c > c) cell.c--
    })
    sheet.column--

    if (sheet.config.merge) {
      const newMerge: Record<string, MergeCell> = {}
      Object.entries(sheet.config.merge).forEach(([_, m]) => {
        if (m.c === c && m.cs === 1) return
        if (m.c > c) {
          m.c--
        } else if (m.c + m.cs > c) {
          m.cs--
        }
        newMerge[`${m.r},${m.c}`] = m
      })
      sheet.config.merge = newMerge
    }

    if (sheet.config.columnlen) {
      const newColLen: Record<number, number> = {}
      Object.entries(sheet.config.columnlen).forEach(([key, len]) => {
        const colIdx = parseInt(key)
        if (colIdx === c) return
        if (colIdx > c) {
          newColLen[colIdx - 1] = len
        } else {
          newColLen[colIdx] = len
        }
      })
      sheet.config.columnlen = newColLen
    }

    this.saveHistory()
    this.notify()
  }

  sortColumn(c: number, order: 'asc' | 'desc'): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    const rows = new Map<number, Record<number, any>>()
    sheet.celldata.forEach(cell => {
      if (!rows.has(cell.r)) rows.set(cell.r, {})
      rows.get(cell.r)![cell.c] = cell
    })
    const sorted = [...rows.entries()].sort((a, b) => {
      const va = a[1][c]?.v?.v ?? ''
      const vb = b[1][c]?.v?.v ?? ''
      if (typeof va === 'number' && typeof vb === 'number') {
        return order === 'asc' ? va - vb : vb - va
      }
      return order === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va))
    })
    const newCelldata: typeof sheet.celldata = []
    sorted.forEach(([_oldR, cells], newR) => {
      Object.values(cells).forEach((cell: any) => {
        newCelldata.push({ ...cell, r: newR })
      })
    })
    sheet.celldata = newCelldata
    this.saveHistory()
    this.notify()
  }

  mergeCells(selection: Selection): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    if (!sheet.config.merge) sheet.config.merge = {}
    const [rStart, rEnd] = selection.row
    const [cStart, cEnd] = selection.column
    const key = `${rStart},${cStart}`
    sheet.config.merge[key] = {
      r: rStart,
      c: cStart,
      rs: rEnd - rStart + 1,
      cs: cEnd - cStart + 1
    }

    sheet.celldata = sheet.celldata.filter(cell => {
      const inside = cell.r >= rStart && cell.r <= rEnd && cell.c >= cStart && cell.c <= cEnd
      const isTopLeft = cell.r === rStart && cell.c === cStart
      return !inside || isTopLeft
    })

    this.saveHistory()
    this.notify()
  }

  unmergeCells(selection: Selection): void {
    const sheet = this.getActiveSheet()
    if (!sheet || !sheet.config.merge) return
    const [rStart, cStart] = [selection.row[0], selection.column[0]]
    const key = `${rStart},${cStart}`
    delete sheet.config.merge[key]
    this.saveHistory()
    this.notify()
  }

  clearRange(selection: Selection): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    const targets = this.state.selections.length > 0 ? this.state.selections : [selection]

    for (const sel of targets) {
      const [rStart, rEnd] = sel.row
      const [cStart, cEnd] = sel.column

      sheet.celldata.forEach(cell => {
        if (cell.r >= rStart && cell.r <= rEnd && cell.c >= cStart && cell.c <= cEnd) {
          if (cell.v) {
            cell.v.v = null
            delete cell.v.f
            delete cell.v.m
          }
        }
      })
    }

    this.saveHistory()
    this.notify()
  }

  fillRange(source: Selection, target: Selection): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return

    const [sRowStart, sRowEnd] = source.row
    const [sColStart, sColEnd] = source.column
    const [tRowStart, tRowEnd] = target.row
    const [tColStart, tColEnd] = target.column

    const sRowHeight = sRowEnd - sRowStart + 1
    const sColWidth = sColEnd - sColStart + 1

    for (let r = tRowStart; r <= tRowEnd; r++) {
      for (let c = tColStart; c <= tColEnd; c++) {
        if (r >= sRowStart && r <= sRowEnd && c >= sColStart && c <= sColEnd) {
          continue
        }

        const sR = sRowStart + ((r - tRowStart) % sRowHeight)
        const sC = sColStart + ((c - tColStart) % sColWidth)

        const sourceVal = this.getCell(sR, sC)
        if (sourceVal) {
          const copyVal = JSON.parse(JSON.stringify(sourceVal))
          const existingIndex = sheet.celldata.findIndex(cell => cell.r === r && cell.c === c)
          if (existingIndex >= 0) {
            sheet.celldata[existingIndex].v = copyVal
          } else {
            sheet.celldata.push({ r, c, v: copyVal })
          }
        }
      }
    }

    this.saveHistory()
    this.notify()
  }

  setColumnWidth(col: number, width: number, saveHistoryState: boolean = true): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    if (!sheet.config.columnlen) sheet.config.columnlen = {}
    sheet.config.columnlen[col] = width
    if (saveHistoryState) {
      this.saveHistory()
    }
    this.notify()
  }

  setRowHeight(row: number, height: number, saveHistoryState: boolean = true): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return
    if (!sheet.config.rowlen) sheet.config.rowlen = {}
    sheet.config.rowlen[row] = height
    if (saveHistoryState) {
      this.saveHistory()
    }
    this.notify()
  }

  setStyle(selection: Selection, styleUpdater: (style: CellStyle, cell: CellValue) => void): void {
    const sheet = this.getActiveSheet()
    if (!sheet) return

    const targets = this.state.selections.length > 0 ? this.state.selections : [selection]

    for (const sel of targets) {
      for (let r = sel.row[0]; r <= sel.row[1]; r++) {
        for (let c = sel.column[0]; c <= sel.column[1]; c++) {
          const existingIndex = sheet.celldata.findIndex(cell => cell.r === r && cell.c === c)
          let cell: CellValue
          if (existingIndex >= 0) {
            cell = sheet.celldata[existingIndex].v
          } else {
            cell = { v: null }
            sheet.celldata.push({ r, c, v: cell })
          }
          if (!cell.s) cell.s = {}
          styleUpdater(cell.s, cell)
        }
      }
    }
    this.saveHistory()
    this.notify()
  }

  undo(): boolean {
    if (this.historyIndex > 0) {
      this.historyIndex--
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]))
      this.notify()
      return true
    }
    return false
  }

  redo(): boolean {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]))
      this.notify()
      return true
    }
    return false
  }

  loadData(data: WorkbookData): void {
    this.state.data = data
    this.state.activeSheetIndex = data.activeSheetIndex || 0
    this.state.selection = null
    this.state.selections = []
    this.state.editingCell = null
    this.history = []
    this.historyIndex = -1
    this.saveHistory()
    this.notify()
  }

  moveSheet(from: number, to: number): void {
    const sheets = this.state.data.sheets
    if (from < 0 || from >= sheets.length || to < 0 || to >= sheets.length || from === to) return
    const [moved] = sheets.splice(from, 1)
    sheets.splice(to, 0, moved)
    if (this.state.activeSheetIndex === from) this.state.data.activeSheetIndex = to
    else if (from < this.state.activeSheetIndex && to >= this.state.activeSheetIndex) this.state.activeSheetIndex--
    else if (from > this.state.activeSheetIndex && to <= this.state.activeSheetIndex) this.state.activeSheetIndex++
    else this.state.data.activeSheetIndex = this.state.activeSheetIndex
    this.saveHistory()
    this.notify()
  }
}
