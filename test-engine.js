// LiteSheet 公式引擎測試
// 此檔案用於測試 FormulaEngine 的所有功能

// ====== 公式引擎核心 ======
class FormulaEngine {
  constructor() { this.cells = new Map(); this.calculating = new Set(); this.cache = new Map() }
  setCell(r, c, v) { this.cells.set(`${r}:${c}`, v); this.cache.clear() }
  getCell(r, c) { return this.cells.get(`${r}:${c}`) || null }
  calculate(r, c) {
    const key = `${r}:${c}`
    if (this.cache.has(key)) return this.cache.get(key)
    if (this.calculating.has(key)) return { value: null, text: null, error: '#REF!' }
    this.calculating.add(key)
    const cell = this.getCell(r, c)
    let result
    if (!cell) {
      result = { value: null, text: null, error: null }
    } else if (cell.f) {
      result = this.eval(cell.f)
      result = { ...result, text: result.error || String(result.value ?? '') }
    } else {
      const cellValue = (cell.v !== undefined && cell.v !== null && typeof cell.v === 'object' && cell.v.v !== undefined) ? cell.v.v : cell.v
      result = { value: cellValue, text: cellValue != null ? String(cellValue) : null, error: null }
    }
    this.calculating.delete(key)
    this.cache.set(key, result)
    return result
  }
  eval(f) {
    if (!f || !f.startsWith('=')) return { value: f, text: String(f ?? ''), error: null }
    const formula = f.substring(1)
    try {
      return this.evalExpr(formula)
    } catch (e) {
      return { value: null, text: null, error: '#ERROR!' }
    }
  }
  evalExpr(expr) {
    expr = expr.trim()
    const funcMatch = expr.match(/^([A-Z_]+)\((.*)\)$/s)
    if (funcMatch) {
      const name = funcMatch[1]
      const argsStr = funcMatch[2]
      return this.callFunc(name, argsStr)
    }
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return this.evalExpr(expr.slice(1, -1))
    }
    const addParts = this.splitBinary(expr, '+')
    if (addParts) {
      const a = this.evalExpr(addParts[0])
      const b = this.evalExpr(addParts[1])
      const r = this.toNum(a.value) + this.toNum(b.value)
      return { value: r, text: String(r), error: null }
    }
    const subParts = this.splitBinary(expr, '-')
    if (subParts) {
      const a = this.evalExpr(subParts[0])
      const b = this.evalExpr(subParts[1])
      const r = this.toNum(a.value) - this.toNum(b.value)
      return { value: r, text: String(r), error: null }
    }
    const mulParts = this.splitBinary(expr, '*')
    if (mulParts) {
      const a = this.evalExpr(mulParts[0])
      const b = this.evalExpr(mulParts[1])
      const r = this.toNum(a.value) * this.toNum(b.value)
      return { value: r, text: String(r), error: null }
    }
    const divParts = this.splitBinary(expr, '/')
    if (divParts) {
      const a = this.evalExpr(divParts[0])
      const b = this.evalExpr(divParts[1])
      if (this.toNum(b.value) === 0) return { value: null, text: null, error: '#DIV/0!' }
      const r = this.toNum(a.value) / this.toNum(b.value)
      return { value: r, text: String(r), error: null }
    }
    const powParts = this.splitBinary(expr, '^')
    if (powParts) {
      const a = this.evalExpr(powParts[0])
      const b = this.evalExpr(powParts[1])
      const r = Math.pow(this.toNum(a.value), this.toNum(b.value))
      return { value: r, text: String(r), error: null }
    }
    const gtParts = this.splitBinary(expr, '>')
    if (gtParts) {
      const a = this.evalExpr(gtParts[0])
      const b = this.evalExpr(gtParts[1])
      return { value: this.toNum(a.value) > this.toNum(b.value), text: String(this.toNum(a.value) > this.toNum(b.value)), error: null }
    }
    const ltParts = this.splitBinary(expr, '<')
    if (ltParts) {
      const a = this.evalExpr(ltParts[0])
      const b = this.evalExpr(ltParts[1])
      return { value: this.toNum(a.value) < this.toNum(b.value), text: String(this.toNum(a.value) < this.toNum(b.value)), error: null }
    }
    const eqParts = this.splitBinary(expr, '=')
    if (eqParts) {
      const a = this.evalExpr(eqParts[0])
      const b = this.evalExpr(eqParts[1])
      return { value: a.value == b.value, text: String(a.value == b.value), error: null }
    }
    if (expr.startsWith('"') && expr.endsWith('"')) {
      const s = expr.slice(1, -1)
      return { value: s, text: s, error: null }
    }
    if (expr.toUpperCase() === 'TRUE') return { value: true, text: 'TRUE', error: null }
    if (expr.toUpperCase() === 'FALSE') return { value: false, text: 'FALSE', error: null }
    const num = Number(expr)
    if (!isNaN(num) && expr !== '') return { value: num, text: String(num), error: null }
    const ref = this.parseRef(expr.toUpperCase())
    if (ref) {
      const v = this.getCell(ref[0], ref[1])
      if (v) {
        if (v.f) {
          const r = this.calculate(ref[0], ref[1])
          return r
        }
        const cellValue = (v.v !== undefined && v.v !== null && typeof v.v === 'object' && v.v.v !== undefined) ? v.v.v : v.v
        return { value: cellValue, text: String(cellValue ?? ''), error: null }
      }
      return { value: 0, text: '0', error: null }
    }
    if (expr.includes(':')) {
      return { value: expr, text: expr, error: null }
    }
    return { value: expr, text: expr, error: null }
  }
  splitBinary(expr, op) {
    let depth = 0, inStr = false
    for (let i = expr.length - 1; i >= 0; i--) {
      const ch = expr[i]
      if (ch === '"') inStr = !inStr
      if (inStr) continue
      if (ch === ')') depth++
      else if (ch === '(') depth--
      if (depth === 0 && expr.substring(i, i + op.length) === op) {
        if (op === '-' && i === 0) continue
        if (op === '-' && i > 0 && '+-*/^>=<'.includes(expr[i-1])) continue
        const left = expr.substring(0, i).trim()
        const right = expr.substring(i + op.length).trim()
        if (left && right) return [left, right]
      }
    }
    return null
  }
  callFunc(name, argsStr) {
    const args = this.splitArgs(argsStr)
    const evalArgs = args.map(a => this.evalExpr(a.trim()))
    const vals = []
    for (const a of evalArgs) {
      if (typeof a.value === 'string' && a.value.includes(':')) {
        const rangeVals = this.getRangeValues(a.value)
        vals.push(...rangeVals)
      } else {
        vals.push(a.value)
      }
    }
    switch (name) {
      case 'SUM': return this.fnSum(vals)
      case 'AVERAGE': return this.fnAvg(vals)
      case 'COUNT': return this.fnCount(vals)
      case 'COUNTA': return this.fnCountA(vals)
      case 'MAX': return this.fnMax(vals)
      case 'MIN': return this.fnMin(vals)
      case 'PRODUCT': return this.fnProduct(vals)
      case 'ABS': return this.fnAbs(vals)
      case 'INT': return this.fnInt(vals)
      case 'ROUND': return this.fnRound(vals)
      case 'MOD': return this.fnMod(vals)
      case 'POWER': return this.fnPower(vals)
      case 'SQRT': return this.fnSqrt(vals)
      case 'CEILING': return this.fnCeiling(vals)
      case 'FLOOR': return this.fnFloor(vals)
      case 'EVEN': return this.fnEven(vals)
      case 'ODD': return this.fnOdd(vals)
      case 'SIGN': return this.fnSign(vals)
      case 'EXP': return this.fnExp(vals)
      case 'LN': return this.fnLn(vals)
      case 'LOG': return this.fnLog(vals)
      case 'LOG10': return this.fnLog10(vals)
      case 'PI': return { value: Math.PI, text: String(Math.PI), error: null }
      case 'RAND': return { value: Math.random(), text: String(Math.random()), error: null }
      case 'FACT': return this.fnFact(vals)
      case 'COMBIN': return this.fnCombin(vals)
      case 'SIN': return this.fnSin(vals)
      case 'COS': return this.fnCos(vals)
      case 'TAN': return this.fnTan(vals)
      case 'IF': return this.fnIf(evalArgs)
      case 'AND': return this.fnAnd(vals)
      case 'OR': return this.fnOr(vals)
      case 'NOT': return this.fnNot(vals)
      case 'TRUE': return { value: true, text: 'TRUE', error: null }
      case 'FALSE': return { value: false, text: 'FALSE', error: null }
      case 'IFERROR': return this.fnIfError(evalArgs)
      case 'CONCATENATE': return this.fnConcatenate(vals)
      case 'CONCAT': return this.fnConcatenate(vals)
      case 'LEFT': return this.fnLeft(vals)
      case 'RIGHT': return this.fnRight(vals)
      case 'MID': return this.fnMid(vals)
      case 'LEN': return this.fnLen(vals)
      case 'LOWER': return this.fnLower(vals)
      case 'UPPER': return this.fnUpper(vals)
      case 'TRIM': return this.fnTrim(vals)
      case 'CLEAN': return this.fnClean(vals)
      case 'PROPER': return this.fnProper(vals)
      case 'EXACT': return this.fnExact(vals)
      case 'FIND': return this.fnFind(vals)
      case 'SEARCH': return this.fnSearch(vals)
      case 'REPLACE': return this.fnReplace(vals)
      case 'SUBSTITUTE': return this.fnSubstitute(vals)
      case 'REPT': return this.fnRept(vals)
      case 'VALUE': return this.fnValue(vals)
      case 'T': return this.fnT(vals)
      case 'N': return this.fnN(vals)
      case 'CHAR': return this.fnChar(vals)
      case 'CODE': return this.fnCode(vals)
      case 'ISBLANK': return { value: vals[0] == null || vals[0] === '', text: vals[0] == null || vals[0] === '' ? 'TRUE' : 'FALSE', error: null }
      case 'ISNUMBER': return { value: typeof vals[0] === 'number', text: typeof vals[0] === 'number' ? 'TRUE' : 'FALSE', error: null }
      case 'ISTEXT': return { value: typeof vals[0] === 'string', text: typeof vals[0] === 'string' ? 'TRUE' : 'FALSE', error: null }
      case 'ISERROR': return { value: typeof vals[0] === 'string' && vals[0].startsWith('#'), text: typeof vals[0] === 'string' && vals[0].startsWith('#') ? 'TRUE' : 'FALSE', error: null }
      case 'SUMIF': return this.fnSumIf(args, vals)
      case 'COUNTIF': return this.fnCountIf(args, vals)
      case 'AVERAGEIF': return this.fnAverageIf(args, vals)
      case 'STDEV': return this.fnStdev(vals)
      case 'VAR': return this.fnVar(vals)
      case 'MEDIAN': return this.fnMedian(vals)
      case 'LARGE': return this.fnLarge(vals)
      case 'SMALL': return this.fnSmall(vals)
      case 'PMT': return this.fnPmt(vals)
      case 'FV': return this.fnFv(vals)
      case 'PV': return this.fnPv(vals)
      case 'SLN': return this.fnSln(vals)
      case 'YEAR': return this.fnYear(vals)
      case 'MONTH': return this.fnMonth(vals)
      case 'DAY': return this.fnDay(vals)
      case 'WEEKDAY': return this.fnWeekday(vals)
      case 'TODAY': { const d = new Date(); return { value: d.toISOString().split('T')[0], text: d.toLocaleDateString(), error: null } }
      case 'NOW': { const d = new Date(); return { value: d.toISOString(), text: d.toLocaleString(), error: null } }
      case 'NE': { const a = evalArgs[0], b = evalArgs[1]; const v = a.value != b.value; return { value: v, text: String(v), error: null } }
      case 'EQ': { const a = evalArgs[0], b = evalArgs[1]; const v = a.value == b.value; return { value: v, text: String(v), error: null } }
      case 'GT': { const a = evalArgs[0], b = evalArgs[1]; const v = this.toNum(a.value) > this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'LT': { const a = evalArgs[0], b = evalArgs[1]; const v = this.toNum(a.value) < this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'ADD': { const a = evalArgs[0], b = evalArgs[1]; const v = this.toNum(a.value) + this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'MINUS': { const a = evalArgs[0], b = evalArgs[1]; const v = this.toNum(a.value) - this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'MULTIPLY': { const a = evalArgs[0], b = evalArgs[1]; const v = this.toNum(a.value) * this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'DIVIDE': { const a = evalArgs[0], b = evalArgs[1]; if (this.toNum(b.value) === 0) return { value: null, text: null, error: '#DIV/0!' }; const v = this.toNum(a.value) / this.toNum(b.value); return { value: v, text: String(v), error: null } }
      case 'DEGREES': return { value: this.toNum(vals[0]) * 180 / Math.PI, text: String(this.toNum(vals[0]) * 180 / Math.PI), error: null }
      case 'RADIANS': return { value: this.toNum(vals[0]) * Math.PI / 180, text: String(this.toNum(vals[0]) * Math.PI / 180), error: null }
      default: return { value: null, text: null, error: '#NAME?' }
    }
  }
  toNum(v) { if (v == null || v === '') return 0; if (typeof v === 'boolean') return v ? 1 : 0; const n = Number(v); return isNaN(n) ? 0 : n }
  toStr(v) { if (v == null) return ''; return String(v) }
  flatten(vals) { const r = []; for (const v of vals) { if (Array.isArray(v)) { for (const x of v) r.push(x) } else r.push(v) }; return r }
  flattenNums(vals) { return this.flatten(vals).filter(v => typeof v === 'number' || (typeof v === 'string' && v !== '' && !isNaN(Number(v)))).map(Number) }
  getRangeValues(rangeStr) {
    rangeStr = rangeStr.trim()
    if (rangeStr.includes(':')) {
      const [a, b] = rangeStr.split(':')
      const s1 = this.parseRef(a.trim().toUpperCase()), s2 = this.parseRef(b.trim().toUpperCase())
      if (!s1 || !s2) return []
      const vals = []
      for (let r = s1[0]; r <= s2[0]; r++)
        for (let c = s1[1]; c <= s2[1]; c++) {
          const x = this.getCell(r, c)
          if (x) {
            if (x.f) { const res = this.calculate(r, c); vals.push(res.value) }
            else if (x.v !== undefined && x.v !== null) {
              if (typeof x.v === 'object' && x.v.v !== undefined) vals.push(x.v.v)
              else vals.push(x.v)
            } else vals.push(null)
          } else vals.push(null)
        }
      return vals
    }
    const ref = this.parseRef(rangeStr.toUpperCase())
    if (ref) {
      const x = this.getCell(ref[0], ref[1])
      if (x) {
        if (x.f) { const res = this.calculate(ref[0], ref[1]); return [res.value] }
        if (typeof x.v === 'object' && x.v.v !== undefined) return [x.v.v]
        return [x.v]
      }
      return [null]
    }
    return [rangeStr]
  }
  parseRef(ref) {
    const m = ref.match(/^([A-Z]+)(\d+)$/)
    if (!m) return null
    let c = 0
    for (let i = 0; i < m[1].length; i++) c = c * 26 + (m[1].charCodeAt(i) - 64)
    return [parseInt(m[2]) - 1, c - 1]
  }
  splitArgs(s) {
    const args = []
    let depth = 0, current = '', inStr = false
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '"') inStr = !inStr
      if (!inStr) {
        if (s[i] === '(') depth++
        else if (s[i] === ')') depth--
        else if (s[i] === ',' && depth === 0) { args.push(current); current = ''; continue }
      }
      current += s[i]
    }
    if (current) args.push(current)
    return args
  }
  matchCriteria(val, criteria) {
    if (val == null) val = ''
    const s = String(val)
    if (criteria.startsWith('>=')) return this.toNum(s) >= this.toNum(criteria.substring(2))
    if (criteria.startsWith('<=')) return this.toNum(s) <= this.toNum(criteria.substring(2))
    if (criteria.startsWith('<>')) return s !== criteria.substring(2)
    if (criteria.startsWith('>')) return this.toNum(s) > this.toNum(criteria.substring(1))
    if (criteria.startsWith('<')) return this.toNum(s) < this.toNum(criteria.substring(1))
    return s == criteria
  }
  fnSum(vals) { const n = this.flattenNums(vals); const s = n.reduce((a, b) => a + b, 0); return { value: s, text: String(s), error: null } }
  fnAvg(vals) { const n = this.flattenNums(vals); if (!n.length) return { value: null, text: null, error: '#DIV/0!' }; const s = n.reduce((a, b) => a + b, 0) / n.length; return { value: s, text: String(s), error: null } }
  fnCount(vals) { const n = this.flattenNums(vals); return { value: n.length, text: String(n.length), error: null } }
  fnCountA(vals) { const n = this.flatten(vals).filter(v => v != null && v !== ''); return { value: n.length, text: String(n.length), error: null } }
  fnMax(vals) { const n = this.flattenNums(vals); if (!n.length) return { value: 0, text: '0', error: null }; return { value: Math.max(...n), text: String(Math.max(...n)), error: null } }
  fnMin(vals) { const n = this.flattenNums(vals); if (!n.length) return { value: 0, text: '0', error: null }; return { value: Math.min(...n), text: String(Math.min(...n)), error: null } }
  fnProduct(vals) { const n = this.flattenNums(vals); const s = n.reduce((a, b) => a * b, 1); return { value: s, text: String(s), error: null } }
  fnAbs(vals) { const v = Math.abs(this.toNum(vals[0])); return { value: v, text: String(v), error: null } }
  fnInt(vals) { const v = Math.floor(this.toNum(vals[0])); return { value: v, text: String(v), error: null } }
  fnRound(vals) { const n = this.toNum(vals[0]), d = this.toNum(vals[1] ?? 0); const v = Number(n.toFixed(d)); return { value: v, text: String(v), error: null } }
  fnMod(vals) { const a = this.toNum(vals[0]), b = this.toNum(vals[1]); if (b === 0) return { value: null, text: null, error: '#DIV/0!' }; const v = a - b * Math.floor(a / b); return { value: v, text: String(v), error: null } }
  fnPower(vals) { const v = Math.pow(this.toNum(vals[0]), this.toNum(vals[1])); return { value: v, text: String(v), error: null } }
  fnSqrt(vals) { const n = this.toNum(vals[0]); if (n < 0) return { value: null, text: null, error: '#NUM!' }; const v = Math.sqrt(n); return { value: v, text: String(v), error: null } }
  fnCeiling(vals) { const n = this.toNum(vals[0]), s = this.toNum(vals[1] ?? 1); if (s === 0) return { value: 0, text: '0', error: null }; const v = Math.ceil(n / s) * s; return { value: v, text: String(v), error: null } }
  fnFloor(vals) { const n = this.toNum(vals[0]), s = this.toNum(vals[1] ?? 1); if (s === 0) return { value: 0, text: '0', error: null }; const v = Math.floor(n / s) * s; return { value: v, text: String(v), error: null } }
  fnEven(vals) { const v = this.toNum(vals[0]); return { value: v < 0 ? Math.floor(v / 2) * 2 : Math.ceil(v / 2) * 2, text: String(v < 0 ? Math.floor(v / 2) * 2 : Math.ceil(v / 2) * 2), error: null } }
  fnOdd(vals) { const v = this.toNum(vals[0]); const r = v < 0 ? Math.floor((v - 1) / 2) * 2 + 1 : Math.ceil((v - 1) / 2) * 2 + 1; return { value: r, text: String(r), error: null } }
  fnSign(vals) { const v = Math.sign(this.toNum(vals[0])); return { value: v, text: String(v), error: null } }
  fnExp(vals) { const v = Math.exp(this.toNum(vals[0])); return { value: v, text: String(v), error: null } }
  fnLn(vals) { const n = this.toNum(vals[0]); if (n <= 0) return { value: null, text: null, error: '#NUM!' }; return { value: Math.log(n), text: String(Math.log(n)), error: null } }
  fnLog(vals) { const n = this.toNum(vals[0]), b = this.toNum(vals[1] ?? 10); if (n <= 0 || b <= 0) return { value: null, text: null, error: '#NUM!' }; return { value: Math.log(n) / Math.log(b), text: String(Math.log(n) / Math.log(b)), error: null } }
  fnLog10(vals) { const n = this.toNum(vals[0]); if (n <= 0) return { value: null, text: null, error: '#NUM!' }; return { value: Math.log10(n), text: String(Math.log10(n)), error: null } }
  fnFact(vals) { let n = Math.floor(this.toNum(vals[0])); if (n < 0) return { value: null, text: null, error: '#NUM!' }; let r = 1; for (let i = 2; i <= n; i++) r *= i; return { value: r, text: String(r), error: null } }
  fnCombin(vals) { const n = Math.floor(this.toNum(vals[0])), k = Math.floor(this.toNum(vals[1])); if (n < 0 || k < 0 || k > n) return { value: null, text: null, error: '#NUM!' }; let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return { value: Math.round(r), text: String(Math.round(r)), error: null } }
  fnSin(vals) { return { value: Math.sin(this.toNum(vals[0])), text: String(Math.sin(this.toNum(vals[0]))), error: null } }
  fnCos(vals) { return { value: Math.cos(this.toNum(vals[0])), text: String(Math.cos(this.toNum(vals[0]))), error: null } }
  fnTan(vals) { return { value: Math.tan(this.toNum(vals[0])), text: String(Math.tan(this.toNum(vals[0]))), error: null } }
  fnIf(evalArgs) { if (evalArgs.length < 2) return { value: null, text: null, error: '#VALUE!' }; const cond = evalArgs[0].value; if (cond) return evalArgs[1]; return evalArgs.length > 2 ? evalArgs[2] : { value: false, text: 'FALSE', error: null } }
  fnAnd(vals) { const n = this.flatten(vals).map(v => !!v); return { value: n.every(Boolean), text: String(n.every(Boolean)), error: null } }
  fnOr(vals) { const n = this.flatten(vals).map(v => !!v); return { value: n.some(Boolean), text: String(n.some(Boolean)), error: null } }
  fnNot(vals) { const v = !vals[0]; return { value: v, text: String(v), error: null } }
  fnIfError(evalArgs) { if (evalArgs.length < 2) return { value: null, text: null, error: '#VALUE!' }; const v = evalArgs[0].value; if (typeof v === 'string' && v.startsWith('#')) return evalArgs[1]; return evalArgs[0] }
  fnConcatenate(vals) { const s = this.flatten(vals).map(v => this.toStr(v)).join(''); return { value: s, text: s, error: null } }
  fnLeft(vals) { const s = this.toStr(vals[0]), n = this.toNum(vals[1] ?? 1); return { value: s.substring(0, n), text: s.substring(0, n), error: null } }
  fnRight(vals) { const s = this.toStr(vals[0]), n = this.toNum(vals[1] ?? 1); return { value: s.substring(s.length - n), text: s.substring(s.length - n), error: null } }
  fnMid(vals) { const s = this.toStr(vals[0]), start = this.toNum(vals[1]) - 1, n = this.toNum(vals[2]); return { value: s.substring(start, start + n), text: s.substring(start, start + n), error: null } }
  fnLen(vals) { return { value: this.toStr(vals[0]).length, text: String(this.toStr(vals[0]).length), error: null } }
  fnLower(vals) { return { value: this.toStr(vals[0]).toLowerCase(), text: this.toStr(vals[0]).toLowerCase(), error: null } }
  fnUpper(vals) { return { value: this.toStr(vals[0]).toUpperCase(), text: this.toStr(vals[0]).toUpperCase(), error: null } }
  fnTrim(vals) { return { value: this.toStr(vals[0]).trim(), text: this.toStr(vals[0]).trim(), error: null } }
  fnClean(vals) { return { value: this.toStr(vals[0]).replace(/[\x00-\x1F]/g, ''), text: this.toStr(vals[0]).replace(/[\x00-\x1F]/g, ''), error: null } }
  fnProper(vals) { return { value: this.toStr(vals[0]).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()), text: this.toStr(vals[0]).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase()), error: null } }
  fnExact(vals) { const v = this.toStr(vals[0]) === this.toStr(vals[1]); return { value: v, text: String(v), error: null } }
  fnFind(vals) { const s = this.toStr(vals[0]), t = this.toStr(vals[1]), start = this.toNum(vals[2] ?? 1) - 1; const idx = t.indexOf(s, start); if (idx < 0) return { value: null, text: null, error: '#VALUE!' }; return { value: idx + 1, text: String(idx + 1), error: null } }
  fnSearch(vals) { const s = this.toStr(vals[0]).toLowerCase(), t = this.toStr(vals[1]).toLowerCase(), start = this.toNum(vals[2] ?? 1) - 1; const idx = t.indexOf(s, start); if (idx < 0) return { value: null, text: null, error: '#VALUE!' }; return { value: idx + 1, text: String(idx + 1), error: null } }
  fnReplace(vals) { const s = this.toStr(vals[0]), start = this.toNum(vals[1]) - 1, num = this.toNum(vals[2]), rep = this.toStr(vals[3]); return { value: s.substring(0, start) + rep + s.substring(start + num), text: s.substring(0, start) + rep + s.substring(start + num), error: null } }
  fnSubstitute(vals) { const s = this.toStr(vals[0]), old = this.toStr(vals[1]), rep = this.toStr(vals[2]); return { value: s.split(old).join(rep), text: s.split(old).join(rep), error: null } }
  fnRept(vals) { const s = this.toStr(vals[0]), n = this.toNum(vals[1]); return { value: s.repeat(n), text: s.repeat(n), error: null } }
  fnValue(vals) { const n = Number(this.toStr(vals[0])); if (isNaN(n)) return { value: null, text: null, error: '#VALUE!' }; return { value: n, text: String(n), error: null } }
  fnT(vals) { return typeof vals[0] === 'string' ? { value: vals[0], text: vals[0], error: null } : { value: '', text: '', error: null } }
  fnN(vals) { return typeof vals[0] === 'number' ? { value: vals[0], text: String(vals[0]), error: null } : { value: 0, text: '0', error: null } }
  fnChar(vals) { return { value: String.fromCharCode(this.toNum(vals[0])), text: String.fromCharCode(this.toNum(vals[0])), error: null } }
  fnCode(vals) { return { value: this.toStr(vals[0]).charCodeAt(0), text: String(this.toStr(vals[0]).charCodeAt(0)), error: null } }
  fnSumIf(args, vals) { const range = this.getRangeValues(args[0]); const criteria = this.toStr(vals[1]); const sumRange = args.length > 2 ? this.getRangeValues(args[2]) : range; let sum = 0; for (let i = 0; i < range.length; i++) { if (this.matchCriteria(range[i], criteria)) sum += this.toNum(sumRange[i] ?? 0) } return { value: sum, text: String(sum), error: null } }
  fnCountIf(args, vals) { const range = this.getRangeValues(args[0]); const criteria = this.toStr(vals[1]); let count = 0; for (const v of range) if (this.matchCriteria(v, criteria)) count++; return { value: count, text: String(count), error: null } }
  fnAverageIf(args, vals) { const range = this.getRangeValues(args[0]); const criteria = this.toStr(vals[1]); const avgRange = args.length > 2 ? this.getRangeValues(args[2]) : range; let sum = 0, count = 0; for (let i = 0; i < range.length; i++) { if (this.matchCriteria(range[i], criteria)) { sum += this.toNum(avgRange[i] ?? 0); count++ } } if (count === 0) return { value: null, text: null, error: '#DIV/0!' }; return { value: sum / count, text: String(sum / count), error: null } }
  fnStdev(vals) { const n = this.flattenNums(vals); if (n.length < 2) return { value: null, text: null, error: '#DIV/0!' }; const avg = n.reduce((a, b) => a + b, 0) / n.length; const v = Math.sqrt(n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1)); return { value: v, text: String(v), error: null } }
  fnVar(vals) { const n = this.flattenNums(vals); if (n.length < 2) return { value: null, text: null, error: '#DIV/0!' }; const avg = n.reduce((a, b) => a + b, 0) / n.length; const v = n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1); return { value: v, text: String(v), error: null } }
  fnMedian(vals) { const n = this.flattenNums(vals).sort((a, b) => a - b); const mid = Math.floor(n.length / 2); return { value: n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2, text: String(n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2), error: null } }
  fnLarge(vals) { const n = this.flattenNums(vals).sort((a, b) => b - a); const k = this.toNum(vals[1] ?? 1); if (k < 1 || k > n.length) return { value: null, text: null, error: '#NUM!' }; return { value: n[k - 1], text: String(n[k - 1]), error: null } }
  fnSmall(vals) { const n = this.flattenNums(vals).sort((a, b) => a - b); const k = this.toNum(vals[1] ?? 1); if (k < 1 || k > n.length) return { value: null, text: null, error: '#NUM!' }; return { value: n[k - 1], text: String(n[k - 1]), error: null } }
  fnPmt(vals) { const rate = this.toNum(vals[0]), nper = this.toNum(vals[1]), pv = this.toNum(vals[2]); if (rate === 0) return { value: -pv / nper, text: String(-pv / nper), error: null }; const v = pv * rate * Math.pow(1 + rate, nper) / (Math.pow(1 + rate, nper) - 1); return { value: -v, text: String(-v), error: null } }
  fnFv(vals) { const rate = this.toNum(vals[0]), nper = this.toNum(vals[1]), pmt = this.toNum(vals[2]), pv = this.toNum(vals[3] ?? 0); const v = pv * Math.pow(1 + rate, nper) + pmt * (Math.pow(1 + rate, nper) - 1) / rate; return { value: -v, text: String(-v), error: null } }
  fnPv(vals) { const rate = this.toNum(vals[0]), nper = this.toNum(vals[1]), pmt = this.toNum(vals[2]); const v = pmt * (1 - Math.pow(1 + rate, -nper)) / rate; return { value: v, text: String(v), error: null } }
  fnSln(vals) { const cost = this.toNum(vals[0]), salvage = this.toNum(vals[1]), life = this.toNum(vals[2]); return { value: (cost - salvage) / life, text: String((cost - salvage) / life), error: null } }
  fnYear(vals) { const d = new Date((this.toNum(vals[0]) - 25569) * 86400000); return { value: d.getFullYear(), text: String(d.getFullYear()), error: null } }
  fnMonth(vals) { const d = new Date((this.toNum(vals[0]) - 25569) * 86400000); return { value: d.getMonth() + 1, text: String(d.getMonth() + 1), error: null } }
  fnDay(vals) { const d = new Date((this.toNum(vals[0]) - 25569) * 86400000); return { value: d.getDate(), text: String(d.getDate()), error: null } }
  fnWeekday(vals) { const d = new Date((this.toNum(vals[0]) - 25569) * 86400000); return { value: d.getDay() + 1, text: String(d.getDay() + 1), error: null } }
  clear() { this.cells.clear(); this.cache.clear() }
}

