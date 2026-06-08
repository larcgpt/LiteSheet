import { CellValue } from '../types'

export interface CalcResult {
  value: any
  text: string | null
  error: string | null
}

export class FormulaEngine {
  private engine: any = null
  private initialized: boolean = false

  async init(): Promise<void> {
    try {
      const pkgPath = './pkg/formula_engine'
      // @ts-ignore dynamic WASM import
      const wasm = await import(/* @vite-ignore */ pkgPath)
      await wasm.default()
      this.engine = new wasm.FormulaEngine()
      this.initialized = true
    } catch (e) {
      console.warn('WASM formula engine not available, using JS fallback')
      this.initialized = false
    }
  }

  setCell(row: number, col: number, value: CellValue): void {
    if (this.initialized && this.engine) {
      this.engine.set_cell(row, col, value)
    }
  }

  getCell(row: number, col: number): CellValue | null {
    if (this.initialized && this.engine) {
      return this.engine.get_cell(row, col)
    }
    return null
  }

  calculate(row: number, col: number): CalcResult {
    if (this.initialized && this.engine) {
      return this.engine.calculate(row, col)
    }
    return { value: null, text: null, error: 'Engine not initialized' }
  }

  clearCache(): void {
    if (this.initialized && this.engine) {
      this.engine.clear_cache()
    }
  }

  clear(): void {
    if (this.initialized && this.engine) {
      this.engine.clear()
    }
  }

  isInitialized(): boolean {
    return this.initialized
  }
}

export class JSFormulaEngine {
  private cells: Map<string, CellValue> = new Map()
  private calculating: Set<string> = new Set()
  public cache: Map<string, CalcResult> = new Map()

  setCell(row: number, col: number, value: CellValue): void {
    this.cells.set(`${row}:${col}`, value)
    this.cache.clear()
  }

  getCell(row: number, col: number): CellValue | null {
    return this.cells.get(`${row}:${col}`) || null
  }

  clearCache(): void {
    this.cache.clear()
  }

  clear(): void {
    this.cells.clear()
    this.cache.clear()
    this.calculating.clear()
  }

  calculate(row: number, col: number): CalcResult {
    const key = `${row}:${col}`
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }
    if (this.calculating.has(key)) {
      return { value: null, text: null, error: '#REF!' }
    }
    this.calculating.add(key)

    const cell = this.getCell(row, col)
    let result: CalcResult

    if (!cell) {
      result = { value: null, text: null, error: null }
    } else {
      const cv = cell.v
      const cf = cell.f
      if (cf) {
        result = this.eval(cf)
        result = {
          ...result,
          text: result.error || String(result.value ?? ''),
        }
      } else {
        result = {
          value: cv,
          text: cv != null ? String(cv) : null,
          error: null,
        }
      }
    }

