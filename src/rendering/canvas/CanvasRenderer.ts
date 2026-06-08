import { WorksheetData, CellValue, Selection } from '../../types'
import { JSFormulaEngine, FormulaEngine } from '../../formula/FormulaEngine'

export interface RenderConfig {
  defaultRowHeight: number
  defaultColWidth: number
  headerHeight: number
  headerWidth: number
  fontSize: number
  fontFamily: string
}

const DEFAULT_CONFIG: RenderConfig = {
  defaultRowHeight: 25,
  defaultColWidth: 80,
  headerHeight: 25,
  headerWidth: 50,
  fontSize: 13,
  fontFamily: 'Arial',
}

export class CanvasRenderer {
  public canvas: HTMLCanvasElement
  public ctx: CanvasRenderingContext2D
  public cfg: RenderConfig
  public baseCfg: RenderConfig
  public sheet: WorksheetData | null = null
  public rowH: number[] = []
  public colW: number[] = []
  public scrollTop: number = 0
  public scrollLeft: number = 0
  public zoomRatio: number = 1.0
  private selection: Selection | null = null
  private formulaEngine: JSFormulaEngine | FormulaEngine | null = null

  constructor(canvas: HTMLCanvasElement, config?: Partial<RenderConfig>) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.baseCfg = { ...DEFAULT_CONFIG, ...config }
    this.cfg = { ...this.baseCfg }
    this.setupCanvas()
  }

  setFormulaEngine(engine: JSFormulaEngine | FormulaEngine): void {
    this.formulaEngine = engine
  }

  setZoom(ratio: number): void {
    this.zoomRatio = Math.max(0.5, Math.min(3.0, ratio))
    this.cfg = {
      ...this.baseCfg,
      defaultRowHeight: Math.round(this.baseCfg.defaultRowHeight * this.zoomRatio),
      defaultColWidth: Math.round(this.baseCfg.defaultColWidth * this.zoomRatio),
      headerHeight: Math.round(this.baseCfg.headerHeight * this.zoomRatio),
      headerWidth: Math.round(this.baseCfg.headerWidth * this.zoomRatio),
      fontSize: Math.round(this.baseCfg.fontSize * this.zoomRatio),
    }
    this.calcDim()
    this.render()
  }

  private setupCanvas(): void {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
  }

  setSheet(sheet: WorksheetData): void {
    this.sheet = sheet
    this.calcDim()
    this.render()
  }

  public calcDim(): void {
    if (!this.sheet) return

    this.rowH = []
    const hidden = this.sheet.config.rowhidden || {}
    for (let r = 0; r < this.sheet.row; r++) {
      if (hidden[r]) {
        this.rowH[r] = 0
      } else {
        this.rowH[r] = this.sheet.config.rowlen?.[r] || this.cfg.defaultRowHeight
      }
    }

    this.colW = []
    for (let c = 0; c < this.sheet.column; c++) {
      this.colW[c] = this.sheet.config.columnlen?.[c] || this.cfg.defaultColWidth
    }
  }

  setScroll(top: number, left: number): void {
    this.scrollTop = top
    this.scrollLeft = left
    this.render()
  }

  private selections: Selection[] = []

  setSelection(selection: Selection | null): void {
    this.selection = selection
    this.selections = selection ? [selection] : []
    this.render()
  }

  setSelections(selections: Selection[]): void {
    this.selections = selections
    this.selection = selections[selections.length - 1] || null
    this.render()
  }

  render(): void {
    if (!this.sheet) return

    const { width, height } = this.canvas.getBoundingClientRect()
    const ctx = this.ctx

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    this.renderCells(width, height)
    this.renderGrid(width, height)
    this.renderHeaders(width, height)
    this.renderSelection()
  }

  private getVisibleRange(width: number, height: number) {
    const { headerHeight, headerWidth } = this.cfg
    const frozen = this.sheet?.config.frozen || { row: 0, column: 0 }
    const fRows = Math.min(frozen.row || 0, this.rowH.length)
    const fCols = Math.min(frozen.column || 0, this.colW.length)

    let frozenH = 0
    for (let r = 0; r < fRows; r++) frozenH += this.rowH[r]
    let frozenW = 0
    for (let c = 0; c < fCols; c++) frozenW += this.colW[c]

    const visibleWidth = width - headerWidth - frozenW
    const visibleHeight = height - headerHeight - frozenH

    // Scroll Row calculation
    let startRow = fRows
    let accumH = 0
    for (let r = fRows; r < this.rowH.length; r++) {
      if (accumH + this.rowH[r] > this.scrollTop) {
        startRow = r
        break
      }
      accumH += this.rowH[r]
    }

    let endRow = startRow
    let curH = accumH - this.scrollTop
    for (let r = startRow; r < this.rowH.length; r++) {
      curH += this.rowH[r]
      endRow = r
      if (curH > visibleHeight) break
    }

    // Scroll Col calculation
    let startCol = fCols
    let accumW = 0
    for (let c = fCols; c < this.colW.length; c++) {
      if (accumW + this.colW[c] > this.scrollLeft) {
        startCol = c
        break
      }
      accumW += this.colW[c]
    }

    let endCol = startCol
    let curW = accumW - this.scrollLeft
    for (let c = startCol; c < this.colW.length; c++) {
      curW += this.colW[c]
      endCol = c
      if (curW > visibleWidth) break
    }

    const buffer = 3
    startRow = Math.max(fRows, startRow - buffer)
    endRow = Math.min(this.rowH.length - 1, endRow + buffer)
    startCol = Math.max(fCols, startCol - buffer)
    endCol = Math.min(this.colW.length - 1, endCol + buffer)

    let scrollStartX = headerWidth + frozenW - this.scrollLeft
    for (let c = fCols; c < startCol; c++) scrollStartX += this.colW[c]

    let scrollStartY = headerHeight + frozenH - this.scrollTop
    for (let r = fRows; r < startRow; r++) scrollStartY += this.rowH[r]

    return {
      fRows,
      fCols,
      frozenH,
      frozenW,
      startRow,
      endRow,
      startCol,
      endCol,
      scrollStartX,
      scrollStartY,
    }
  }

  private renderHeaders(width: number, height: number): void {
    const ctx = this.ctx
    const { headerHeight, headerWidth } = this.cfg
    const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height)

    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, width, headerHeight)
    ctx.fillRect(0, 0, headerWidth, height)

    ctx.strokeStyle = '#e0e0e0'
    ctx.lineWidth = 1

    const sels = this.selections.length > 0 ? this.selections : (this.selection ? [this.selection] : [])
    const isColSel = (c: number) => sels.some(s => c >= s.column[0] && c <= s.column[1])
    const isRowSel = (r: number) => sels.some(s => r >= s.row[0] && r <= s.row[1])

    // 1. Column Headers (Frozen)
    let x = headerWidth
    for (let c = 0; c < fCols; c++) {
      const colWidth = this.colW[c]
      ctx.fillStyle = isColSel(c) ? '#e8f0fe' : '#f8f9fa'
      ctx.fillRect(x, 0, colWidth, headerHeight)
      ctx.strokeRect(x, 0, colWidth, headerHeight)

      ctx.fillStyle = isColSel(c) ? '#1a73e8' : '#333333'
      ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.colName(c), x + colWidth / 2, headerHeight / 2)
      x += colWidth
    }

    // 2. Column Headers (Scrolling)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth + frozenW, 0, width - headerWidth - frozenW, headerHeight)
    ctx.clip()

    x = scrollStartX
    for (let c = startCol; c <= endCol; c++) {
      const colWidth = this.colW[c]
      ctx.fillStyle = isColSel(c) ? '#e8f0fe' : '#f8f9fa'
      ctx.fillRect(x, 0, colWidth, headerHeight)
      ctx.strokeRect(x, 0, colWidth, headerHeight)

      ctx.fillStyle = isColSel(c) ? '#1a73e8' : '#333333'
      ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(this.colName(c), x + colWidth / 2, headerHeight / 2)
      x += colWidth
    }
    ctx.restore()

    // 3. Row Headers (Frozen)
    let y = headerHeight
    for (let r = 0; r < fRows; r++) {
      const rowHeight = this.rowH[r]
      ctx.fillStyle = isRowSel(r) ? '#e8f0fe' : '#f8f9fa'
      ctx.fillRect(0, y, headerWidth, rowHeight)
      ctx.strokeRect(0, y, headerWidth, rowHeight)

      ctx.fillStyle = isRowSel(r) ? '#1a73e8' : '#333333'
      ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText((r + 1).toString(), headerWidth / 2, y + rowHeight / 2)
      y += rowHeight
    }

    // 4. Row Headers (Scrolling)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, headerHeight + frozenH, headerWidth, height - headerHeight - frozenH)
    ctx.clip()

    y = scrollStartY
    for (let r = startRow; r <= endRow; r++) {
      const rowHeight = this.rowH[r]
      ctx.fillStyle = isRowSel(r) ? '#e8f0fe' : '#f8f9fa'
      ctx.fillRect(0, y, headerWidth, rowHeight)
      ctx.strokeRect(0, y, headerWidth, rowHeight)

      ctx.fillStyle = isRowSel(r) ? '#1a73e8' : '#333333'
      ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText((r + 1).toString(), headerWidth / 2, y + rowHeight / 2)
      y += rowHeight
    }
    ctx.restore()

    // Top Left Header Box
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, 0, headerWidth, headerHeight)
    ctx.strokeRect(0, 0, headerWidth, headerHeight)
  }

  private renderCells(width: number, height: number): void {
    const ctx = this.ctx
    const { headerHeight, headerWidth, fontSize, fontFamily } = this.cfg
    const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height)

    const cellMap = new Map<string, CellValue>()
    this.sheet!.celldata.forEach(cell => {
      cellMap.set(`${cell.r},${cell.c}`, cell.v)
    })

    const isMergedCell = new Map<string, any>()
    if (this.sheet && this.sheet.config && this.sheet.config.merge) {
      Object.values(this.sheet.config.merge).forEach((m: any) => {
        for (let r = m.r; r < m.r + m.rs; r++) {
          for (let c = m.c; c < m.c + m.cs; c++) {
            isMergedCell.set(`${r},${c}`, m)
          }
        }
      })
    }

    const drawCellBlock = (rStart: number, rEnd: number, cStart: number, cEnd: number, initX: number, initY: number) => {
      let y = initY
      for (let r = rStart; r <= rEnd; r++) {
        const rowHeight = this.rowH[r]
        if (rowHeight === 0) continue

        let x = initX
        for (let c = cStart; c <= cEnd; c++) {
          const colWidth = this.colW[c]
          if (colWidth === 0) continue

          const merge = isMergedCell.get(`${r},${c}`)
          let renderW = colWidth
          let renderH = rowHeight
          if (merge) {
            if (r !== merge.r || c !== merge.c) {
              x += colWidth
              continue
            }
            renderW = 0
            for (let mc = merge.c; mc < merge.c + merge.cs; mc++) {
              renderW += this.colW[mc]
            }
            renderH = 0
            for (let mr = merge.r; mr < merge.r + merge.rs; mr++) {
              renderH += this.rowH[mr]
            }
          }

          const cell = cellMap.get(`${r},${c}`)
          if (cell) {
            let displayValue: string | null = null
            const cv = cell.v
            const cf = cell.f
            if (cf && this.formulaEngine) {
              const result = this.formulaEngine.calculate(r, c)
              displayValue = result.error || result.text || ''
            } else if (cv != null) {
              displayValue = cell.m || String(cv)
            }

            if (displayValue !== null) {
              const style = cell.s || {}
              if (style.bc) {
                ctx.fillStyle = style.bc
                ctx.fillRect(x + 0.5, y + 0.5, renderW - 1, renderH - 1)
              }

              ctx.fillStyle = style.fc || '#333333'
              let fontStyle = ''
              if (style.bl) fontStyle += 'bold '
              if (style.it) fontStyle += 'italic '
              ctx.font = `${fontStyle}${style.fs || fontSize}px ${style.ff || fontFamily}`

              let align: CanvasTextAlign = 'left'
              if (style.ht === 1) align = 'center'
              else if (style.ht === 2) align = 'right'
              ctx.textAlign = align
              ctx.textBaseline = 'middle'

              const fa = (cell.ct && cell.ct.fa) ? String(cell.ct.fa) : ''
              let textVal = String(displayValue)
              if (fa && fa !== 'general' && !cf) {
                textVal = this.applyNumberFormat(cv, fa, textVal)
              }

              const indentPx = (style.indent || 0) * 12
              const PAD = 4
              const maxTextW = renderW - PAD * 2 - indentPx
              const wrap = style.tb === 2

              if (wrap) {
                this.drawWrappedText(ctx, textVal, x + PAD + indentPx, y, renderW - PAD * 2 - indentPx, renderH, fontSize, style)
              } else {
                let finalVal = textVal
                if (ctx.measureText(finalVal).width > maxTextW) {
                  while (finalVal.length > 0 && ctx.measureText(finalVal + '…').width > maxTextW) {
                    finalVal = finalVal.slice(0, -1)
                  }
                  if (finalVal.length < textVal.length) finalVal = finalVal + '…'
                }
                const tx = align === 'center' ? x + renderW / 2 : align === 'right' ? x + renderW - PAD - indentPx : x + PAD + indentPx
                let ty: number
                if (style.vt === 1) ty = y + (style.fs || fontSize) / 2 + 2
                else if (style.vt === 3) ty = y + renderH - (style.fs || fontSize) / 2 - 2
                else ty = y + renderH / 2
                ctx.fillText(finalVal, tx, ty)

                if (style.ul || style.st) {
                  const metrics = ctx.measureText(finalVal)
                  const textWidth = metrics.width
                  let startX = x + PAD + indentPx
                  if (align === 'center') {
                    startX = x + renderW / 2 - textWidth / 2
                  } else if (align === 'right') {
                    startX = x + renderW - PAD - indentPx - textWidth
                  }
                  const endX = startX + textWidth

                  ctx.save()
                  ctx.strokeStyle = style.fc || '#333333'
                  ctx.lineWidth = 1
                  if (style.ul) {
                    ctx.beginPath()
                    ctx.moveTo(startX, ty + (style.fs || fontSize) / 2 - 1)
                    ctx.lineTo(endX, ty + (style.fs || fontSize) / 2 - 1)
                    ctx.stroke()
                  }
                  if (style.st) {
                    ctx.beginPath()
                    ctx.moveTo(startX, ty)
                    ctx.lineTo(endX, ty)
                    ctx.stroke()
                  }
                  ctx.restore()
                }
              }
            }
          }
          x += colWidth
        }
        y += rowHeight
      }
    }

    // 1. Region 4: Scrolling cells (Bottom Right)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth + frozenW, headerHeight + frozenH, width - headerWidth - frozenW, height - headerHeight - frozenH)
    ctx.clip()
    drawCellBlock(startRow, endRow, startCol, endCol, scrollStartX, scrollStartY)
    ctx.restore()

    // 2. Region 2: Frozen rows, scrolling columns (Top Right)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth + frozenW, headerHeight, width - headerWidth - frozenW, frozenH)
    ctx.clip()
    drawCellBlock(0, fRows - 1, startCol, endCol, scrollStartX, headerHeight)
    ctx.restore()

    // 3. Region 3: Scrolling rows, frozen columns (Bottom Left)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight + frozenH, frozenW, height - headerHeight - frozenH)
    ctx.clip()
    drawCellBlock(startRow, endRow, 0, fCols - 1, headerWidth, scrollStartY)
    ctx.restore()

    // 4. Region 1: Frozen rows, frozen columns (Top Left)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight, frozenW, frozenH)
    ctx.clip()
    drawCellBlock(0, fRows - 1, 0, fCols - 1, headerWidth, headerHeight)
    ctx.restore()
  }

  private renderGrid(width: number, height: number): void {
    const ctx = this.ctx
    const { headerHeight, headerWidth } = this.cfg
    const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height)

    ctx.strokeStyle = '#e8e8e8'
    ctx.lineWidth = 0.5

    const isMergedCell = new Map<string, any>()
    if (this.sheet && this.sheet.config && this.sheet.config.merge) {
      Object.values(this.sheet.config.merge).forEach((m: any) => {
        for (let r = m.r; r < m.r + m.rs; r++) {
          for (let c = m.c; c < m.c + m.cs; c++) {
            isMergedCell.set(`${r},${c}`, m)
          }
        }
      })
    }

    // Draw gridlines helper
    const drawGridLines = (isVertical: boolean, isFrozen: boolean) => {
      if (isVertical) {
        let x = isFrozen ? headerWidth : scrollStartX
        const limit = isFrozen ? fCols : endCol
        const cStart = isFrozen ? 0 : startCol
        for (let c = cStart; c <= limit; c++) {
          const colWidth = this.colW[c]
          let y = headerHeight
          const rLimit = this.sheet ? this.sheet.row - 1 : 0
          for (let r = 0; r <= rLimit; r++) {
            const mergeLeft = isMergedCell.get(`${r},${c - 1}`)
            const mergeRight = isMergedCell.get(`${r},${c}`)
            const inSameMerge = mergeLeft && mergeRight && mergeLeft === mergeRight
            if (!inSameMerge) {
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(x, y + this.rowH[r])
              ctx.stroke()
            }
            y += this.rowH[r]
          }
          x += colWidth
        }
      } else {
        let y = isFrozen ? headerHeight : scrollStartY
        const limit = isFrozen ? fRows : endRow
        const rStart = isFrozen ? 0 : startRow
        for (let r = rStart; r <= limit; r++) {
          const rowHeight = this.rowH[r]
          let x = headerWidth
          const cLimit = this.sheet ? this.sheet.column - 1 : 0
          for (let c = 0; c <= cLimit; c++) {
            const mergeTop = isMergedCell.get(`${r - 1},${c}`)
            const mergeBottom = isMergedCell.get(`${r},${c}`)
            const inSameMerge = mergeTop && mergeBottom && mergeTop === mergeBottom
            if (!inSameMerge) {
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.lineTo(x + this.colW[c], y)
              ctx.stroke()
            }
            x += this.colW[c]
          }
          y += rowHeight
        }
      }
    }

    // 1. Grid lines drawing
    // Vertical Scrolling Lines (clipped)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth + frozenW, headerHeight, width - headerWidth - frozenW, height - headerHeight)
    ctx.clip()
    drawGridLines(true, false)
    ctx.restore()

    // Vertical Frozen Lines (static)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight, frozenW, height - headerHeight)
    ctx.clip()
    drawGridLines(true, true)
    ctx.restore()

    // Horizontal Scrolling Lines (clipped)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight + frozenH, width - headerWidth, height - headerHeight - frozenH)
    ctx.clip()
    drawGridLines(false, false)
    ctx.restore()

    // Horizontal Frozen Lines (static)
    ctx.save()
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight, width - headerWidth, frozenH)
    ctx.clip()
    drawGridLines(false, true)
    ctx.restore()

    // 2. Thick Frozen Borders
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 1.5
    if (frozenW > 0) {
      ctx.beginPath()
      ctx.moveTo(headerWidth + frozenW, headerHeight)
      ctx.lineTo(headerWidth + frozenW, height)
      ctx.stroke()
    }
    if (frozenH > 0) {
      ctx.beginPath()
      ctx.moveTo(headerWidth, headerHeight + frozenH)
      ctx.lineTo(width, headerHeight + frozenH)
      ctx.stroke()
    }
  }

  private renderSelection(): void {
    const sels = this.selections.length > 0 ? this.selections : (this.selection ? [this.selection] : [])
    if (sels.length === 0) return

    const ctx = this.ctx
    ctx.save()
    const { headerHeight, headerWidth } = this.cfg
    ctx.beginPath()
    ctx.rect(headerWidth, headerHeight, this.canvas.width, this.canvas.height)
    ctx.clip()

    sels.forEach((sel, index) => {
      const [startRow, endRow] = sel.row
      const [startCol, endCol] = sel.column

      const startRect = this.getCellScreenRect(startRow, startCol)
      const endRect = this.getCellScreenRect(endRow, endCol)
      if (!startRect || !endRect) return

      const startX = startRect.x
      const startY = startRect.y
      const endX = endRect.x + endRect.w
      const endY = endRect.y + endRect.h

      const selWidth = endX - startX
      const selHeight = endY - startY
      const isPrimary = index === sels.length - 1

      ctx.fillStyle = isPrimary ? 'rgba(26, 115, 232, 0.12)' : 'rgba(26, 115, 232, 0.06)'
      ctx.fillRect(startX, startY, selWidth, selHeight)

      if (isPrimary) {
        ctx.strokeStyle = '#1a73e8'
        ctx.lineWidth = 2
        ctx.strokeRect(startX, startY, selWidth, selHeight)
        ctx.fillStyle = '#1a73e8'
        ctx.fillRect(endX - 4, endY - 4, 6, 6)
      } else {
        ctx.strokeStyle = '#1a73e8'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 2])
        ctx.strokeRect(startX + 0.5, startY + 0.5, selWidth - 1, selHeight - 1)
        ctx.setLineDash([])
      }
    })

    ctx.restore()
  }

  colName(c: number): string {
    let name = ''
    while (c >= 0) {
      name = String.fromCharCode(65 + (c % 26)) + name
      c = Math.floor(c / 26) - 1
    }
    return name
  }

  applyNumberFormat(value: any, fa: string, defaultText: string): string {
    if (value == null || value === '') return defaultText
    const lower = fa.toLowerCase()
    const v = typeof value === 'number' ? value : Number(value)
    const isNum = !isNaN(v) && typeof v === 'number' && value !== '' && value !== true && value !== false

    try {
      if (lower === 'general' || !fa) return defaultText

      if (lower === 'percent' && isNum) {
        return (v * 100).toFixed(2).replace(/\.?0+$/, '') + '%'
      }
      if (lower === 'currency' && isNum) {
        return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      if (lower === 'accounting' && isNum) {
        return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      if (lower === 'scientific' && isNum) {
        return v.toExponential(2)
      }
      if (lower === 'number' && isNum) {
        return v.toLocaleString('en-US')
      }
      if (lower === 'text') {
        return String(value)
      }
      if (lower === 'date' || lower === 'time' || lower === 'datetime') {
        const d = isNum ? new Date((v - 25569) * 86400000) : new Date(value)
        if (isNaN(d.getTime())) return defaultText
        if (lower === 'date') return d.toLocaleDateString('zh-TW')
        if (lower === 'time') return d.toLocaleTimeString('zh-TW')
        return d.toLocaleString('zh-TW')
      }

      const m = fa.match(/^0+(\.0+)?$/)
      if (m && isNum) {
        const decimals = m[1] ? m[1].length - 1 : 0
        return v.toFixed(decimals)
      }
      const m2 = fa.match(/^#,##0(\.#0+)?$/)
      if (m2 && isNum) {
        const decimals = m2[1] ? m2[1].length - 1 : 0
        return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      }
      const m3 = fa.match(/^0+\s*%$/)
      if (m3 && isNum) {
        return v.toFixed(0) + '%'
      }
      const m4 = fa.match(/^0\.0+\s*%$/)
      if (m4 && isNum) {
        const dec = (fa.match(/\.0+/) || ['', ''])[1].length
        return (v * 100).toFixed(dec) + '%'
      }
      return defaultText
    } catch (e) {
      return defaultText
    }
  }

  drawWrappedText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number, y: number, maxW: number, maxH: number,
    fontSize: number, style: any
  ): void {
    if (!text) return
    const lines: string[] = []
    const paragraphs = text.split('\n')
    for (const para of paragraphs) {
      let line = ''
      const words = para.split('')
      for (const ch of words) {
        const test = line + ch
        if (ctx.measureText(test).width > maxW && line.length > 0) {
          lines.push(line)
          line = ch
        } else {
          line = test
        }
      }
      if (line) lines.push(line)
    }

    const lineH = (style.fs || fontSize) * 1.2
    const totalH = lines.length * lineH
    let startY: number
    if (style.vt === 1) startY = y + (style.fs || fontSize) / 2 + 2
    else if (style.vt === 3) startY = y + maxH - totalH + fontSize / 2
    else startY = y + (maxH - totalH) / 2 + fontSize / 2

    const align = ctx.textAlign
    ctx.save()
    for (let i = 0; i < lines.length; i++) {
      const ty = startY + i * lineH
      if (ty - fontSize / 2 > y + maxH) break
      const line = lines[i]
      let tx: number
      if (align === 'center') tx = x + maxW / 2
      else if (align === 'right') tx = x + maxW
      else tx = x
      ctx.fillText(line, tx, ty)
      if (style.ul || style.st) {
        const textWidth = ctx.measureText(line).width
        let startX: number
        if (align === 'center') startX = x + maxW / 2 - textWidth / 2
        else if (align === 'right') startX = x + maxW - textWidth
        else startX = x
        const endX = startX + textWidth
        ctx.strokeStyle = style.fc || '#333333'
        ctx.lineWidth = 1
        if (style.ul) {
          ctx.beginPath()
          ctx.moveTo(startX, ty + (style.fs || fontSize) / 2 - 1)
          ctx.lineTo(endX, ty + (style.fs || fontSize) / 2 - 1)
          ctx.stroke()
        }
        if (style.st) {
          ctx.beginPath()
          ctx.moveTo(startX, ty)
          ctx.lineTo(endX, ty)
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }

  getCellScreenRect(row: number, col: number) {
    const { headerHeight, headerWidth } = this.cfg
    const frozen = this.sheet?.config.frozen || { row: 0, column: 0 }
    const fRows = Math.min(frozen.row || 0, this.rowH.length)
    const fCols = Math.min(frozen.column || 0, this.colW.length)

    let x = headerWidth
    if (col < fCols) {
      for (let c = 0; c < col; c++) x += this.colW[c]
    } else {
      let frozenW = 0
      for (let c = 0; c < fCols; c++) frozenW += this.colW[c]
      x += frozenW - this.scrollLeft
      for (let c = fCols; c < col; c++) x += this.colW[c]
    }

    let y = headerHeight
    if (row < fRows) {
      for (let r = 0; r < row; r++) y += this.rowH[r]
    } else {
      let frozenH = 0
      for (let r = 0; r < fRows; r++) frozenH += this.rowH[r]
      y += frozenH - this.scrollTop
      for (let r = fRows; r < row; r++) y += this.rowH[r]
    }

    return { x, y, w: this.colW[col], h: this.rowH[row] }
  }

  getCellAt(px: number, py: number): { row: number; col: number } | null {
    const { headerHeight, headerWidth } = this.cfg
    if (!this.sheet || px < headerWidth || py < headerHeight) return null

    const frozen = this.sheet.config.frozen || { row: 0, column: 0 }
    const fRows = Math.min(frozen.row || 0, this.rowH.length)
    const fCols = Math.min(frozen.column || 0, this.colW.length)

    let frozenH = 0
    for (let r = 0; r < fRows; r++) frozenH += this.rowH[r]
    let frozenW = 0
    for (let c = 0; c < fCols; c++) frozenW += this.colW[c]

    let col = -1
    if (px < headerWidth + frozenW) {
      let currentX = headerWidth
      for (let c = 0; c < fCols; c++) {
        if (px >= currentX && px < currentX + this.colW[c]) {
          col = c
          break
        }
        currentX += this.colW[c]
      }
    } else {
      let currentX = headerWidth + frozenW - this.scrollLeft
      for (let c = fCols; c < this.sheet.column; c++) {
        if (px >= currentX && px < currentX + this.colW[c]) {
          col = c
          break
        }
        currentX += this.colW[c]
      }
    }

    let row = -1
    if (py < headerHeight + frozenH) {
      let currentY = headerHeight
      for (let r = 0; r < fRows; r++) {
        if (py >= currentY && py < currentY + this.rowH[r]) {
          row = r
          break
        }
        currentY += this.rowH[r]
      }
    } else {
      let currentY = headerHeight + frozenH - this.scrollTop
      for (let r = fRows; r < this.sheet.row; r++) {
        if (py >= currentY && py < currentY + this.rowH[r]) {
          row = r
          break
        }
        currentY += this.rowH[r]
      }
    }

    if (row >= 0 && col >= 0) {
      return { row, col }
    }
    return null
  }

  getCellAtPoint(x: number, y: number): { row: number; col: number } | null {
    return this.getCellAt(x, y)
  }

  getHeaderAt(px: number, py: number): { type: 'col' | 'row' | 'all'; index: number } | null {
    const { headerHeight, headerWidth } = this.cfg
    if (!this.sheet) return null

    const frozen = this.sheet.config.frozen || { row: 0, column: 0 }
    const fRows = Math.min(frozen.row || 0, this.rowH.length)
    const fCols = Math.min(frozen.column || 0, this.colW.length)

    let frozenH = 0
    for (let r = 0; r < fRows; r++) frozenH += this.rowH[r]
    let frozenW = 0
    for (let c = 0; c < fCols; c++) frozenW += this.colW[c]

    if (py < headerHeight && px >= headerWidth) {
      if (px < headerWidth + frozenW) {
        let x = headerWidth
        for (let c = 0; c < fCols; c++) {
          const cw = this.colW[c]
          if (px >= x && px < x + cw) return { type: 'col', index: c }
          x += cw
        }
      } else {
        let x = headerWidth + frozenW - this.scrollLeft
        for (let c = fCols; c < this.sheet.column; c++) {
          const cw = this.colW[c]
          if (px >= x && px < x + cw) return { type: 'col', index: c }
          x += cw
        }
      }
      return { type: 'col', index: this.sheet.column - 1 }
    }

    if (px < headerWidth && py >= headerHeight) {
      if (py < headerHeight + frozenH) {
        let y = headerHeight
        for (let r = 0; r < fRows; r++) {
          const rh = this.rowH[r]
          if (py >= y && py < y + rh) return { type: 'row', index: r }
          y += rh
        }
      } else {
        let y = headerHeight + frozenH - this.scrollTop
        for (let r = fRows; r < this.sheet.row; r++) {
          const rh = this.rowH[r]
          if (py >= y && py < y + rh) return { type: 'row', index: r }
          y += rh
        }
      }
      return { type: 'row', index: this.sheet.row - 1 }
    }

    if (px < headerWidth && py < headerHeight) {
      return { type: 'all', index: -1 }
    }

    return null
  }

  isOverFillHandle(px: number, py: number): boolean {
    if (!this.selection) return false
    const [_, endRow] = this.selection.row
    const [__, endCol] = this.selection.column

    const endRect = this.getCellScreenRect(endRow, endCol)
    if (!endRect) return false

    const handleX = endRect.x + endRect.w
    const handleY = endRect.y + endRect.h

    return Math.abs(px - handleX) <= 6 && Math.abs(py - handleY) <= 6
  }

  measureColumnWidth(c: number): number {
    if (!this.sheet) return this.cfg.defaultColWidth
    const ctx = this.ctx
    const { fontSize, fontFamily } = this.cfg
    const fe = this.formulaEngine instanceof JSFormulaEngine ? this.formulaEngine : null
    ctx.save()
    ctx.font = `${fontSize}px ${fontFamily}`
    let max = 0
    for (const cell of this.sheet.celldata) {
      if (cell.c !== c) continue
      const v = cell.v
      if (v == null) continue
      let text = ''
      if (v.f && fe) {
        const res = fe.eval(v.f)
        text = String(res.value ?? v.m ?? v.v ?? '')
      } else {
        text = String(v.m ?? v.v ?? '')
      }
      const indentPx = ((v.s?.indent) || 0) * 12
      const w = ctx.measureText(text).width + 4 * 2 + indentPx + 2
      if (w > max) max = w
    }
    ctx.restore()
    return Math.max(max, 30)
  }

  measureRowHeight(r: number): number {
    if (!this.sheet) return this.cfg.defaultRowHeight
    const ctx = this.ctx
    const { fontSize, fontFamily } = this.cfg
    const fe = this.formulaEngine instanceof JSFormulaEngine ? this.formulaEngine : null
    ctx.save()
    ctx.font = `${fontSize}px ${fontFamily}`
    let max = 0
    for (const cell of this.sheet.celldata) {
      if (cell.r !== r) continue
      const v = cell.v
      if (v == null) continue
      let text = ''
      if (v.f && fe) {
        const res = fe.eval(v.f)
        text = String(res.value ?? v.m ?? v.v ?? '')
      } else {
        text = String(v.m ?? v.v ?? '')
      }
      const fontH = fontSize + 6
      const indentH = (v.s?.tb === 2) ? Math.ceil(ctx.measureText(text).width / 100) * fontH : fontH
      if (indentH > max) max = indentH
    }
    ctx.restore()
    return Math.max(max, this.cfg.defaultRowHeight)
  }

  getResizeTarget(px: number, py: number): { type: 'col' | 'row'; index: number; startVal: number } | null {
    const { headerHeight, headerWidth } = this.cfg
    if (!this.sheet) return null

    const frozen = this.sheet.config.frozen || { row: 0, column: 0 }
    const fRows = Math.min(frozen.row || 0, this.rowH.length)
    const fCols = Math.min(frozen.column || 0, this.colW.length)

    let frozenH = 0
    for (let r = 0; r < fRows; r++) frozenH += this.rowH[r]
    let frozenW = 0
    for (let c = 0; c < fCols; c++) frozenW += this.colW[c]

    if (py < headerHeight && px >= headerWidth) {
      if (px < headerWidth + frozenW) {
        let x = headerWidth
        for (let c = 0; c < fCols; c++) {
          const cw = this.colW[c]
          if (Math.abs(px - (x + cw)) < 6) {
            return { type: 'col', index: c, startVal: cw }
          }
          x += cw
        }
      } else {
        let x = headerWidth + frozenW - this.scrollLeft
        for (let c = fCols; c < this.sheet.column; c++) {
          const cw = this.colW[c]
          if (Math.abs(px - (x + cw)) < 6) {
            return { type: 'col', index: c, startVal: cw }
          }
          x += cw
        }
      }
    }

    if (px < headerWidth && py >= headerHeight) {
      if (py < headerHeight + frozenH) {
        let y = headerHeight
        for (let r = 0; r < fRows; r++) {
          const rh = this.rowH[r]
          if (Math.abs(py - (y + rh)) < 6) {
            return { type: 'row', index: r, startVal: rh }
          }
          y += rh
        }
      } else {
        let y = headerHeight + frozenH - this.scrollTop
        for (let r = fRows; r < this.sheet.row; r++) {
          const rh = this.rowH[r]
          if (Math.abs(py - (y + rh)) < 6) {
            return { type: 'row', index: r, startVal: rh }
          }
          y += rh
        }
      }
    }

    return null
  }

  resize(): void {
    this.setupCanvas()
    this.render()
  }

  destroy(): void {
    this.sheet = null
    this.formulaEngine = null
  }
}
