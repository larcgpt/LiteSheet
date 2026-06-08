import { describe, it, expect, beforeEach } from 'vitest'
import { Store } from '../src/core/store/Store'

describe('Store multi-selection tests', () => {
  let store: Store

  beforeEach(() => {
    store = new Store({
      sheets: [{
        name: 'Sheet1', index: 0, row: 100, column: 26, celldata: [],
        config: { rowlen: {}, columnlen: {}, merge: {}, border: {} }
      }],
      activeSheetIndex: 0,
    })
  })

  it('setSelection sets a single-item selections array', () => {
    store.setSelection({ row: [0, 0], column: [0, 0] })
    expect(store.getState().selections.length).toBe(1)
    expect(store.getState().selections[0]).toEqual({ row: [0, 0], column: [0, 0] })
  })

  it('setSelections supports multiple non-contiguous ranges', () => {
    store.setSelections([
      { row: [0, 0], column: [0, 0] },
      { row: [2, 4], column: [3, 5] }
    ])
    expect(store.getState().selections.length).toBe(2)
    expect(store.getState().selection).toEqual({ row: [2, 4], column: [3, 5] })
  })

  it('clearRange iterates all selections', () => {
    store.setSelections([
      { row: [0, 0], column: [0, 0] },
      { row: [2, 2], column: [2, 2] }
    ])
    store.setCell(0, 0, { v: 'A' })
    store.setCell(2, 2, { v: 'B' })
    store.setCell(5, 5, { v: 'C' })
    store.clearRange(store.getState().selection!)
    expect(store.getCell(0, 0)?.v).toBeNull()
    expect(store.getCell(2, 2)?.v).toBeNull()
    expect(store.getCell(5, 5)?.v).toBe('C')
  })

  it('setStyle applies to all selections', () => {
    store.setSelections([
      { row: [0, 0], column: [0, 0] },
      { row: [3, 3], column: [3, 3] }
    ])
    store.setStyle(store.getState().selection!, s => { s.bl = 1; s.fc = '#ff0000' })
    expect(store.getCell(0, 0)?.s?.bl).toBe(1)
    expect(store.getCell(0, 0)?.s?.fc).toBe('#ff0000')
    expect(store.getCell(3, 3)?.s?.bl).toBe(1)
    expect(store.getCell(3, 3)?.s?.fc).toBe('#ff0000')
  })

  it('unmergeCells removes the merged cell from config', () => {
    const sheet = store.getActiveSheet()!
    if (!sheet.config.merge) sheet.config.merge = {}
    sheet.config.merge['0,0'] = { r: 0, c: 0, rs: 2, cs: 2 }
    store.unmergeCells({ row: [0, 0], column: [0, 0] })
    expect(sheet.config.merge!['0,0']).toBeUndefined()
  })

  it('unmergeCells across multiple selections', () => {
    const sheet = store.getActiveSheet()!
    if (!sheet.config.merge) sheet.config.merge = {}
    sheet.config.merge['0,0'] = { r: 0, c: 0, rs: 2, cs: 2 }
    sheet.config.merge['5,5'] = { r: 5, c: 5, rs: 2, cs: 2 }
    store.setSelections([
      { row: [0, 0], column: [0, 0] },
      { row: [5, 5], column: [5, 5] }
    ])
    store.getState().selections.forEach(sel => store.unmergeCells(sel))
    expect(sheet.config.merge!['0,0']).toBeUndefined()
    expect(sheet.config.merge!['5,5']).toBeUndefined()
  })
})
