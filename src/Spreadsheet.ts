import { EventBus, Events } from './core/events/EventBus'
import { Store } from './core/store/Store'
import { CanvasRenderer } from './rendering/canvas/CanvasRenderer'
import { JSFormulaEngine } from './formula/FormulaEngine'
import { WorkbookData, WorksheetData, CellValue, Selection } from './types'

export interface SpreadsheetOptions {
  container: string | HTMLElement
  data?: WorkbookData
  width?: number
  height?: number
  readOnly?: boolean
}

export class Spreadsheet {
  private container: HTMLElement
  private canvas!: HTMLCanvasElement
  private editor: HTMLTextAreaElement | null = null
  private store: Store
  private events: EventBus
  private renderer: CanvasRenderer
  private formulaEngine: JSFormulaEngine
  private options: SpreadsheetOptions
  private isEditing: boolean = false

  constructor(options: SpreadsheetOptions) {
    this.options = options
    this.container = typeof options.container === 'string'
      ? document.getElementById(options.container)!
      : options.container

    this.store = new Store(options.data)
    this.events = new EventBus()
    this.formulaEngine = new JSFormulaEngine()
    this.renderer = new CanvasRenderer(this.createCanvas())
    this.renderer.setFormulaEngine(this.formulaEngine)

    this.setupEventListeners()
    this.loadInitialData()
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    this.container.appendChild(canvas)
    this.canvas = canvas
    return canvas
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('dblclick', this.handleDblClick.bind(this))
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this))
    window.addEventListener('resize', this.handleResize.bind(this))
    document.addEventListener('keydown', this.handleKeydown.bind(this))

    this.store.subscribe(state => {
      this.syncFormula()
      const sheet = state.data.sheets[state.activeSheetIndex]
      if (sheet) {
        this.renderer.setSheet(sheet)
      }
      this.renderer.setSelections(state.selections)
    })
  }

  private syncFormula(): void {
    this.formulaEngine.clear()
    const sheet = this.store.getActiveSheet()
    if (!sheet) return
    sheet.celldata.forEach(cell => {
      this.formulaEngine.setCell(cell.r, cell.c, cell.v)
    })
  }

  private loadInitialData(): void {
    this.syncFormula()
    const state = this.store.getState()
    if (state.data.sheets.length > 0) {
      const sheet = state.data.sheets[state.activeSheetIndex]
      this.renderer.setSheet(sheet)
      this.events.emit(Events.WORKBOOK_LOAD, state.data)
    }
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const cell = this.renderer.getCellAtPoint(x, y)
    if (cell) {
      this.store.setSelection({
        row: [cell.row, cell.row],
        column: [cell.col, cell.col],
      })
      this.events.emit(Events.CELL_CLICK, cell.row, cell.col)
    }
  }

  private handleDblClick(e: MouseEvent): void {
    if (this.options.readOnly) return

    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const cell = this.renderer.getCellAtPoint(x, y)
    if (cell) {
      this.startEditing(cell.row, cell.col)
    }
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault()
    const state = this.store.getState()
    const sheet = state.data.sheets[state.activeSheetIndex]
    if (!sheet) return

    const scrollTop = Math.max(0, e.deltaY)
    const scrollLeft = Math.max(0, e.deltaX)
    this.renderer.setScroll(scrollTop, scrollLeft)
  }

  private handleResize(): void {
    this.renderer.resize()
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (this.isEditing) {
      if (e.key === 'Escape') {
        this.cancelEditing()
      } else if (e.key === 'Enter' && !e.shiftKey) {
        this.finishEditing()
      }
      return
    }

    const state = this.store.getState()
    if (!state.selection) return

    const [row, col] = [state.selection.row[0], state.selection.column[0]]

    switch (e.key) {
      case 'ArrowUp':
        this.store.setSelection({ row: [row - 1, row - 1], column: [col, col] })
        break
      case 'ArrowDown':
        this.store.setSelection({ row: [row + 1, row + 1], column: [col, col] })
        break
      case 'ArrowLeft':
        this.store.setSelection({ row: [row, row], column: [col - 1, col - 1] })
        break
      case 'ArrowRight':
        this.store.setSelection({ row: [row, row], column: [col + 1, col + 1] })
        break
      case 'Delete':
      case 'Backspace':
        this.store.clearRange(state.selection)
        break
      case 'F2':
        this.startEditing(row, col)
        break
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          this.store.undo()
        }
        break
      case 'y':
        if (e.ctrlKey || e.metaKey) {
          this.store.redo()
        }
        break
    }
  }

  private startEditing(row: number, col: number): void {
    this.isEditing = true
    this.store.setEditingCell({ row, col })

    const cell = this.store.getCell(row, col)
    const value = cell?.f || (cell?.v !== null && cell?.v !== undefined ? String(cell.v) : '')

    this.editor = document.createElement('textarea')
    this.editor.value = value
    this.editor.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 2px solid #4285f4;
      outline: none;
      resize: none;
      font-size: 13px;
      font-family: Arial;
      padding: 4px;
      box-sizing: border-box;
    `

    this.container.style.position = 'relative'
    this.container.appendChild(this.editor)
    this.editor.focus()
  }

  private finishEditing(): void {
    if (!this.editor || !this.isEditing) return

    const state = this.store.getState()
    if (!state.editingCell) return

    const { row, col } = state.editingCell
    const value = this.editor.value

    if (value.startsWith('=')) {
      this.store.setCell(row, col, { v: null, f: value })
    } else {
      const numValue = Number(value)
      this.store.setCell(row, col, {
        v: isNaN(numValue) ? value : numValue,
      })
    }

    this.cancelEditing()
    this.events.emit(Events.CELL_CHANGE, row, col, value)
  }

  private cancelEditing(): void {
    if (this.editor) {
      this.container.removeChild(this.editor)
      this.editor = null
    }
    this.isEditing = false
    this.store.setEditingCell(null)
  }

  getData(): WorkbookData {
    return this.store.getState().data
  }

  setData(data: WorkbookData): void {
    this.store.loadData(data)
    this.syncFormula()
  }

  getActiveSheet(): WorksheetData | undefined {
    return this.store.getActiveSheet()
  }

  setActiveSheet(index: number): void {
    this.store.setActiveSheet(index)
    this.syncFormula()
    this.events.emit(Events.SHEET_CHANGE, index)
  }

  setFrozen(row: number, col: number): void {
    this.store.setFrozen(row, col)
  }

  setRowHidden(row: number, hidden: boolean): void {
    this.store.setRowHidden(row, hidden)
  }

  fillRange(source: Selection, target: Selection): void {
    this.store.fillRange(source, target)
    this.syncFormula()
  }

  getCell(row: number, col: number): CellValue | undefined {
    return this.store.getCell(row, col)
  }

  setCell(row: number, col: number, value: CellValue): void {
    this.store.setCell(row, col, value)
    this.syncFormula()
  }

  on(event: string, handler: (...args: any[]) => void): () => void {
    return this.events.on(event, handler)
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.events.off(event, handler)
  }

  undo(): boolean {
    const success = this.store.undo()
    if (success) this.syncFormula()
    return success
  }

  redo(): boolean {
    const success = this.store.redo()
    if (success) this.syncFormula()
    return success
  }

  destroy(): void {
    this.canvas.removeEventListener('click', this.handleClick.bind(this))
    this.canvas.removeEventListener('dblclick', this.handleDblClick.bind(this))
    this.canvas.removeEventListener('wheel', this.handleWheel.bind(this))
    window.removeEventListener('resize', this.handleResize.bind(this))
    document.removeEventListener('keydown', this.handleKeydown.bind(this))
    this.renderer.destroy()
    this.events.clear()
    this.container.removeChild(this.canvas)
  }
}