// ====== 測試 ======
function runTests() {
  const formula = new FormulaEngine()
  const results = []
  let passed = 0, failed = 0
  
  function assert(name, condition) {
    if (condition) {
      results.push(`✅ ${name}`)
      passed++
    } else {
      results.push(`❌ ${name}`)
      failed++
    }
  }
  
  function testEval(name, formulaStr, expected) {
    const result = formula.eval(formulaStr)
    const pass = result.error ? false : Math.abs(result.value - expected) < 0.001 || result.value === expected
    if (!pass) {
      console.log(`${name}: 期望 ${expected}, 實際 ${result.value}, 錯誤 ${result.error}`)
    }
    assert(name, pass)
  }
  
  formula.clear()
  formula.setCell(1, 1, { v: 25 })
  formula.setCell(2, 1, { v: 30 })
  formula.setCell(3, 1, { v: 28 })
  
  testEval('SUM 基本', '=SUM(1,2,3)', 6)
  testEval('SUM 範圍', '=SUM(B2:B4)', 83)
  testEval('AVERAGE 範圍', '=AVERAGE(B2:B4)', 27.666666666666668)
  testEval('COUNT 範圍', '=COUNT(B2:B4)', 3)
  testEval('MAX 範圍', '=MAX(B2:B4)', 30)
  testEval('MIN 範圍', '=MIN(B2:B4)', 25)
  
  formula.clear()
  formula.setCell(0, 0, { v: 'A' })
  formula.setCell(0, 1, { v: 'B' })
  
  testEval('CONCATENATE', '=CONCATENATE(A1,B1)', 'AB')
  
  formula.clear()
  formula.setCell(0, 0, { v: 'Hello World' })
  
  testEval('UPPER', '=UPPER(A1)', 'HELLO WORLD')
  testEval('LOWER', '=LOWER(A1)', 'hello world')
  testEval('LEN', '=LEN(A1)', 11)
  testEval('LEFT', '=LEFT(A1,5)', 'Hello')
  testEval('RIGHT', '=RIGHT(A1,5)', 'World')
  testEval('MID', '=MID(A1,7,5)', 'World')
  
  formula.clear()
  formula.setCell(0, 0, { v: 10 })
  formula.setCell(0, 1, { v: 20 })
  
  testEval('IF true', '=IF(A1>5,"Yes","No")', 'Yes')
  testEval('IF false', '=IF(A1>15,"Yes","No")', 'No')
  testEval('AND', '=AND(A1>5,B1>15)', true)
  testEval('OR', '=OR(A1>15,B1>15)', true)
  testEval('NOT', '=NOT(A1>15)', true)
  
  formula.clear()
  formula.setCell(0, 0, { v: 100 })
  formula.setCell(0, 1, { v: 200 })
  formula.setCell(0, 2, { v: 300 })
  
  testEval('SUM 3 cells', '=SUM(A1:C1)', 600)
  testEval('AVERAGE 3 cells', '=AVERAGE(A1:C1)', 200)
  testEval('COUNT 3 cells', '=COUNT(A1:C1)', 3)
  
  testEval('ABS', '=ABS(-42)', 42)
  testEval('INT', '=INT(3.7)', 3)
  testEval('ROUND', '=ROUND(3.14159,2)', 3.14)
  testEval('MOD', '=MOD(10,3)', 1)
  testEval('POWER', '=POWER(2,3)', 8)
  testEval('SQRT', '=SQRT(16)', 4)
  testEval('CEILING', '=CEILING(4.3,1)', 5)
  testEval('FLOOR', '=FLOOR(4.7,1)', 4)
  testEval('EVEN', '=EVEN(3)', 4)
  testEval('ODD', '=ODD(3)', 3)
  testEval('SIGN', '=SIGN(-5)', -1)
  testEval('EXP', '=EXP(0)', 1)
  testEval('LN', '=LN(1)', 0)
  testEval('LOG', '=LOG(100,10)', 2)
  testEval('LOG10', '=LOG10(100)', 2)
  testEval('PI', '=PI()', Math.PI)
  testEval('FACT', '=FACT(5)', 120)
  testEval('COMBIN', '=COMBIN(10,3)', 120)
  
  testEval('SIN', '=SIN(0)', 0)
  testEval('COS', '=COS(0)', 1)
  testEval('TAN', '=TAN(0)', 0)
  
  testEval('TRUE', '=TRUE()', true)
  testEval('FALSE', '=FALSE()', false)
  testEval('IFERROR', '=IFERROR(1/0,"Error")', 'Error')
  
  formula.clear()
  formula.setCell(0, 0, { v: 5 })
  formula.setCell(0, 1, { v: 3 })
  
  testEval('ADD', '=ADD(A1,B1)', 8)
  testEval('MINUS', '=MINUS(A1,B1)', 2)
  testEval('MULTIPLY', '=MULTIPLY(A1,B1)', 15)
  testEval('DIVIDE', '=DIVIDE(A1,B1)', 1.6666666666666667)
  testEval('GT', '=GT(A1,B1)', true)
  testEval('LT', '=LT(A1,B1)', false)
  testEval('EQ', '=EQ(A1,A1)', true)
  testEval('NE', '=NE(A1,B1)', true)
  
  testEval('CHAR', '=CHAR(65)', 'A')
  testEval('CODE', '=CODE("A")', 65)
  testEval('TRIM', '=TRIM("  Hi  ")', 'Hi')
  testEval('PROPER', '=PROPER("hello")', 'Hello')
  testEval('EXACT', '=EXACT("Hi","Hi")', true)
  testEval('FIND', '=FIND("World","Hello World")', 7)
  testEval('SEARCH', '=SEARCH("world","Hello World")', 7)
  testEval('REPLACE', '=REPLACE("Hello",6,1," World")', 'Hello World')
  testEval('SUBSTITUTE', '=SUBSTITUTE("Hello World","World","JS")', 'Hello JS')
  testEval('REPT', '=REPT("Hi",3)', 'HiHiHi')
  testEval('VALUE', '=VALUE("123")', 123)
  testEval('T', '=T("Hello")', 'Hello')
  testEval('N', '=N(123)', 123)
  
  formula.clear()
  formula.setCell(0, 0, { v: 10 })
  formula.setCell(0, 1, { v: 20 })
  formula.setCell(0, 2, { v: 30 })
  formula.setCell(0, 3, { v: 40 })
  formula.setCell(0, 4, { v: 50 })
  
  testEval('STDEV', '=STDEV(A1:E1)', 15.811388300841896)
  testEval('VAR', '=VAR(A1:E1)', 250)
  testEval('MEDIAN', '=MEDIAN(A1:E1)', 30)
  testEval('LARGE', '=LARGE(A1:E1,2)', 40)
  testEval('SMALL', '=SMALL(A1:E1,2)', 20)
  
  testEval('PMT', '=PMT(0.05/12,60,10000)', -188.71)
  testEval('SLN', '=SLN(10000,2000,5)', 1600)
  
  testEval('YEAR', '=YEAR(44197)', 2021)
  testEval('MONTH', '=MONTH(44197)', 1)
  testEval('DAY', '=DAY(44197)', 1)
  testEval('WEEKDAY', '=WEEKDAY(44197)', 6)
  
  testEval('四則運算', '=(1+2)*3-4/2', 7)
  testEval('巢狀函數', '=SUM(1,2,3)+AVERAGE(4,5,6)', 11)
  
  console.log('\n========================================')
  console.log('      LiteSheet 公式引擎測試報告')
  console.log('========================================\n')
  results.forEach(r => console.log(r))
  console.log('\n========================================')
  console.log(`總計: ${passed + failed} 項測試`)
  console.log(`通過: ${passed} 項`)
  console.log(`失敗: ${failed} 項`)
  console.log(`通過率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  console.log('========================================\n')
  
  return failed === 0
}

const success = runTests()
process.exit(success ? 0 : 1)