    this.calculating.delete(key)
    this.cache.set(key, result)
    return result
  }

  eval(f: string): CalcResult {
    if (!f || !f.startsWith('=')) {
      return { value: f, text: String(f ?? ''), error: null }
    }
    try {
      return this.evalExpr(f.substring(1))
    } catch (e) {
      return { value: null, text: null, error: '#ERROR!' }
    }
  }

  isSingleFunc(expr: string): [string, string] | null {
    const funcMatch = expr.match(/^([A-Z0-9_]+)\((.*)\)$/s)
    if (!funcMatch) return null
    const name = funcMatch[1]
    const inner = funcMatch[2]
    let depth = 1
    let inStr = false
    const firstOpenIdx = name.length
    for (let i = firstOpenIdx + 1; i < expr.length; i++) {
      if (expr[i] === '"') inStr = !inStr
      if (inStr) continue
      if (expr[i] === '(') depth++
      else if (expr[i] === ')') {
        depth--
        if (depth === 0) {
          if (i === expr.length - 1) return [name, inner]
          return null
        }
      }
    }
    return null
  }

  evalExpr(expr: string): CalcResult {
    expr = expr.trim()
    const singleFunc = this.isSingleFunc(expr)
    if (singleFunc) {
      return this.callFunc(singleFunc[0], singleFunc[1])
    }
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.evalExpr(expr.slice(1, -1))
    }

    // 1. Comparison operators (lowest precedence, split first)
    for (const op of ['>=', '<=', '<>', '>', '<', '=']) {
      const parts = this.splitBinary(expr, op)
      if (parts) {
        const a = this.evalExpr(parts[0])
        const b = this.evalExpr(parts[1])
        const valA = a.value
        const valB = b.value
        let r: boolean
        if (op === '>=') r = valA >= valB
        else if (op === '<=') r = valA <= valB
        else if (op === '<>') r = valA != valB
        else if (op === '>') r = valA > valB
        else if (op === '<') r = valA < valB
        else r = valA == valB
        return { value: r, text: String(r).toUpperCase(), error: null }
      }
    }

    // 2. Arithmetic operators
    for (const op of ['+', '-', '*', '/', '^']) {
      const parts = this.splitBinary(expr, op)
      if (parts) {
        const a = this.evalExpr(parts[0])
        const b = this.evalExpr(parts[1])
        const na = this.toNum(a.value)
        const nb = this.toNum(b.value)
        let r: number
        if (op === '+') r = na + nb
        else if (op === '-') r = na - nb
        else if (op === '*') r = na * nb
        else if (op === '/') {
          if (nb === 0) return { value: null, text: null, error: '#DIV/0!' }
          r = na / nb
        } else {
          r = Math.pow(na, nb)
        }
        return { value: r, text: String(r), error: null }
      }
    }

    if (expr.startsWith('"') && expr.endsWith('"')) {
      const val = expr.slice(1, -1)
      return { value: val, text: val, error: null }
    }
    if (expr.toUpperCase() === 'TRUE') {
      return { value: true, text: 'TRUE', error: null }
    }
    if (expr.toUpperCase() === 'FALSE') {
      return { value: false, text: 'FALSE', error: null }
    }

    const num = Number(expr)
    if (!isNaN(num) && expr !== '') {
      return { value: num, text: String(num), error: null }
    }

    const ref = this.parseRef(expr.toUpperCase())
    if (ref) {
      const v = this.getCell(ref[0], ref[1])
      if (v) {
        const cv = v.v
        const cf = v.f
        if (cf) {
          return this.calculate(ref[0], ref[1])
        }
        return { value: cv, text: String(cv ?? ''), error: null }
      }
      return { value: 0, text: '0', error: null }
    }

    if (expr.includes(':')) {
      return { value: expr, text: expr, error: null }
    }
    return { value: expr, text: expr, error: null }
  }

  splitBinary(expr: string, op: string): [string, string] | null {
    let depth = 0
    let inStr = false
    for (let i = expr.length - 1; i >= 0; i--) {
      if (expr[i] === '"') inStr = !inStr
      if (inStr) continue
      if (expr[i] === ')') depth++
      else if (expr[i] === '(') depth--

      if (depth === 0 && expr.substring(i, i + op.length) === op) {
        if (op === '-' && i === 0) continue
        if (op === '-' && i > 0 && '+-*/^>=<'.includes(expr[i - 1])) continue
        const left = expr.substring(0, i).trim()
        const right = expr.substring(i + op.length).trim()
        if (left && right) return [left, right]
      }
    }
    return null
  }

  callFunc(name: string, argsStr: string): CalcResult {
    const args = this.splitArgs(argsStr)
    const evalArgs = args.map(a => this.evalExpr(a.trim()))
    const vals: any[] = []
    for (let i = 0; i < evalArgs.length; i++) {
      const a = evalArgs[i]
      if (typeof a.value === 'string' && a.value.includes(':')) {
        vals.push(...this.getRangeValues(a.value))
      } else {
        vals.push(a.value)
      }
    }

    switch (name) {
      case 'SUM': {
        const n = this.flattenNums(vals)
        const s = n.reduce((a, b) => a + b, 0)
        return { value: s, text: String(s), error: null }
      }
      case 'AVERAGE': {
        const n = this.flattenNums(vals)
        if (!n.length) return { value: null, text: null, error: '#DIV/0!' }
        const s = n.reduce((a, b) => a + b, 0) / n.length
        return { value: s, text: String(s), error: null }
      }
      case 'COUNT': {
        return { value: this.flattenNums(vals).length, text: String(this.flattenNums(vals).length), error: null }
      }
      case 'MAX': {
        const n = this.flattenNums(vals)
        if (!n.length) return { value: 0, text: '0', error: null }
        return { value: Math.max(...n), text: String(Math.max(...n)), error: null }
      }
      case 'MIN': {
        const n = this.flattenNums(vals)
        if (!n.length) return { value: 0, text: '0', error: null }
        return { value: Math.min(...n), text: String(Math.min(...n)), error: null }
      }
      case 'ABS':
        return { value: Math.abs(this.toNum(vals[0])), text: String(Math.abs(this.toNum(vals[0]))), error: null }
      case 'INT':
        return { value: Math.floor(this.toNum(vals[0])), text: String(Math.floor(this.toNum(vals[0]))), error: null }
      case 'ROUND': {
        const n = this.toNum(vals[0])
        const d = this.toNum(vals[1] ?? 0)
        const v = Number(n.toFixed(d))
        return { value: v, text: String(v), error: null }
      }
      case 'MOD': {
        const a = this.toNum(vals[0])
        const b = this.toNum(vals[1])
        if (b === 0) return { value: null, text: null, error: '#DIV/0!' }
        const v = a - b * Math.floor(a / b)
        return { value: v, text: String(v), error: null }
      }
      case 'POWER':
        return { value: Math.pow(this.toNum(vals[0]), this.toNum(vals[1])), text: String(Math.pow(this.toNum(vals[0]), this.toNum(vals[1]))), error: null }
      case 'SQRT': {
        const n = this.toNum(vals[0])
        if (n < 0) return { value: null, text: null, error: '#NUM!' }
        return { value: Math.sqrt(n), text: String(Math.sqrt(n)), error: null }
      }
      case 'IF': {
        if (evalArgs.length < 2) return { value: null, text: null, error: '#VALUE!' }
        return evalArgs[0].value ? evalArgs[1] : (evalArgs[2] || { value: false, text: 'FALSE', error: null })
      }
      case 'AND':
        return { value: this.flatten(vals).every(Boolean), text: String(this.flatten(vals).every(Boolean)), error: null }
      case 'OR':
        return { value: this.flatten(vals).some(Boolean), text: String(this.flatten(vals).some(Boolean)), error: null }
      case 'NOT':
        return { value: !vals[0], text: String(!vals[0]), error: null }
      case 'CONCATENATE':
      case 'CONCAT': {
        const s = this.flatten(vals).map(v => this.toStr(v)).join('')
        return { value: s, text: s, error: null }
      }
      case 'LEFT': {
        const s = this.toStr(vals[0])
        const n = this.toNum(vals[1] ?? 1)
        return { text: s.substring(0, n), value: s.substring(0, n), error: null }
      }
      case 'RIGHT': {
        const s = this.toStr(vals[0])
        const n = this.toNum(vals[1] ?? 1)
        return { text: s.substring(s.length - n), value: s.substring(s.length - n), error: null }
      }
      case 'MID': {
        const s = this.toStr(vals[0])
        const st = this.toNum(vals[1]) - 1
        const n = this.toNum(vals[2])
        return { text: s.substring(st, st + n), value: s.substring(st, st + n), error: null }
      }
      case 'LEN':
        return { value: this.toStr(vals[0]).length, text: String(this.toStr(vals[0]).length), error: null }
      case 'UPPER':
        return { value: this.toStr(vals[0]).toUpperCase(), text: this.toStr(vals[0]).toUpperCase(), error: null }
      case 'LOWER':
        return { value: this.toStr(vals[0]).toLowerCase(), text: this.toStr(vals[0]).toLowerCase(), error: null }
      case 'TRIM':
        return { value: this.toStr(vals[0]).trim(), text: this.toStr(vals[0]).trim(), error: null }
      case 'NOW': {
        const d = new Date()
        return { value: d.toISOString(), text: d.toLocaleString(), error: null }
      }
      case 'TODAY': {
        const d = new Date()
        return { value: d.toISOString().split('T')[0], text: d.toLocaleDateString(), error: null }
      }
      case 'PI':
        return { value: Math.PI, text: String(Math.PI), error: null }
      case 'TRUE':
        return { value: true, text: 'TRUE', error: null }
      case 'FALSE':
        return { value: false, text: 'FALSE', error: null }
      case 'IFERROR': {
        if (evalArgs.length < 2) return { value: null, text: null, error: '#VALUE!' }
        return evalArgs[0].error ? evalArgs[1] : evalArgs[0]
      }
      case 'ADD':
        return { value: this.toNum(vals[0]) + this.toNum(vals[1]), text: String(this.toNum(vals[0]) + this.toNum(vals[1])), error: null }
      case 'MINUS':
        return { value: this.toNum(vals[0]) - this.toNum(vals[1]), text: String(this.toNum(vals[0]) - this.toNum(vals[1])), error: null }
      case 'MULTIPLY':
        return { value: this.toNum(vals[0]) * this.toNum(vals[1]), text: String(this.toNum(vals[0]) * this.toNum(vals[1])), error: null }
      case 'DIVIDE': {
        const b = this.toNum(vals[1])
        if (b === 0) return { value: null, text: null, error: '#DIV/0!' }
        return { value: this.toNum(vals[0]) / b, text: String(this.toNum(vals[0]) / b), error: null }
      }
      case 'GT':
        return { value: vals[0] > vals[1], text: String(vals[0] > vals[1]).toUpperCase(), error: null }
      case 'LT':
        return { value: vals[0] < vals[1], text: String(vals[0] < vals[1]).toUpperCase(), error: null }
      case 'EQ':
        return { value: vals[0] == vals[1], text: String(vals[0] == vals[1]).toUpperCase(), error: null }
      case 'NE':
        return { value: vals[0] != vals[1], text: String(vals[0] != vals[1]).toUpperCase(), error: null }
      case 'LARGE': {
        const n = this.flattenNums(this.flatten(vals.slice(0, -1)))
        const k = this.toNum(vals[vals.length - 1])
        if (k <= 0 || k > n.length) return { value: null, text: null, error: '#NUM!' }
        const sorted = [...n].sort((a, b) => b - a)
        const v = sorted[k - 1]
        return { value: v, text: String(v), error: null }
      }
      case 'SMALL': {
        const n = this.flattenNums(this.flatten(vals.slice(0, -1)))
        const k = this.toNum(vals[vals.length - 1])
        if (k <= 0 || k > n.length) return { value: null, text: null, error: '#NUM!' }
        const sorted = [...n].sort((a, b) => a - b)
        const v = sorted[k - 1]
        return { value: v, text: String(v), error: null }
      }
      case 'VLOOKUP': {
        const lookupVal = evalArgs[0].value
        const range = this.getRange2D(args[1])
        const colIdx = this.toNum(evalArgs[2].value) - 1
        if (!range.length || colIdx < 0 || colIdx >= range[0].length) {
          return { value: null, text: null, error: '#REF!' }
        }
        for (let r = 0; r < range.length; r++) {
          if (range[r][0] == lookupVal) {
            return { value: range[r][colIdx], text: this.toStr(range[r][colIdx]), error: null }
          }
        }
        return { value: null, text: null, error: '#N/A' }
      }
      case 'SUMIF': {
        const range = this.getRangeValues(args[0])
        const criteria = this.toStr(vals[1])
        const sumRange = args.length > 2 ? this.getRangeValues(args[2]) : range
        let sum = 0
        for (let i = 0; i < range.length; i++) {
          if (this.matchCriteria(range[i], criteria)) {
            sum += this.toNum(sumRange[i] ?? 0)
          }
        }
        return { value: sum, text: String(sum), error: null }
      }
      case 'COUNTIF': {
        const range = this.getRangeValues(args[0])
        const criteria = this.toStr(vals[1])
        let count = 0
        for (const v of range) {
          if (this.matchCriteria(v, criteria)) count++
        }
        return { value: count, text: String(count), error: null }
      }
      case 'PRODUCT': {
        const n = this.flattenNums(vals)
        const p = n.reduce((a, b) => a * b, 1)
        return { value: p, text: String(p), error: null }
      }
      case 'SIGN':
        return { value: Math.sign(this.toNum(vals[0])), text: String(Math.sign(this.toNum(vals[0]))), error: null }
      case 'EXP':
        return { value: Math.exp(this.toNum(vals[0])), text: String(Math.exp(this.toNum(vals[0]))), error: null }
      case 'LN': {
        const n = this.toNum(vals[0])
        if (n <= 0) return { value: null, text: null, error: '#NUM!' }
        return { value: Math.log(n), text: String(Math.log(n)), error: null }
      }
      case 'LOG': {
        const n = this.toNum(vals[0])
        const b = this.toNum(vals[1] ?? 10)
        return { value: Math.log(n) / Math.log(b), text: String(Math.log(n) / Math.log(b)), error: null }
      }
      case 'LOG10': {
        const n = this.toNum(vals[0])
        return { value: Math.log10(n), text: String(Math.log10(n)), error: null }
      }
      case 'SIN':
        return { value: Math.sin(this.toNum(vals[0])), text: String(Math.sin(this.toNum(vals[0]))), error: null }
      case 'COS':
        return { value: Math.cos(this.toNum(vals[0])), text: String(Math.cos(this.toNum(vals[0]))), error: null }
      case 'TAN':
        return { value: Math.tan(this.toNum(vals[0])), text: String(Math.tan(this.toNum(vals[0]))), error: null }
      case 'CEILING': {
        const n = this.toNum(vals[0])
        const s = this.toNum(vals[1] ?? 1)
        if (s === 0) return { value: 0, text: '0', error: null }
        const v = Math.ceil(n / s) * s
        return { value: v, text: String(v), error: null }
      }
      case 'FLOOR': {
        const n = this.toNum(vals[0])
        const s = this.toNum(vals[1] ?? 1)
        if (s === 0) return { value: 0, text: '0', error: null }
        const v = Math.floor(n / s) * s
        return { value: v, text: String(v), error: null }
      }
      case 'EVEN': {
        const v = this.toNum(vals[0])
        const r = v < 0 ? Math.floor(v / 2) * 2 : Math.ceil(v / 2) * 2
        return { value: r, text: String(r), error: null }
      }
      case 'ODD': {
        const v = this.toNum(vals[0])
        const r = v < 0 ? Math.floor((v - 1) / 2) * 2 + 1 : Math.ceil((v - 1) / 2) * 2 + 1
        return { value: r, text: String(r), error: null }
      }
      case 'COMBIN': {
        const n = Math.floor(this.toNum(vals[0]))
        const k = Math.floor(this.toNum(vals[1]))
        if (n < 0 || k < 0 || k > n) return { value: null, text: null, error: '#NUM!' }
        let r = 1
        for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1)
        const rounded = Math.round(r)
        return { value: rounded, text: String(rounded), error: null }
      }
      case 'PROPER': {
        const text = this.toStr(vals[0]).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase())
        return { value: text, text, error: null }
      }
      case 'EXACT': {
        const v = this.toStr(vals[0]) === this.toStr(vals[1])
        return { value: v, text: String(v), error: null }
      }
      case 'CLEAN': {
        const text = this.toStr(vals[0]).replace(/[\x00-\x1F]/g, '')
        return { value: text, text, error: null }
      }
      case 'SLN': {
        const cost = this.toNum(vals[0])
        const salvage = this.toNum(vals[1])
        const life = this.toNum(vals[2])
        if (life === 0) return { value: null, text: null, error: '#DIV/0!' }
        const v = (cost - salvage) / life
        return { value: v, text: String(v), error: null }
      }
      case 'YEAR': {
        const d = new Date((this.toNum(vals[0]) - 25569) * 86400000)
        return { value: d.getFullYear(), text: String(d.getFullYear()), error: null }
      }
      case 'MONTH': {
        const d = new Date((this.toNum(vals[0]) - 25569) * 86400000)
        return { value: d.getMonth() + 1, text: String(d.getMonth() + 1), error: null }
      }
      case 'DAY': {
        const d = new Date((this.toNum(vals[0]) - 25569) * 86400000)
        return { value: d.getDate(), text: String(d.getDate()), error: null }
      }
      case 'WEEKDAY': {
        const d = new Date((this.toNum(vals[0]) - 25569) * 86400000)
        return { value: d.getDay() + 1, text: String(d.getDay() + 1), error: null }
      }
      case 'FACT': {
        const n = Math.floor(this.toNum(vals[0]))
        if (n < 0) return { value: null, text: null, error: '#NUM!' }
        let r = 1
        for (let i = 2; i <= n; i++) r *= i
        return { value: r, text: String(r), error: null }
      }
      case 'FIND': {
        const s = this.toStr(vals[0])
        const t = this.toStr(vals[1])
        const st = this.toNum(vals[2] ?? 1) - 1
        const idx = t.indexOf(s, st)
        if (idx < 0) return { value: null, text: null, error: '#VALUE!' }
        return { value: idx + 1, text: String(idx + 1), error: null }
      }
      case 'SEARCH': {
        const s = this.toStr(vals[0]).toLowerCase()
        const t = this.toStr(vals[1]).toLowerCase()
        const st = this.toNum(vals[2] ?? 1) - 1
        const idx = t.indexOf(s, st)
        if (idx < 0) return { value: null, text: null, error: '#VALUE!' }
        return { value: idx + 1, text: String(idx + 1), error: null }
      }
      case 'REPLACE': {
        const s = this.toStr(vals[0])
        const st = this.toNum(vals[1]) - 1
        const num = this.toNum(vals[2])
        const rep = this.toStr(vals[3])
        const text = s.substring(0, st) + rep + s.substring(st + num)
        return { text, value: text, error: null }
      }
      case 'SUBSTITUTE': {
        const s = this.toStr(vals[0])
        const old = this.toStr(vals[1])
        const rep = this.toStr(vals[2])
        const text = s.split(old).join(rep)
        return { text, value: text, error: null }
      }
      case 'REPT': {
        const s = this.toStr(vals[0])
        const n = this.toNum(vals[1])
        const text = s.repeat(n)
        return { text, value: text, error: null }
      }
      case 'VALUE': {
        const n = Number(this.toStr(vals[0]))
        if (isNaN(n)) return { value: null, text: null, error: '#VALUE!' }
        return { value: n, text: String(n), error: null }
      }
      case 'CHAR':
        return { value: String.fromCharCode(this.toNum(vals[0])), text: String.fromCharCode(this.toNum(vals[0])), error: null }
      case 'CODE':
        return { value: this.toStr(vals[0]).charCodeAt(0), text: String(this.toStr(vals[0]).charCodeAt(0)), error: null }
      case 'STDEV': {
        const n = this.flattenNums(vals)
        if (n.length < 2) return { value: null, text: null, error: '#DIV/0!' }
        const avg = n.reduce((a, b) => a + b, 0) / n.length
        const v = Math.sqrt(n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1))
        return { value: v, text: String(v), error: null }
      }
      case 'VAR': {
        const n = this.flattenNums(vals)
        if (n.length < 2) return { value: null, text: null, error: '#DIV/0!' }
        const avg = n.reduce((a, b) => a + b, 0) / n.length
        const v = n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1)
        return { value: v, text: String(v), error: null }
      }
      case 'MEDIAN': {
        const n = this.flattenNums(vals).sort((a, b) => a - b)
        const mid = Math.floor(n.length / 2)
        const val = n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2
        return { value: val, text: String(val), error: null }
      }
      case 'PMT': {
        const rate = this.toNum(vals[0])
        const nper = this.toNum(vals[1])
        const pv = this.toNum(vals[2])
        if (rate === 0) return { value: -pv / nper, text: String(-pv / nper), error: null }
        const v = pv * rate * Math.pow(1 + rate, nper) / (Math.pow(1 + rate, nper) - 1)
        return { value: -v, text: String(-v), error: null }
      }
      case 'FV': {
        const rate = this.toNum(vals[0])
        const nper = this.toNum(vals[1])
        const pmt = this.toNum(vals[2])
        const pv = this.toNum(vals[3] ?? 0)
        const v = pv * Math.pow(1 + rate, nper) + pmt * (Math.pow(1 + rate, nper) - 1) / rate
        return { value: -v, text: String(-v), error: null }
      }
      case 'PV': {
        const rate = this.toNum(vals[0])
        const nper = this.toNum(vals[1])
        const pmt = this.toNum(vals[2])
        const v = pmt * (1 - Math.pow(1 + rate, -nper)) / rate
        return { value: v, text: String(v), error: null }
      }
      case 'T':
        return typeof vals[0] === 'string' ? { value: vals[0], text: vals[0], error: null } : { value: '', text: '', error: null }
      case 'N':
        return typeof vals[0] === 'number' ? { value: vals[0], text: String(vals[0]), error: null } : { value: 0, text: '0', error: null }
      case 'ISBLANK':
        return { value: vals[0] == null || vals[0] === '', text: vals[0] == null || vals[0] === '' ? 'TRUE' : 'FALSE', error: null }
      case 'ISNUMBER':
        return { value: typeof vals[0] === 'number', text: typeof vals[0] === 'number' ? 'TRUE' : 'FALSE', error: null }
      case 'ISTEXT':
        return { value: typeof vals[0] === 'string', text: typeof vals[0] === 'string' ? 'TRUE' : 'FALSE', error: null }
      default:
        return { value: null, text: null, error: '#NAME?' }
    }
  }

  toNum(v: any): number {
    if (v == null || v === '') return 0
    if (typeof v === 'boolean') return v ? 1 : 0
    const n = Number(v)
    return isNaN(n) ? 0 : n
  }

  toStr(v: any): string {
    return v == null ? '' : String(v)
  }

  flatten(vals: any[]): any[] {
    const r: any[] = []
    for (const v of vals) {
      if (Array.isArray(v)) {
        for (const x of v) r.push(x)
      } else {
        r.push(v)
      }
    }
    return r
  }

  flattenNums(vals: any[]): number[] {
    return this.flatten(vals)
      .filter(v => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v))))
      .map(Number)
  }

  getRangeValues(rangeStr: string): any[] {
    rangeStr = rangeStr.trim()
    if (rangeStr.includes(':')) {
      const [a, b] = rangeStr.split(':')
      const s1 = this.parseRef(a.trim().toUpperCase())
      const s2 = this.parseRef(b.trim().toUpperCase())
      if (!s1 || !s2) return []
      const vals: any[] = []
      for (let r = s1[0]; r <= s2[0]; r++) {
        for (let c = s1[1]; c <= s2[1]; c++) {
          const x = this.getCell(r, c)
          if (x) {
            const xv = x.v
            const xf = x.f
            if (xf) {
              const res = this.calculate(r, c)
              vals.push(res.value)
            } else if (xv != null) {
              vals.push(xv)
            } else {
              vals.push(null)
            }
          } else {
            vals.push(null)
          }
        }
      }
      return vals
    }
    const ref = this.parseRef(rangeStr.toUpperCase())
    if (ref) {
      const x = this.getCell(ref[0], ref[1])
      if (x) {
        const xv = x.v
        const xf = x.f
        if (xf) {
          return [this.calculate(ref[0], ref[1]).value]
        }
        return [xv]
      }
      return [null]
    }
    return [rangeStr]
  }

  getRange2D(rangeStr: string): any[][] {
    rangeStr = rangeStr.trim()
    if (!rangeStr.includes(':')) {
      const ref = this.parseRef(rangeStr.toUpperCase())
      if (ref) {
        const x = this.getCell(ref[0], ref[1])
        if (x) {
          const xv = x.v
          const xf = x.f
          if (xf) return [[this.calculate(ref[0], ref[1]).value]]
          return [[xv]]
        }
        return [[null]]
      }
      return [[rangeStr]]
    }
    const [a, b] = rangeStr.split(':')
    const s1 = this.parseRef(a.trim().toUpperCase())
    const s2 = this.parseRef(b.trim().toUpperCase())
    if (!s1 || !s2) return [[]]
    const result: any[][] = []
    for (let r = s1[0]; r <= s2[0]; r++) {
      const row: any[] = []
      for (let c = s1[1]; c <= s2[1]; c++) {
        const x = this.getCell(r, c)
        if (x) {
          const xv = x.v
          const xf = x.f
          if (xf) {
            const res = this.calculate(r, c)
            row.push(res.value)
          } else {
            row.push(xv)
          }
        } else {
          row.push(null)
        }
      }
      result.push(row)
    }
    return result
  }

  parseRef(ref: string): [number, number] | null {
    const m = ref.match(/^([A-Z]+)(\d+)$/)
    if (!m) return null
    let c = 0
    for (let i = 0; i < m[1].length; i++) {
      c = c * 26 + (m[1].charCodeAt(i) - 64)
    }
    return [parseInt(m[2]) - 1, c - 1]
  }

  splitArgs(s: string): string[] {
    const args: string[] = []
    let depth = 0
    let current = ''
    let inStr = false
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"') inStr = !inStr
      if (!inStr) {
        if (s[i] === '(') depth++
        else if (s[i] === ')') depth--
        else if (s[i] === ',' && depth === 0) {
          args.push(current)
          current = ''
          continue
        }
      }
      current += s[i]
    }
    if (current) args.push(current)
    return args
  }

  matchCriteria(val: any, criteria: string): boolean {
    if (val == null) val = ''
    const s = String(val)
    if (criteria.startsWith('>=')) return this.toNum(s) >= this.toNum(criteria.substring(2))
    if (criteria.startsWith('<=')) return this.toNum(s) <= this.toNum(criteria.substring(2))
    if (criteria.startsWith('<>')) return s !== criteria.substring(2)
    if (criteria.startsWith('>')) return this.toNum(s) > this.toNum(criteria.substring(1))
    if (criteria.startsWith('<')) return this.toNum(s) < this.toNum(criteria.substring(1))
    return s == criteria
  }
}
