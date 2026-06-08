"use strict";
var litesheet = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    CanvasRenderer: () => CanvasRenderer,
    EventBus: () => EventBus,
    Events: () => Events,
    FormulaEngine: () => FormulaEngine,
    JSFormulaEngine: () => JSFormulaEngine,
    Spreadsheet: () => Spreadsheet,
    Store: () => Store
  });

  // src/core/events/EventBus.ts
  var EventBus = class {
    listeners = /* @__PURE__ */ new Map();
    on(event, handler) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, /* @__PURE__ */ new Set());
      }
      this.listeners.get(event).add(handler);
      return () => this.off(event, handler);
    }
    off(event, handler) {
      this.listeners.get(event)?.delete(handler);
    }
    emit(event, ...args) {
      this.listeners.get(event)?.forEach((handler) => {
        try {
          handler(...args);
        } catch (e) {
          console.error(`Error in event handler for ${event}:`, e);
        }
      });
    }
    once(event, handler) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        handler(...args);
      };
      return this.on(event, wrapper);
    }
    clear() {
      this.listeners.clear();
    }
  };
  var Events = {
    CELL_CHANGE: "cell:change",
    CELL_CLICK: "cell:click",
    CELL_DBLCLICK: "cell:dblclick",
    SELECTION_CHANGE: "selection:change",
    SHEET_CHANGE: "sheet:change",
    WORKBOOK_LOAD: "workbook:load",
    RENDER_COMPLETE: "render:complete",
    FORMULA_CALCULATE: "formula:calculate",
    UNDO: "undo",
    REDO: "redo"
  };

  // src/core/store/Store.ts
  var Store = class {
    state;
    listeners = /* @__PURE__ */ new Set();
    history = [];
    historyIndex = -1;
    constructor(initialData) {
      this.state = {
        data: initialData || { sheets: [], activeSheetIndex: 0 },
        activeSheetIndex: 0,
        selection: null,
        selections: [],
        editingCell: null
      };
      this.saveHistory();
    }
    getState() {
      return this.state;
    }
    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    notify() {
      this.listeners.forEach((listener) => listener(this.state));
    }
    saveHistory() {
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(JSON.parse(JSON.stringify(this.state)));
      this.historyIndex = this.history.length - 1;
    }
    getActiveSheet() {
      return this.state.data.sheets[this.state.activeSheetIndex];
    }
    getCell(row, col) {
      const sheet = this.getActiveSheet();
      if (!sheet) return void 0;
      return sheet.celldata.find((cell) => cell.r === row && cell.c === col)?.v;
    }
    setCell(row, col, value) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      const existingIndex = sheet.celldata.findIndex(
        (cell) => cell.r === row && cell.c === col
      );
      if (existingIndex >= 0) {
        sheet.celldata[existingIndex].v = value;
      } else {
        sheet.celldata.push({ r: row, c: col, v: value });
      }
      this.saveHistory();
      this.notify();
    }
    setActiveSheet(index) {
      if (index >= 0 && index < this.state.data.sheets.length) {
        this.state.activeSheetIndex = index;
        this.state.data.activeSheetIndex = index;
        this.state.selection = null;
        this.state.selections = [];
        this.state.editingCell = null;
        this.saveHistory();
        this.notify();
      }
    }
    expandSelectionWithMerge(selection) {
      if (!selection) return null;
      const sheet = this.getActiveSheet();
      if (!sheet || !sheet.config.merge) return selection;
      let [rStart, rEnd] = [selection.row[0], selection.row[1]];
      let [cStart, cEnd] = [selection.column[0], selection.column[1]];
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const m of Object.values(sheet.config.merge)) {
          const mRowStart = m.r;
          const mRowEnd = m.r + m.rs - 1;
          const mColStart = m.c;
          const mColEnd = m.c + m.cs - 1;
          const intersect = !(mRowStart > rEnd || mRowEnd < rStart || mColStart > cEnd || mColEnd < cStart);
          if (intersect) {
            const newRStart = Math.min(rStart, mRowStart);
            const newREnd = Math.max(rEnd, mRowEnd);
            const newCStart = Math.min(cStart, mColStart);
            const newCEnd = Math.max(cEnd, mColEnd);
            if (newRStart !== rStart || newREnd !== rEnd || newCStart !== cStart || newCEnd !== cEnd) {
              rStart = newRStart;
              rEnd = newREnd;
              cStart = newCStart;
              cEnd = newCEnd;
              expanded = true;
            }
          }
        }
      }
      return {
        row: [rStart, rEnd],
        column: [cStart, cEnd]
      };
    }
    setSelection(selection) {
      const expanded = this.expandSelectionWithMerge(selection);
      this.state.selection = expanded;
      this.state.selections = expanded ? [expanded] : [];
      this.notify();
    }
    setSelections(selections) {
      const expandedSelections = selections.map((s) => this.expandSelectionWithMerge(s)).filter(Boolean);
      this.state.selections = expandedSelections;
      this.state.selection = expandedSelections[expandedSelections.length - 1] || null;
      this.notify();
    }
    setEditingCell(cell) {
      this.state.editingCell = cell;
      this.notify();
    }
    setFrozen(row, col) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      sheet.config.frozen = { row, column: col };
      this.saveHistory();
      this.notify();
    }
    setRowHidden(row, hidden) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      if (!sheet.config.rowhidden) sheet.config.rowhidden = {};
      if (hidden) {
        sheet.config.rowhidden[row] = true;
      } else {
        delete sheet.config.rowhidden[row];
      }
      this.saveHistory();
      this.notify();
    }
    insertRow(r) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      sheet.celldata.forEach((cell) => {
        if (cell.r >= r) cell.r++;
      });
      sheet.row++;
      if (sheet.config.merge) {
        const newMerge = {};
        Object.entries(sheet.config.merge).forEach(([_, m]) => {
          if (m.r >= r) {
            m.r++;
          } else if (m.r + m.rs > r) {
            m.rs++;
          }
          newMerge[`${m.r},${m.c}`] = m;
        });
        sheet.config.merge = newMerge;
      }
      if (sheet.config.rowlen) {
        const newRowLen = {};
        Object.entries(sheet.config.rowlen).forEach(([key, len]) => {
          const rowIdx = parseInt(key);
          if (rowIdx >= r) {
            newRowLen[rowIdx + 1] = len;
          } else {
            newRowLen[rowIdx] = len;
          }
        });
        sheet.config.rowlen = newRowLen;
      }
      this.saveHistory();
      this.notify();
    }
    insertCol(c) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      sheet.celldata.forEach((cell) => {
        if (cell.c >= c) cell.c++;
      });
      sheet.column++;
      if (sheet.config.merge) {
        const newMerge = {};
        Object.entries(sheet.config.merge).forEach(([_, m]) => {
          if (m.c >= c) {
            m.c++;
          } else if (m.c + m.cs > c) {
            m.cs++;
          }
          newMerge[`${m.r},${m.c}`] = m;
        });
        sheet.config.merge = newMerge;
      }
      if (sheet.config.columnlen) {
        const newColLen = {};
        Object.entries(sheet.config.columnlen).forEach(([key, len]) => {
          const colIdx = parseInt(key);
          if (colIdx >= c) {
            newColLen[colIdx + 1] = len;
          } else {
            newColLen[colIdx] = len;
          }
        });
        sheet.config.columnlen = newColLen;
      }
      this.saveHistory();
      this.notify();
    }
    deleteRow(r) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      sheet.celldata = sheet.celldata.filter((cell) => cell.r !== r);
      sheet.celldata.forEach((cell) => {
        if (cell.r > r) cell.r--;
      });
      sheet.row--;
      if (sheet.config.merge) {
        const newMerge = {};
        Object.entries(sheet.config.merge).forEach(([_, m]) => {
          if (m.r === r && m.rs === 1) return;
          if (m.r > r) {
            m.r--;
          } else if (m.r + m.rs > r) {
            m.rs--;
          }
          newMerge[`${m.r},${m.c}`] = m;
        });
        sheet.config.merge = newMerge;
      }
      if (sheet.config.rowlen) {
        const newRowLen = {};
        Object.entries(sheet.config.rowlen).forEach(([key, len]) => {
          const rowIdx = parseInt(key);
          if (rowIdx === r) return;
          if (rowIdx > r) {
            newRowLen[rowIdx - 1] = len;
          } else {
            newRowLen[rowIdx] = len;
          }
        });
        sheet.config.rowlen = newRowLen;
      }
      this.saveHistory();
      this.notify();
    }
    deleteCol(c) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      sheet.celldata = sheet.celldata.filter((cell) => cell.c !== c);
      sheet.celldata.forEach((cell) => {
        if (cell.c > c) cell.c--;
      });
      sheet.column--;
      if (sheet.config.merge) {
        const newMerge = {};
        Object.entries(sheet.config.merge).forEach(([_, m]) => {
          if (m.c === c && m.cs === 1) return;
          if (m.c > c) {
            m.c--;
          } else if (m.c + m.cs > c) {
            m.cs--;
          }
          newMerge[`${m.r},${m.c}`] = m;
        });
        sheet.config.merge = newMerge;
      }
      if (sheet.config.columnlen) {
        const newColLen = {};
        Object.entries(sheet.config.columnlen).forEach(([key, len]) => {
          const colIdx = parseInt(key);
          if (colIdx === c) return;
          if (colIdx > c) {
            newColLen[colIdx - 1] = len;
          } else {
            newColLen[colIdx] = len;
          }
        });
        sheet.config.columnlen = newColLen;
      }
      this.saveHistory();
      this.notify();
    }
    sortColumn(c, order) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      const rows = /* @__PURE__ */ new Map();
      sheet.celldata.forEach((cell) => {
        if (!rows.has(cell.r)) rows.set(cell.r, {});
        rows.get(cell.r)[cell.c] = cell;
      });
      const sorted = [...rows.entries()].sort((a, b) => {
        const va = a[1][c]?.v?.v ?? "";
        const vb = b[1][c]?.v?.v ?? "";
        if (typeof va === "number" && typeof vb === "number") {
          return order === "asc" ? va - vb : vb - va;
        }
        return order === "asc" ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      });
      const newCelldata = [];
      sorted.forEach(([_oldR, cells], newR) => {
        Object.values(cells).forEach((cell) => {
          newCelldata.push({ ...cell, r: newR });
        });
      });
      sheet.celldata = newCelldata;
      this.saveHistory();
      this.notify();
    }
    mergeCells(selection) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      if (!sheet.config.merge) sheet.config.merge = {};
      const [rStart, rEnd] = selection.row;
      const [cStart, cEnd] = selection.column;
      const key = `${rStart},${cStart}`;
      sheet.config.merge[key] = {
        r: rStart,
        c: cStart,
        rs: rEnd - rStart + 1,
        cs: cEnd - cStart + 1
      };
      sheet.celldata = sheet.celldata.filter((cell) => {
        const inside = cell.r >= rStart && cell.r <= rEnd && cell.c >= cStart && cell.c <= cEnd;
        const isTopLeft = cell.r === rStart && cell.c === cStart;
        return !inside || isTopLeft;
      });
      this.saveHistory();
      this.notify();
    }
    unmergeCells(selection) {
      const sheet = this.getActiveSheet();
      if (!sheet || !sheet.config.merge) return;
      const [rStart, cStart] = [selection.row[0], selection.column[0]];
      const key = `${rStart},${cStart}`;
      delete sheet.config.merge[key];
      this.saveHistory();
      this.notify();
    }
    clearRange(selection) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      const targets = this.state.selections.length > 0 ? this.state.selections : [selection];
      for (const sel of targets) {
        const [rStart, rEnd] = sel.row;
        const [cStart, cEnd] = sel.column;
        sheet.celldata.forEach((cell) => {
          if (cell.r >= rStart && cell.r <= rEnd && cell.c >= cStart && cell.c <= cEnd) {
            if (cell.v) {
              cell.v.v = null;
              delete cell.v.f;
              delete cell.v.m;
            }
          }
        });
      }
      this.saveHistory();
      this.notify();
    }
    fillRange(source, target) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      const [sRowStart, sRowEnd] = source.row;
      const [sColStart, sColEnd] = source.column;
      const [tRowStart, tRowEnd] = target.row;
      const [tColStart, tColEnd] = target.column;
      const sRowHeight = sRowEnd - sRowStart + 1;
      const sColWidth = sColEnd - sColStart + 1;
      for (let r = tRowStart; r <= tRowEnd; r++) {
        for (let c = tColStart; c <= tColEnd; c++) {
          if (r >= sRowStart && r <= sRowEnd && c >= sColStart && c <= sColEnd) {
            continue;
          }
          const sR = sRowStart + (r - tRowStart) % sRowHeight;
          const sC = sColStart + (c - tColStart) % sColWidth;
          const sourceVal = this.getCell(sR, sC);
          if (sourceVal) {
            const copyVal = JSON.parse(JSON.stringify(sourceVal));
            const existingIndex = sheet.celldata.findIndex((cell) => cell.r === r && cell.c === c);
            if (existingIndex >= 0) {
              sheet.celldata[existingIndex].v = copyVal;
            } else {
              sheet.celldata.push({ r, c, v: copyVal });
            }
          }
        }
      }
      this.saveHistory();
      this.notify();
    }
    setColumnWidth(col, width, saveHistoryState = true) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      if (!sheet.config.columnlen) sheet.config.columnlen = {};
      sheet.config.columnlen[col] = width;
      if (saveHistoryState) {
        this.saveHistory();
      }
      this.notify();
    }
    setRowHeight(row, height, saveHistoryState = true) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      if (!sheet.config.rowlen) sheet.config.rowlen = {};
      sheet.config.rowlen[row] = height;
      if (saveHistoryState) {
        this.saveHistory();
      }
      this.notify();
    }
    setStyle(selection, styleUpdater) {
      const sheet = this.getActiveSheet();
      if (!sheet) return;
      const targets = this.state.selections.length > 0 ? this.state.selections : [selection];
      for (const sel of targets) {
        for (let r = sel.row[0]; r <= sel.row[1]; r++) {
          for (let c = sel.column[0]; c <= sel.column[1]; c++) {
            const existingIndex = sheet.celldata.findIndex((cell2) => cell2.r === r && cell2.c === c);
            let cell;
            if (existingIndex >= 0) {
              cell = sheet.celldata[existingIndex].v;
            } else {
              cell = { v: null };
              sheet.celldata.push({ r, c, v: cell });
            }
            if (!cell.s) cell.s = {};
            styleUpdater(cell.s, cell);
          }
        }
      }
      this.saveHistory();
      this.notify();
    }
    undo() {
      if (this.historyIndex > 0) {
        this.historyIndex--;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this.notify();
        return true;
      }
      return false;
    }
    redo() {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
        this.notify();
        return true;
      }
      return false;
    }
    loadData(data) {
      this.state.data = data;
      this.state.activeSheetIndex = data.activeSheetIndex || 0;
      this.state.selection = null;
      this.state.selections = [];
      this.state.editingCell = null;
      this.history = [];
      this.historyIndex = -1;
      this.saveHistory();
      this.notify();
    }
    moveSheet(from, to) {
      const sheets = this.state.data.sheets;
      if (from < 0 || from >= sheets.length || to < 0 || to >= sheets.length || from === to) return;
      const [moved] = sheets.splice(from, 1);
      sheets.splice(to, 0, moved);
      if (this.state.activeSheetIndex === from) this.state.data.activeSheetIndex = to;
      else if (from < this.state.activeSheetIndex && to >= this.state.activeSheetIndex) this.state.activeSheetIndex--;
      else if (from > this.state.activeSheetIndex && to <= this.state.activeSheetIndex) this.state.activeSheetIndex++;
      else this.state.data.activeSheetIndex = this.state.activeSheetIndex;
      this.saveHistory();
      this.notify();
    }
  };

  // src/formula/FormulaEngine.ts
  var FormulaEngine = class {
    engine = null;
    initialized = false;
    async init() {
      try {
        const pkgPath = "./pkg/formula_engine";
        const wasm = await import(
          /* @vite-ignore */
          pkgPath
        );
        await wasm.default();
        this.engine = new wasm.FormulaEngine();
        this.initialized = true;
      } catch (e) {
        console.warn("WASM formula engine not available, using JS fallback");
        this.initialized = false;
      }
    }
    setCell(row, col, value) {
      if (this.initialized && this.engine) {
        this.engine.set_cell(row, col, value);
      }
    }
    getCell(row, col) {
      if (this.initialized && this.engine) {
        return this.engine.get_cell(row, col);
      }
      return null;
    }
    calculate(row, col) {
      if (this.initialized && this.engine) {
        return this.engine.calculate(row, col);
      }
      return { value: null, text: null, error: "Engine not initialized" };
    }
    clearCache() {
      if (this.initialized && this.engine) {
        this.engine.clear_cache();
      }
    }
    clear() {
      if (this.initialized && this.engine) {
        this.engine.clear();
      }
    }
    isInitialized() {
      return this.initialized;
    }
  };
  var JSFormulaEngine = class {
    cells = /* @__PURE__ */ new Map();
    calculating = /* @__PURE__ */ new Set();
    cache = /* @__PURE__ */ new Map();
    setCell(row, col, value) {
      this.cells.set(`${row}:${col}`, value);
      this.cache.clear();
    }
    getCell(row, col) {
      return this.cells.get(`${row}:${col}`) || null;
    }
    clearCache() {
      this.cache.clear();
    }
    clear() {
      this.cells.clear();
      this.cache.clear();
      this.calculating.clear();
    }
    calculate(row, col) {
      const key = `${row}:${col}`;
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      if (this.calculating.has(key)) {
        return { value: null, text: null, error: "#REF!" };
      }
      this.calculating.add(key);
      const cell = this.getCell(row, col);
      let result;
      if (!cell) {
        result = { value: null, text: null, error: null };
      } else {
        const cv = cell.v;
        const cf = cell.f;
        if (cf) {
          result = this.eval(cf);
          result = {
            ...result,
            text: result.error || String(result.value ?? "")
          };
        } else {
          result = {
            value: cv,
            text: cv != null ? String(cv) : null,
            error: null
          };
        }
      }
      this.calculating.delete(key);
      this.cache.set(key, result);
      return result;
    }
    eval(f) {
      if (!f || !f.startsWith("=")) {
        return { value: f, text: String(f ?? ""), error: null };
      }
      try {
        return this.evalExpr(f.substring(1));
      } catch (e) {
        return { value: null, text: null, error: "#ERROR!" };
      }
    }
    isSingleFunc(expr) {
      const funcMatch = expr.match(/^([A-Z0-9_]+)\((.*)\)$/s);
      if (!funcMatch) return null;
      const name = funcMatch[1];
      const inner = funcMatch[2];
      let depth = 1;
      let inStr = false;
      const firstOpenIdx = name.length;
      for (let i = firstOpenIdx + 1; i < expr.length; i++) {
        if (expr[i] === '"') inStr = !inStr;
        if (inStr) continue;
        if (expr[i] === "(") depth++;
        else if (expr[i] === ")") {
          depth--;
          if (depth === 0) {
            if (i === expr.length - 1) return [name, inner];
            return null;
          }
        }
      }
      return null;
    }
    evalExpr(expr) {
      expr = expr.trim();
      const singleFunc = this.isSingleFunc(expr);
      if (singleFunc) {
        return this.callFunc(singleFunc[0], singleFunc[1]);
      }
      if (expr.startsWith("(") && expr.endsWith(")")) {
        return this.evalExpr(expr.slice(1, -1));
      }
      for (const op of [">=", "<=", "<>", ">", "<", "="]) {
        const parts = this.splitBinary(expr, op);
        if (parts) {
          const a = this.evalExpr(parts[0]);
          const b = this.evalExpr(parts[1]);
          const valA = a.value;
          const valB = b.value;
          let r;
          if (op === ">=") r = valA >= valB;
          else if (op === "<=") r = valA <= valB;
          else if (op === "<>") r = valA != valB;
          else if (op === ">") r = valA > valB;
          else if (op === "<") r = valA < valB;
          else r = valA == valB;
          return { value: r, text: String(r).toUpperCase(), error: null };
        }
      }
      for (const op of ["+", "-", "*", "/", "^"]) {
        const parts = this.splitBinary(expr, op);
        if (parts) {
          const a = this.evalExpr(parts[0]);
          const b = this.evalExpr(parts[1]);
          const na = this.toNum(a.value);
          const nb = this.toNum(b.value);
          let r;
          if (op === "+") r = na + nb;
          else if (op === "-") r = na - nb;
          else if (op === "*") r = na * nb;
          else if (op === "/") {
            if (nb === 0) return { value: null, text: null, error: "#DIV/0!" };
            r = na / nb;
          } else {
            r = Math.pow(na, nb);
          }
          return { value: r, text: String(r), error: null };
        }
      }
      if (expr.startsWith('"') && expr.endsWith('"')) {
        const val = expr.slice(1, -1);
        return { value: val, text: val, error: null };
      }
      if (expr.toUpperCase() === "TRUE") {
        return { value: true, text: "TRUE", error: null };
      }
      if (expr.toUpperCase() === "FALSE") {
        return { value: false, text: "FALSE", error: null };
      }
      const num = Number(expr);
      if (!isNaN(num) && expr !== "") {
        return { value: num, text: String(num), error: null };
      }
      const ref = this.parseRef(expr.toUpperCase());
      if (ref) {
        const v = this.getCell(ref[0], ref[1]);
        if (v) {
          const cv = v.v;
          const cf = v.f;
          if (cf) {
            return this.calculate(ref[0], ref[1]);
          }
          return { value: cv, text: String(cv ?? ""), error: null };
        }
        return { value: 0, text: "0", error: null };
      }
      if (expr.includes(":")) {
        return { value: expr, text: expr, error: null };
      }
      return { value: expr, text: expr, error: null };
    }
    splitBinary(expr, op) {
      let depth = 0;
      let inStr = false;
      for (let i = expr.length - 1; i >= 0; i--) {
        if (expr[i] === '"') inStr = !inStr;
        if (inStr) continue;
        if (expr[i] === ")") depth++;
        else if (expr[i] === "(") depth--;
        if (depth === 0 && expr.substring(i, i + op.length) === op) {
          if (op === "-" && i === 0) continue;
          if (op === "-" && i > 0 && "+-*/^>=<".includes(expr[i - 1])) continue;
          const left = expr.substring(0, i).trim();
          const right = expr.substring(i + op.length).trim();
          if (left && right) return [left, right];
        }
      }
      return null;
    }
    callFunc(name, argsStr) {
      const args = this.splitArgs(argsStr);
      const evalArgs = args.map((a) => this.evalExpr(a.trim()));
      const vals = [];
      for (let i = 0; i < evalArgs.length; i++) {
        const a = evalArgs[i];
        if (typeof a.value === "string" && a.value.includes(":")) {
          vals.push(...this.getRangeValues(a.value));
        } else {
          vals.push(a.value);
        }
      }
      switch (name) {
        case "SUM": {
          const n = this.flattenNums(vals);
          const s = n.reduce((a, b) => a + b, 0);
          return { value: s, text: String(s), error: null };
        }
        case "AVERAGE": {
          const n = this.flattenNums(vals);
          if (!n.length) return { value: null, text: null, error: "#DIV/0!" };
          const s = n.reduce((a, b) => a + b, 0) / n.length;
          return { value: s, text: String(s), error: null };
        }
        case "COUNT": {
          return { value: this.flattenNums(vals).length, text: String(this.flattenNums(vals).length), error: null };
        }
        case "MAX": {
          const n = this.flattenNums(vals);
          if (!n.length) return { value: 0, text: "0", error: null };
          return { value: Math.max(...n), text: String(Math.max(...n)), error: null };
        }
        case "MIN": {
          const n = this.flattenNums(vals);
          if (!n.length) return { value: 0, text: "0", error: null };
          return { value: Math.min(...n), text: String(Math.min(...n)), error: null };
        }
        case "ABS":
          return { value: Math.abs(this.toNum(vals[0])), text: String(Math.abs(this.toNum(vals[0]))), error: null };
        case "INT":
          return { value: Math.floor(this.toNum(vals[0])), text: String(Math.floor(this.toNum(vals[0]))), error: null };
        case "ROUND": {
          const n = this.toNum(vals[0]);
          const d = this.toNum(vals[1] ?? 0);
          const v = Number(n.toFixed(d));
          return { value: v, text: String(v), error: null };
        }
        case "MOD": {
          const a = this.toNum(vals[0]);
          const b = this.toNum(vals[1]);
          if (b === 0) return { value: null, text: null, error: "#DIV/0!" };
          const v = a - b * Math.floor(a / b);
          return { value: v, text: String(v), error: null };
        }
        case "POWER":
          return { value: Math.pow(this.toNum(vals[0]), this.toNum(vals[1])), text: String(Math.pow(this.toNum(vals[0]), this.toNum(vals[1]))), error: null };
        case "SQRT": {
          const n = this.toNum(vals[0]);
          if (n < 0) return { value: null, text: null, error: "#NUM!" };
          return { value: Math.sqrt(n), text: String(Math.sqrt(n)), error: null };
        }
        case "IF": {
          if (evalArgs.length < 2) return { value: null, text: null, error: "#VALUE!" };
          return evalArgs[0].value ? evalArgs[1] : evalArgs[2] || { value: false, text: "FALSE", error: null };
        }
        case "AND":
          return { value: this.flatten(vals).every(Boolean), text: String(this.flatten(vals).every(Boolean)), error: null };
        case "OR":
          return { value: this.flatten(vals).some(Boolean), text: String(this.flatten(vals).some(Boolean)), error: null };
        case "NOT":
          return { value: !vals[0], text: String(!vals[0]), error: null };
        case "CONCATENATE":
        case "CONCAT": {
          const s = this.flatten(vals).map((v) => this.toStr(v)).join("");
          return { value: s, text: s, error: null };
        }
        case "LEFT": {
          const s = this.toStr(vals[0]);
          const n = this.toNum(vals[1] ?? 1);
          return { text: s.substring(0, n), value: s.substring(0, n), error: null };
        }
        case "RIGHT": {
          const s = this.toStr(vals[0]);
          const n = this.toNum(vals[1] ?? 1);
          return { text: s.substring(s.length - n), value: s.substring(s.length - n), error: null };
        }
        case "MID": {
          const s = this.toStr(vals[0]);
          const st = this.toNum(vals[1]) - 1;
          const n = this.toNum(vals[2]);
          return { text: s.substring(st, st + n), value: s.substring(st, st + n), error: null };
        }
        case "LEN":
          return { value: this.toStr(vals[0]).length, text: String(this.toStr(vals[0]).length), error: null };
        case "UPPER":
          return { value: this.toStr(vals[0]).toUpperCase(), text: this.toStr(vals[0]).toUpperCase(), error: null };
        case "LOWER":
          return { value: this.toStr(vals[0]).toLowerCase(), text: this.toStr(vals[0]).toLowerCase(), error: null };
        case "TRIM":
          return { value: this.toStr(vals[0]).trim(), text: this.toStr(vals[0]).trim(), error: null };
        case "NOW": {
          const d = /* @__PURE__ */ new Date();
          return { value: d.toISOString(), text: d.toLocaleString(), error: null };
        }
        case "TODAY": {
          const d = /* @__PURE__ */ new Date();
          return { value: d.toISOString().split("T")[0], text: d.toLocaleDateString(), error: null };
        }
        case "PI":
          return { value: Math.PI, text: String(Math.PI), error: null };
        case "TRUE":
          return { value: true, text: "TRUE", error: null };
        case "FALSE":
          return { value: false, text: "FALSE", error: null };
        case "IFERROR": {
          if (evalArgs.length < 2) return { value: null, text: null, error: "#VALUE!" };
          return evalArgs[0].error ? evalArgs[1] : evalArgs[0];
        }
        case "ADD":
          return { value: this.toNum(vals[0]) + this.toNum(vals[1]), text: String(this.toNum(vals[0]) + this.toNum(vals[1])), error: null };
        case "MINUS":
          return { value: this.toNum(vals[0]) - this.toNum(vals[1]), text: String(this.toNum(vals[0]) - this.toNum(vals[1])), error: null };
        case "MULTIPLY":
          return { value: this.toNum(vals[0]) * this.toNum(vals[1]), text: String(this.toNum(vals[0]) * this.toNum(vals[1])), error: null };
        case "DIVIDE": {
          const b = this.toNum(vals[1]);
          if (b === 0) return { value: null, text: null, error: "#DIV/0!" };
          return { value: this.toNum(vals[0]) / b, text: String(this.toNum(vals[0]) / b), error: null };
        }
        case "GT":
          return { value: vals[0] > vals[1], text: String(vals[0] > vals[1]).toUpperCase(), error: null };
        case "LT":
          return { value: vals[0] < vals[1], text: String(vals[0] < vals[1]).toUpperCase(), error: null };
        case "EQ":
          return { value: vals[0] == vals[1], text: String(vals[0] == vals[1]).toUpperCase(), error: null };
        case "NE":
          return { value: vals[0] != vals[1], text: String(vals[0] != vals[1]).toUpperCase(), error: null };
        case "LARGE": {
          const n = this.flattenNums(this.flatten(vals.slice(0, -1)));
          const k = this.toNum(vals[vals.length - 1]);
          if (k <= 0 || k > n.length) return { value: null, text: null, error: "#NUM!" };
          const sorted = [...n].sort((a, b) => b - a);
          const v = sorted[k - 1];
          return { value: v, text: String(v), error: null };
        }
        case "SMALL": {
          const n = this.flattenNums(this.flatten(vals.slice(0, -1)));
          const k = this.toNum(vals[vals.length - 1]);
          if (k <= 0 || k > n.length) return { value: null, text: null, error: "#NUM!" };
          const sorted = [...n].sort((a, b) => a - b);
          const v = sorted[k - 1];
          return { value: v, text: String(v), error: null };
        }
        case "VLOOKUP": {
          const lookupVal = evalArgs[0].value;
          const range = this.getRange2D(args[1]);
          const colIdx = this.toNum(evalArgs[2].value) - 1;
          if (!range.length || colIdx < 0 || colIdx >= range[0].length) {
            return { value: null, text: null, error: "#REF!" };
          }
          for (let r = 0; r < range.length; r++) {
            if (range[r][0] == lookupVal) {
              return { value: range[r][colIdx], text: this.toStr(range[r][colIdx]), error: null };
            }
          }
          return { value: null, text: null, error: "#N/A" };
        }
        case "SUMIF": {
          const range = this.getRangeValues(args[0]);
          const criteria = this.toStr(vals[1]);
          const sumRange = args.length > 2 ? this.getRangeValues(args[2]) : range;
          let sum = 0;
          for (let i = 0; i < range.length; i++) {
            if (this.matchCriteria(range[i], criteria)) {
              sum += this.toNum(sumRange[i] ?? 0);
            }
          }
          return { value: sum, text: String(sum), error: null };
        }
        case "COUNTIF": {
          const range = this.getRangeValues(args[0]);
          const criteria = this.toStr(vals[1]);
          let count = 0;
          for (const v of range) {
            if (this.matchCriteria(v, criteria)) count++;
          }
          return { value: count, text: String(count), error: null };
        }
        case "PRODUCT": {
          const n = this.flattenNums(vals);
          const p = n.reduce((a, b) => a * b, 1);
          return { value: p, text: String(p), error: null };
        }
        case "SIGN":
          return { value: Math.sign(this.toNum(vals[0])), text: String(Math.sign(this.toNum(vals[0]))), error: null };
        case "EXP":
          return { value: Math.exp(this.toNum(vals[0])), text: String(Math.exp(this.toNum(vals[0]))), error: null };
        case "LN": {
          const n = this.toNum(vals[0]);
          if (n <= 0) return { value: null, text: null, error: "#NUM!" };
          return { value: Math.log(n), text: String(Math.log(n)), error: null };
        }
        case "LOG": {
          const n = this.toNum(vals[0]);
          const b = this.toNum(vals[1] ?? 10);
          return { value: Math.log(n) / Math.log(b), text: String(Math.log(n) / Math.log(b)), error: null };
        }
        case "LOG10": {
          const n = this.toNum(vals[0]);
          return { value: Math.log10(n), text: String(Math.log10(n)), error: null };
        }
        case "SIN":
          return { value: Math.sin(this.toNum(vals[0])), text: String(Math.sin(this.toNum(vals[0]))), error: null };
        case "COS":
          return { value: Math.cos(this.toNum(vals[0])), text: String(Math.cos(this.toNum(vals[0]))), error: null };
        case "TAN":
          return { value: Math.tan(this.toNum(vals[0])), text: String(Math.tan(this.toNum(vals[0]))), error: null };
        case "CEILING": {
          const n = this.toNum(vals[0]);
          const s = this.toNum(vals[1] ?? 1);
          if (s === 0) return { value: 0, text: "0", error: null };
          const v = Math.ceil(n / s) * s;
          return { value: v, text: String(v), error: null };
        }
        case "FLOOR": {
          const n = this.toNum(vals[0]);
          const s = this.toNum(vals[1] ?? 1);
          if (s === 0) return { value: 0, text: "0", error: null };
          const v = Math.floor(n / s) * s;
          return { value: v, text: String(v), error: null };
        }
        case "EVEN": {
          const v = this.toNum(vals[0]);
          const r = v < 0 ? Math.floor(v / 2) * 2 : Math.ceil(v / 2) * 2;
          return { value: r, text: String(r), error: null };
        }
        case "ODD": {
          const v = this.toNum(vals[0]);
          const r = v < 0 ? Math.floor((v - 1) / 2) * 2 + 1 : Math.ceil((v - 1) / 2) * 2 + 1;
          return { value: r, text: String(r), error: null };
        }
        case "COMBIN": {
          const n = Math.floor(this.toNum(vals[0]));
          const k = Math.floor(this.toNum(vals[1]));
          if (n < 0 || k < 0 || k > n) return { value: null, text: null, error: "#NUM!" };
          let r = 1;
          for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1);
          const rounded = Math.round(r);
          return { value: rounded, text: String(rounded), error: null };
        }
        case "PROPER": {
          const text = this.toStr(vals[0]).replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.substring(1).toLowerCase());
          return { value: text, text, error: null };
        }
        case "EXACT": {
          const v = this.toStr(vals[0]) === this.toStr(vals[1]);
          return { value: v, text: String(v), error: null };
        }
        case "CLEAN": {
          const text = this.toStr(vals[0]).replace(/[\x00-\x1F]/g, "");
          return { value: text, text, error: null };
        }
        case "SLN": {
          const cost = this.toNum(vals[0]);
          const salvage = this.toNum(vals[1]);
          const life = this.toNum(vals[2]);
          if (life === 0) return { value: null, text: null, error: "#DIV/0!" };
          const v = (cost - salvage) / life;
          return { value: v, text: String(v), error: null };
        }
        case "YEAR": {
          const d = new Date((this.toNum(vals[0]) - 25569) * 864e5);
          return { value: d.getFullYear(), text: String(d.getFullYear()), error: null };
        }
        case "MONTH": {
          const d = new Date((this.toNum(vals[0]) - 25569) * 864e5);
          return { value: d.getMonth() + 1, text: String(d.getMonth() + 1), error: null };
        }
        case "DAY": {
          const d = new Date((this.toNum(vals[0]) - 25569) * 864e5);
          return { value: d.getDate(), text: String(d.getDate()), error: null };
        }
        case "WEEKDAY": {
          const d = new Date((this.toNum(vals[0]) - 25569) * 864e5);
          return { value: d.getDay() + 1, text: String(d.getDay() + 1), error: null };
        }
        case "FACT": {
          const n = Math.floor(this.toNum(vals[0]));
          if (n < 0) return { value: null, text: null, error: "#NUM!" };
          let r = 1;
          for (let i = 2; i <= n; i++) r *= i;
          return { value: r, text: String(r), error: null };
        }
        case "FIND": {
          const s = this.toStr(vals[0]);
          const t = this.toStr(vals[1]);
          const st = this.toNum(vals[2] ?? 1) - 1;
          const idx = t.indexOf(s, st);
          if (idx < 0) return { value: null, text: null, error: "#VALUE!" };
          return { value: idx + 1, text: String(idx + 1), error: null };
        }
        case "SEARCH": {
          const s = this.toStr(vals[0]).toLowerCase();
          const t = this.toStr(vals[1]).toLowerCase();
          const st = this.toNum(vals[2] ?? 1) - 1;
          const idx = t.indexOf(s, st);
          if (idx < 0) return { value: null, text: null, error: "#VALUE!" };
          return { value: idx + 1, text: String(idx + 1), error: null };
        }
        case "REPLACE": {
          const s = this.toStr(vals[0]);
          const st = this.toNum(vals[1]) - 1;
          const num = this.toNum(vals[2]);
          const rep = this.toStr(vals[3]);
          const text = s.substring(0, st) + rep + s.substring(st + num);
          return { text, value: text, error: null };
        }
        case "SUBSTITUTE": {
          const s = this.toStr(vals[0]);
          const old = this.toStr(vals[1]);
          const rep = this.toStr(vals[2]);
          const text = s.split(old).join(rep);
          return { text, value: text, error: null };
        }
        case "REPT": {
          const s = this.toStr(vals[0]);
          const n = this.toNum(vals[1]);
          const text = s.repeat(n);
          return { text, value: text, error: null };
        }
        case "VALUE": {
          const n = Number(this.toStr(vals[0]));
          if (isNaN(n)) return { value: null, text: null, error: "#VALUE!" };
          return { value: n, text: String(n), error: null };
        }
        case "CHAR":
          return { value: String.fromCharCode(this.toNum(vals[0])), text: String.fromCharCode(this.toNum(vals[0])), error: null };
        case "CODE":
          return { value: this.toStr(vals[0]).charCodeAt(0), text: String(this.toStr(vals[0]).charCodeAt(0)), error: null };
        case "STDEV": {
          const n = this.flattenNums(vals);
          if (n.length < 2) return { value: null, text: null, error: "#DIV/0!" };
          const avg = n.reduce((a, b) => a + b, 0) / n.length;
          const v = Math.sqrt(n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1));
          return { value: v, text: String(v), error: null };
        }
        case "VAR": {
          const n = this.flattenNums(vals);
          if (n.length < 2) return { value: null, text: null, error: "#DIV/0!" };
          const avg = n.reduce((a, b) => a + b, 0) / n.length;
          const v = n.reduce((s, x) => s + (x - avg) ** 2, 0) / (n.length - 1);
          return { value: v, text: String(v), error: null };
        }
        case "MEDIAN": {
          const n = this.flattenNums(vals).sort((a, b) => a - b);
          const mid = Math.floor(n.length / 2);
          const val = n.length % 2 ? n[mid] : (n[mid - 1] + n[mid]) / 2;
          return { value: val, text: String(val), error: null };
        }
        case "PMT": {
          const rate = this.toNum(vals[0]);
          const nper = this.toNum(vals[1]);
          const pv = this.toNum(vals[2]);
          if (rate === 0) return { value: -pv / nper, text: String(-pv / nper), error: null };
          const v = pv * rate * Math.pow(1 + rate, nper) / (Math.pow(1 + rate, nper) - 1);
          return { value: -v, text: String(-v), error: null };
        }
        case "FV": {
          const rate = this.toNum(vals[0]);
          const nper = this.toNum(vals[1]);
          const pmt = this.toNum(vals[2]);
          const pv = this.toNum(vals[3] ?? 0);
          const v = pv * Math.pow(1 + rate, nper) + pmt * (Math.pow(1 + rate, nper) - 1) / rate;
          return { value: -v, text: String(-v), error: null };
        }
        case "PV": {
          const rate = this.toNum(vals[0]);
          const nper = this.toNum(vals[1]);
          const pmt = this.toNum(vals[2]);
          const v = pmt * (1 - Math.pow(1 + rate, -nper)) / rate;
          return { value: v, text: String(v), error: null };
        }
        case "T":
          return typeof vals[0] === "string" ? { value: vals[0], text: vals[0], error: null } : { value: "", text: "", error: null };
        case "N":
          return typeof vals[0] === "number" ? { value: vals[0], text: String(vals[0]), error: null } : { value: 0, text: "0", error: null };
        case "ISBLANK":
          return { value: vals[0] == null || vals[0] === "", text: vals[0] == null || vals[0] === "" ? "TRUE" : "FALSE", error: null };
        case "ISNUMBER":
          return { value: typeof vals[0] === "number", text: typeof vals[0] === "number" ? "TRUE" : "FALSE", error: null };
        case "ISTEXT":
          return { value: typeof vals[0] === "string", text: typeof vals[0] === "string" ? "TRUE" : "FALSE", error: null };
        default:
          return { value: null, text: null, error: "#NAME?" };
      }
    }
    toNum(v) {
      if (v == null || v === "") return 0;
      if (typeof v === "boolean") return v ? 1 : 0;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    }
    toStr(v) {
      return v == null ? "" : String(v);
    }
    flatten(vals) {
      const r = [];
      for (const v of vals) {
        if (Array.isArray(v)) {
          for (const x of v) r.push(x);
        } else {
          r.push(v);
        }
      }
      return r;
    }
    flattenNums(vals) {
      return this.flatten(vals).filter((v) => typeof v === "number" || typeof v === "string" && v !== "" && !isNaN(Number(v))).map(Number);
    }
    getRangeValues(rangeStr) {
      rangeStr = rangeStr.trim();
      if (rangeStr.includes(":")) {
        const [a, b] = rangeStr.split(":");
        const s1 = this.parseRef(a.trim().toUpperCase());
        const s2 = this.parseRef(b.trim().toUpperCase());
        if (!s1 || !s2) return [];
        const vals = [];
        for (let r = s1[0]; r <= s2[0]; r++) {
          for (let c = s1[1]; c <= s2[1]; c++) {
            const x = this.getCell(r, c);
            if (x) {
              const xv = x.v;
              const xf = x.f;
              if (xf) {
                const res = this.calculate(r, c);
                vals.push(res.value);
              } else if (xv != null) {
                vals.push(xv);
              } else {
                vals.push(null);
              }
            } else {
              vals.push(null);
            }
          }
        }
        return vals;
      }
      const ref = this.parseRef(rangeStr.toUpperCase());
      if (ref) {
        const x = this.getCell(ref[0], ref[1]);
        if (x) {
          const xv = x.v;
          const xf = x.f;
          if (xf) {
            return [this.calculate(ref[0], ref[1]).value];
          }
          return [xv];
        }
        return [null];
      }
      return [rangeStr];
    }
    getRange2D(rangeStr) {
      rangeStr = rangeStr.trim();
      if (!rangeStr.includes(":")) {
        const ref = this.parseRef(rangeStr.toUpperCase());
        if (ref) {
          const x = this.getCell(ref[0], ref[1]);
          if (x) {
            const xv = x.v;
            const xf = x.f;
            if (xf) return [[this.calculate(ref[0], ref[1]).value]];
            return [[xv]];
          }
          return [[null]];
        }
        return [[rangeStr]];
      }
      const [a, b] = rangeStr.split(":");
      const s1 = this.parseRef(a.trim().toUpperCase());
      const s2 = this.parseRef(b.trim().toUpperCase());
      if (!s1 || !s2) return [[]];
      const result = [];
      for (let r = s1[0]; r <= s2[0]; r++) {
        const row = [];
        for (let c = s1[1]; c <= s2[1]; c++) {
          const x = this.getCell(r, c);
          if (x) {
            const xv = x.v;
            const xf = x.f;
            if (xf) {
              const res = this.calculate(r, c);
              row.push(res.value);
            } else {
              row.push(xv);
            }
          } else {
            row.push(null);
          }
        }
        result.push(row);
      }
      return result;
    }
    parseRef(ref) {
      const m = ref.match(/^([A-Z]+)(\d+)$/);
      if (!m) return null;
      let c = 0;
      for (let i = 0; i < m[1].length; i++) {
        c = c * 26 + (m[1].charCodeAt(i) - 64);
      }
      return [parseInt(m[2]) - 1, c - 1];
    }
    splitArgs(s) {
      const args = [];
      let depth = 0;
      let current = "";
      let inStr = false;
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '"') inStr = !inStr;
        if (!inStr) {
          if (s[i] === "(") depth++;
          else if (s[i] === ")") depth--;
          else if (s[i] === "," && depth === 0) {
            args.push(current);
            current = "";
            continue;
          }
        }
        current += s[i];
      }
      if (current) args.push(current);
      return args;
    }
    matchCriteria(val, criteria) {
      if (val == null) val = "";
      const s = String(val);
      if (criteria.startsWith(">=")) return this.toNum(s) >= this.toNum(criteria.substring(2));
      if (criteria.startsWith("<=")) return this.toNum(s) <= this.toNum(criteria.substring(2));
      if (criteria.startsWith("<>")) return s !== criteria.substring(2);
      if (criteria.startsWith(">")) return this.toNum(s) > this.toNum(criteria.substring(1));
      if (criteria.startsWith("<")) return this.toNum(s) < this.toNum(criteria.substring(1));
      return s == criteria;
    }
  };

  // src/rendering/canvas/CanvasRenderer.ts
  var DEFAULT_CONFIG = {
    defaultRowHeight: 25,
    defaultColWidth: 80,
    headerHeight: 25,
    headerWidth: 50,
    fontSize: 13,
    fontFamily: "Arial"
  };
  var CanvasRenderer = class {
    canvas;
    ctx;
    cfg;
    baseCfg;
    sheet = null;
    rowH = [];
    colW = [];
    scrollTop = 0;
    scrollLeft = 0;
    zoomRatio = 1;
    selection = null;
    formulaEngine = null;
    constructor(canvas, config) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: false });
      this.baseCfg = { ...DEFAULT_CONFIG, ...config };
      this.cfg = { ...this.baseCfg };
      this.setupCanvas();
    }
    setFormulaEngine(engine) {
      this.formulaEngine = engine;
    }
    setZoom(ratio) {
      this.zoomRatio = Math.max(0.5, Math.min(3, ratio));
      this.cfg = {
        ...this.baseCfg,
        defaultRowHeight: Math.round(this.baseCfg.defaultRowHeight * this.zoomRatio),
        defaultColWidth: Math.round(this.baseCfg.defaultColWidth * this.zoomRatio),
        headerHeight: Math.round(this.baseCfg.headerHeight * this.zoomRatio),
        headerWidth: Math.round(this.baseCfg.headerWidth * this.zoomRatio),
        fontSize: Math.round(this.baseCfg.fontSize * this.zoomRatio)
      };
      this.calcDim();
      this.render();
    }
    setupCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const rect = this.canvas.getBoundingClientRect();
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;
    }
    setSheet(sheet) {
      this.sheet = sheet;
      this.calcDim();
      this.render();
    }
    calcDim() {
      if (!this.sheet) return;
      this.rowH = [];
      const hidden = this.sheet.config.rowhidden || {};
      for (let r = 0; r < this.sheet.row; r++) {
        if (hidden[r]) {
          this.rowH[r] = 0;
        } else {
          this.rowH[r] = this.sheet.config.rowlen?.[r] || this.cfg.defaultRowHeight;
        }
      }
      this.colW = [];
      for (let c = 0; c < this.sheet.column; c++) {
        this.colW[c] = this.sheet.config.columnlen?.[c] || this.cfg.defaultColWidth;
      }
    }
    setScroll(top, left) {
      this.scrollTop = top;
      this.scrollLeft = left;
      this.render();
    }
    selections = [];
    setSelection(selection) {
      this.selection = selection;
      this.selections = selection ? [selection] : [];
      this.render();
    }
    setSelections(selections) {
      this.selections = selections;
      this.selection = selections[selections.length - 1] || null;
      this.render();
    }
    render() {
      if (!this.sheet) return;
      const { width, height } = this.canvas.getBoundingClientRect();
      const ctx = this.ctx;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      this.renderCells(width, height);
      this.renderGrid(width, height);
      this.renderHeaders(width, height);
      this.renderSelection();
    }
    getVisibleRange(width, height) {
      const { headerHeight, headerWidth } = this.cfg;
      const frozen = this.sheet?.config.frozen || { row: 0, column: 0 };
      const fRows = Math.min(frozen.row || 0, this.rowH.length);
      const fCols = Math.min(frozen.column || 0, this.colW.length);
      let frozenH = 0;
      for (let r = 0; r < fRows; r++) frozenH += this.rowH[r];
      let frozenW = 0;
      for (let c = 0; c < fCols; c++) frozenW += this.colW[c];
      const visibleWidth = width - headerWidth - frozenW;
      const visibleHeight = height - headerHeight - frozenH;
      let startRow = fRows;
      let accumH = 0;
      for (let r = fRows; r < this.rowH.length; r++) {
        if (accumH + this.rowH[r] > this.scrollTop) {
          startRow = r;
          break;
        }
        accumH += this.rowH[r];
      }
      let endRow = startRow;
      let curH = accumH - this.scrollTop;
      for (let r = startRow; r < this.rowH.length; r++) {
        curH += this.rowH[r];
        endRow = r;
        if (curH > visibleHeight) break;
      }
      let startCol = fCols;
      let accumW = 0;
      for (let c = fCols; c < this.colW.length; c++) {
        if (accumW + this.colW[c] > this.scrollLeft) {
          startCol = c;
          break;
        }
        accumW += this.colW[c];
      }
      let endCol = startCol;
      let curW = accumW - this.scrollLeft;
      for (let c = startCol; c < this.colW.length; c++) {
        curW += this.colW[c];
        endCol = c;
        if (curW > visibleWidth) break;
      }
      const buffer = 3;
      startRow = Math.max(fRows, startRow - buffer);
      endRow = Math.min(this.rowH.length - 1, endRow + buffer);
      startCol = Math.max(fCols, startCol - buffer);
      endCol = Math.min(this.colW.length - 1, endCol + buffer);
      let scrollStartX = headerWidth + frozenW - this.scrollLeft;
      for (let c = fCols; c < startCol; c++) scrollStartX += this.colW[c];
      let scrollStartY = headerHeight + frozenH - this.scrollTop;
      for (let r = fRows; r < startRow; r++) scrollStartY += this.rowH[r];
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
        scrollStartY
      };
    }
    renderHeaders(width, height) {
      const ctx = this.ctx;
      const { headerHeight, headerWidth } = this.cfg;
      const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height);
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, width, headerHeight);
      ctx.fillRect(0, 0, headerWidth, height);
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 1;
      const sels = this.selections.length > 0 ? this.selections : this.selection ? [this.selection] : [];
      const isColSel = (c) => sels.some((s) => c >= s.column[0] && c <= s.column[1]);
      const isRowSel = (r) => sels.some((s) => r >= s.row[0] && r <= s.row[1]);
      let x = headerWidth;
      for (let c = 0; c < fCols; c++) {
        const colWidth = this.colW[c];
        ctx.fillStyle = isColSel(c) ? "#e8f0fe" : "#f8f9fa";
        ctx.fillRect(x, 0, colWidth, headerHeight);
        ctx.strokeRect(x, 0, colWidth, headerHeight);
        ctx.fillStyle = isColSel(c) ? "#1a73e8" : "#333333";
        ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.colName(c), x + colWidth / 2, headerHeight / 2);
        x += colWidth;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth + frozenW, 0, width - headerWidth - frozenW, headerHeight);
      ctx.clip();
      x = scrollStartX;
      for (let c = startCol; c <= endCol; c++) {
        const colWidth = this.colW[c];
        ctx.fillStyle = isColSel(c) ? "#e8f0fe" : "#f8f9fa";
        ctx.fillRect(x, 0, colWidth, headerHeight);
        ctx.strokeRect(x, 0, colWidth, headerHeight);
        ctx.fillStyle = isColSel(c) ? "#1a73e8" : "#333333";
        ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.colName(c), x + colWidth / 2, headerHeight / 2);
        x += colWidth;
      }
      ctx.restore();
      let y = headerHeight;
      for (let r = 0; r < fRows; r++) {
        const rowHeight = this.rowH[r];
        ctx.fillStyle = isRowSel(r) ? "#e8f0fe" : "#f8f9fa";
        ctx.fillRect(0, y, headerWidth, rowHeight);
        ctx.strokeRect(0, y, headerWidth, rowHeight);
        ctx.fillStyle = isRowSel(r) ? "#1a73e8" : "#333333";
        ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((r + 1).toString(), headerWidth / 2, y + rowHeight / 2);
        y += rowHeight;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, headerHeight + frozenH, headerWidth, height - headerHeight - frozenH);
      ctx.clip();
      y = scrollStartY;
      for (let r = startRow; r <= endRow; r++) {
        const rowHeight = this.rowH[r];
        ctx.fillStyle = isRowSel(r) ? "#e8f0fe" : "#f8f9fa";
        ctx.fillRect(0, y, headerWidth, rowHeight);
        ctx.strokeRect(0, y, headerWidth, rowHeight);
        ctx.fillStyle = isRowSel(r) ? "#1a73e8" : "#333333";
        ctx.font = `bold ${this.cfg.fontSize}px ${this.cfg.fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((r + 1).toString(), headerWidth / 2, y + rowHeight / 2);
        y += rowHeight;
      }
      ctx.restore();
      ctx.fillStyle = "#f8f9fa";
      ctx.fillRect(0, 0, headerWidth, headerHeight);
      ctx.strokeRect(0, 0, headerWidth, headerHeight);
    }
    renderCells(width, height) {
      const ctx = this.ctx;
      const { headerHeight, headerWidth, fontSize, fontFamily } = this.cfg;
      const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height);
      const cellMap = /* @__PURE__ */ new Map();
      this.sheet.celldata.forEach((cell) => {
        cellMap.set(`${cell.r},${cell.c}`, cell.v);
      });
      const isMergedCell = /* @__PURE__ */ new Map();
      if (this.sheet && this.sheet.config && this.sheet.config.merge) {
        Object.values(this.sheet.config.merge).forEach((m) => {
          for (let r = m.r; r < m.r + m.rs; r++) {
            for (let c = m.c; c < m.c + m.cs; c++) {
              isMergedCell.set(`${r},${c}`, m);
            }
          }
        });
      }
      const drawCellBlock = (rStart, rEnd, cStart, cEnd, initX, initY) => {
        let y = initY;
        for (let r = rStart; r <= rEnd; r++) {
          const rowHeight = this.rowH[r];
          if (rowHeight === 0) continue;
          let x = initX;
          for (let c = cStart; c <= cEnd; c++) {
            const colWidth = this.colW[c];
            if (colWidth === 0) continue;
            const merge = isMergedCell.get(`${r},${c}`);
            let renderW = colWidth;
            let renderH = rowHeight;
            if (merge) {
              if (r !== merge.r || c !== merge.c) {
                x += colWidth;
                continue;
              }
              renderW = 0;
              for (let mc = merge.c; mc < merge.c + merge.cs; mc++) {
                renderW += this.colW[mc];
              }
              renderH = 0;
              for (let mr = merge.r; mr < merge.r + merge.rs; mr++) {
                renderH += this.rowH[mr];
              }
            }
            const cell = cellMap.get(`${r},${c}`);
            if (cell) {
              let displayValue = null;
              const cv = cell.v;
              const cf = cell.f;
              if (cf && this.formulaEngine) {
                const result = this.formulaEngine.calculate(r, c);
                displayValue = result.error || result.text || "";
              } else if (cv != null) {
                displayValue = cell.m || String(cv);
              }
              if (displayValue !== null) {
                const style = cell.s || {};
                if (style.bc) {
                  ctx.fillStyle = style.bc;
                  ctx.fillRect(x + 0.5, y + 0.5, renderW - 1, renderH - 1);
                }
                ctx.fillStyle = style.fc || "#333333";
                let fontStyle = "";
                if (style.bl) fontStyle += "bold ";
                if (style.it) fontStyle += "italic ";
                ctx.font = `${fontStyle}${style.fs || fontSize}px ${style.ff || fontFamily}`;
                let align = "left";
                if (style.ht === 1) align = "center";
                else if (style.ht === 2) align = "right";
                ctx.textAlign = align;
                ctx.textBaseline = "middle";
                const fa = cell.ct && cell.ct.fa ? String(cell.ct.fa) : "";
                let textVal = String(displayValue);
                if (fa && fa !== "general" && !cf) {
                  textVal = this.applyNumberFormat(cv, fa, textVal);
                }
                const indentPx = (style.indent || 0) * 12;
                const PAD = 4;
                const maxTextW = renderW - PAD * 2 - indentPx;
                const wrap = style.tb === 2;
                if (wrap) {
                  this.drawWrappedText(ctx, textVal, x + PAD + indentPx, y, renderW - PAD * 2 - indentPx, renderH, fontSize, style);
                } else {
                  let finalVal = textVal;
                  if (ctx.measureText(finalVal).width > maxTextW) {
                    while (finalVal.length > 0 && ctx.measureText(finalVal + "\u2026").width > maxTextW) {
                      finalVal = finalVal.slice(0, -1);
                    }
                    if (finalVal.length < textVal.length) finalVal = finalVal + "\u2026";
                  }
                  const tx = align === "center" ? x + renderW / 2 : align === "right" ? x + renderW - PAD - indentPx : x + PAD + indentPx;
                  let ty;
                  if (style.vt === 1) ty = y + (style.fs || fontSize) / 2 + 2;
                  else if (style.vt === 3) ty = y + renderH - (style.fs || fontSize) / 2 - 2;
                  else ty = y + renderH / 2;
                  ctx.fillText(finalVal, tx, ty);
                  if (style.ul || style.st) {
                    const metrics = ctx.measureText(finalVal);
                    const textWidth = metrics.width;
                    let startX = x + PAD + indentPx;
                    if (align === "center") {
                      startX = x + renderW / 2 - textWidth / 2;
                    } else if (align === "right") {
                      startX = x + renderW - PAD - indentPx - textWidth;
                    }
                    const endX = startX + textWidth;
                    ctx.save();
                    ctx.strokeStyle = style.fc || "#333333";
                    ctx.lineWidth = 1;
                    if (style.ul) {
                      ctx.beginPath();
                      ctx.moveTo(startX, ty + (style.fs || fontSize) / 2 - 1);
                      ctx.lineTo(endX, ty + (style.fs || fontSize) / 2 - 1);
                      ctx.stroke();
                    }
                    if (style.st) {
                      ctx.beginPath();
                      ctx.moveTo(startX, ty);
                      ctx.lineTo(endX, ty);
                      ctx.stroke();
                    }
                    ctx.restore();
                  }
                }
              }
            }
            x += colWidth;
          }
          y += rowHeight;
        }
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth + frozenW, headerHeight + frozenH, width - headerWidth - frozenW, height - headerHeight - frozenH);
      ctx.clip();
      drawCellBlock(startRow, endRow, startCol, endCol, scrollStartX, scrollStartY);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth + frozenW, headerHeight, width - headerWidth - frozenW, frozenH);
      ctx.clip();
      drawCellBlock(0, fRows - 1, startCol, endCol, scrollStartX, headerHeight);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight + frozenH, frozenW, height - headerHeight - frozenH);
      ctx.clip();
      drawCellBlock(startRow, endRow, 0, fCols - 1, headerWidth, scrollStartY);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight, frozenW, frozenH);
      ctx.clip();
      drawCellBlock(0, fRows - 1, 0, fCols - 1, headerWidth, headerHeight);
      ctx.restore();
    }
    renderGrid(width, height) {
      const ctx = this.ctx;
      const { headerHeight, headerWidth } = this.cfg;
      const { fRows, fCols, frozenH, frozenW, startRow, endRow, startCol, endCol, scrollStartX, scrollStartY } = this.getVisibleRange(width, height);
      ctx.strokeStyle = "#e8e8e8";
      ctx.lineWidth = 0.5;
      const isMergedCell = /* @__PURE__ */ new Map();
      if (this.sheet && this.sheet.config && this.sheet.config.merge) {
        Object.values(this.sheet.config.merge).forEach((m) => {
          for (let r = m.r; r < m.r + m.rs; r++) {
            for (let c = m.c; c < m.c + m.cs; c++) {
              isMergedCell.set(`${r},${c}`, m);
            }
          }
        });
      }
      const drawGridLines = (isVertical, isFrozen) => {
        if (isVertical) {
          let x = isFrozen ? headerWidth : scrollStartX;
          const limit = isFrozen ? fCols : endCol;
          const cStart = isFrozen ? 0 : startCol;
          for (let c = cStart; c <= limit; c++) {
            const colWidth = this.colW[c];
            let y = headerHeight;
            const rLimit = this.sheet ? this.sheet.row - 1 : 0;
            for (let r = 0; r <= rLimit; r++) {
              const mergeLeft = isMergedCell.get(`${r},${c - 1}`);
              const mergeRight = isMergedCell.get(`${r},${c}`);
              const inSameMerge = mergeLeft && mergeRight && mergeLeft === mergeRight;
              if (!inSameMerge) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + this.rowH[r]);
                ctx.stroke();
              }
              y += this.rowH[r];
            }
            x += colWidth;
          }
        } else {
          let y = isFrozen ? headerHeight : scrollStartY;
          const limit = isFrozen ? fRows : endRow;
          const rStart = isFrozen ? 0 : startRow;
          for (let r = rStart; r <= limit; r++) {
            const rowHeight = this.rowH[r];
            let x = headerWidth;
            const cLimit = this.sheet ? this.sheet.column - 1 : 0;
            for (let c = 0; c <= cLimit; c++) {
              const mergeTop = isMergedCell.get(`${r - 1},${c}`);
              const mergeBottom = isMergedCell.get(`${r},${c}`);
              const inSameMerge = mergeTop && mergeBottom && mergeTop === mergeBottom;
              if (!inSameMerge) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + this.colW[c], y);
                ctx.stroke();
              }
              x += this.colW[c];
            }
            y += rowHeight;
          }
        }
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth + frozenW, headerHeight, width - headerWidth - frozenW, height - headerHeight);
      ctx.clip();
      drawGridLines(true, false);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight, frozenW, height - headerHeight);
      ctx.clip();
      drawGridLines(true, true);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight + frozenH, width - headerWidth, height - headerHeight - frozenH);
      ctx.clip();
      drawGridLines(false, false);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight, width - headerWidth, frozenH);
      ctx.clip();
      drawGridLines(false, true);
      ctx.restore();
      ctx.strokeStyle = "#999999";
      ctx.lineWidth = 1.5;
      if (frozenW > 0) {
        ctx.beginPath();
        ctx.moveTo(headerWidth + frozenW, headerHeight);
        ctx.lineTo(headerWidth + frozenW, height);
        ctx.stroke();
      }
      if (frozenH > 0) {
        ctx.beginPath();
        ctx.moveTo(headerWidth, headerHeight + frozenH);
        ctx.lineTo(width, headerHeight + frozenH);
        ctx.stroke();
      }
    }
    renderSelection() {
      const sels = this.selections.length > 0 ? this.selections : this.selection ? [this.selection] : [];
      if (sels.length === 0) return;
      const ctx = this.ctx;
      ctx.save();
      const { headerHeight, headerWidth } = this.cfg;
      ctx.beginPath();
      ctx.rect(headerWidth, headerHeight, this.canvas.width, this.canvas.height);
      ctx.clip();
      sels.forEach((sel, index) => {
        const [startRow, endRow] = sel.row;
        const [startCol, endCol] = sel.column;
        const startRect = this.getCellScreenRect(startRow, startCol);
        const endRect = this.getCellScreenRect(endRow, endCol);
        if (!startRect || !endRect) return;
        const startX = startRect.x;
        const startY = startRect.y;
        const endX = endRect.x + endRect.w;
        const endY = endRect.y + endRect.h;
        const selWidth = endX - startX;
        const selHeight = endY - startY;
        const isPrimary = index === sels.length - 1;
        ctx.fillStyle = isPrimary ? "rgba(26, 115, 232, 0.12)" : "rgba(26, 115, 232, 0.06)";
        ctx.fillRect(startX, startY, selWidth, selHeight);
        if (isPrimary) {
          ctx.strokeStyle = "#1a73e8";
          ctx.lineWidth = 2;
          ctx.strokeRect(startX, startY, selWidth, selHeight);
          ctx.fillStyle = "#1a73e8";
          ctx.fillRect(endX - 4, endY - 4, 6, 6);
        } else {
          ctx.strokeStyle = "#1a73e8";
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
          ctx.strokeRect(startX + 0.5, startY + 0.5, selWidth - 1, selHeight - 1);
          ctx.setLineDash([]);
        }
      });
      ctx.restore();
    }
    colName(c) {
      let name = "";
      while (c >= 0) {
        name = String.fromCharCode(65 + c % 26) + name;
        c = Math.floor(c / 26) - 1;
      }
      return name;
    }
    applyNumberFormat(value, fa, defaultText) {
      if (value == null || value === "") return defaultText;
      const lower = fa.toLowerCase();
      const v = typeof value === "number" ? value : Number(value);
      const isNum = !isNaN(v) && typeof v === "number" && value !== "" && value !== true && value !== false;
      try {
        if (lower === "general" || !fa) return defaultText;
        if (lower === "percent" && isNum) {
          return (v * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
        }
        if (lower === "currency" && isNum) {
          return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (lower === "accounting" && isNum) {
          return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (lower === "scientific" && isNum) {
          return v.toExponential(2);
        }
        if (lower === "number" && isNum) {
          return v.toLocaleString("en-US");
        }
        if (lower === "text") {
          return String(value);
        }
        if (lower === "date" || lower === "time" || lower === "datetime") {
          const d = isNum ? new Date((v - 25569) * 864e5) : new Date(value);
          if (isNaN(d.getTime())) return defaultText;
          if (lower === "date") return d.toLocaleDateString("zh-TW");
          if (lower === "time") return d.toLocaleTimeString("zh-TW");
          return d.toLocaleString("zh-TW");
        }
        const m = fa.match(/^0+(\.0+)?$/);
        if (m && isNum) {
          const decimals = m[1] ? m[1].length - 1 : 0;
          return v.toFixed(decimals);
        }
        const m2 = fa.match(/^#,##0(\.#0+)?$/);
        if (m2 && isNum) {
          const decimals = m2[1] ? m2[1].length - 1 : 0;
          return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        const m3 = fa.match(/^0+\s*%$/);
        if (m3 && isNum) {
          return v.toFixed(0) + "%";
        }
        const m4 = fa.match(/^0\.0+\s*%$/);
        if (m4 && isNum) {
          const dec = (fa.match(/\.0+/) || ["", ""])[1].length;
          return (v * 100).toFixed(dec) + "%";
        }
        return defaultText;
      } catch (e) {
        return defaultText;
      }
    }
    drawWrappedText(ctx, text, x, y, maxW, maxH, fontSize, style) {
      if (!text) return;
      const lines = [];
      const paragraphs = text.split("\n");
      for (const para of paragraphs) {
        let line = "";
        const words = para.split("");
        for (const ch of words) {
          const test = line + ch;
          if (ctx.measureText(test).width > maxW && line.length > 0) {
            lines.push(line);
            line = ch;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
      }
      const lineH = (style.fs || fontSize) * 1.2;
      const totalH = lines.length * lineH;
      let startY;
      if (style.vt === 1) startY = y + (style.fs || fontSize) / 2 + 2;
      else if (style.vt === 3) startY = y + maxH - totalH + fontSize / 2;
      else startY = y + (maxH - totalH) / 2 + fontSize / 2;
      const align = ctx.textAlign;
      ctx.save();
      for (let i = 0; i < lines.length; i++) {
        const ty = startY + i * lineH;
        if (ty - fontSize / 2 > y + maxH) break;
        const line = lines[i];
        let tx;
        if (align === "center") tx = x + maxW / 2;
        else if (align === "right") tx = x + maxW;
        else tx = x;
        ctx.fillText(line, tx, ty);
        if (style.ul || style.st) {
          const textWidth = ctx.measureText(line).width;
          let startX;
          if (align === "center") startX = x + maxW / 2 - textWidth / 2;
          else if (align === "right") startX = x + maxW - textWidth;
          else startX = x;
          const endX = startX + textWidth;
          ctx.strokeStyle = style.fc || "#333333";
          ctx.lineWidth = 1;
          if (style.ul) {
            ctx.beginPath();
            ctx.moveTo(startX, ty + (style.fs || fontSize) / 2 - 1);
            ctx.lineTo(endX, ty + (style.fs || fontSize) / 2 - 1);
            ctx.stroke();
          }
          if (style.st) {
            ctx.beginPath();
            ctx.moveTo(startX, ty);
            ctx.lineTo(endX, ty);
            ctx.stroke();
          }
        }
      }
      ctx.restore();
    }
    getCellScreenRect(row, col) {
      const { headerHeight, headerWidth } = this.cfg;
      const frozen = this.sheet?.config.frozen || { row: 0, column: 0 };
      const fRows = Math.min(frozen.row || 0, this.rowH.length);
      const fCols = Math.min(frozen.column || 0, this.colW.length);
      let x = headerWidth;
      if (col < fCols) {
        for (let c = 0; c < col; c++) x += this.colW[c];
      } else {
        let frozenW = 0;
        for (let c = 0; c < fCols; c++) frozenW += this.colW[c];
        x += frozenW - this.scrollLeft;
        for (let c = fCols; c < col; c++) x += this.colW[c];
      }
      let y = headerHeight;
      if (row < fRows) {
        for (let r = 0; r < row; r++) y += this.rowH[r];
      } else {
        let frozenH = 0;
        for (let r = 0; r < fRows; r++) frozenH += this.rowH[r];
        y += frozenH - this.scrollTop;
        for (let r = fRows; r < row; r++) y += this.rowH[r];
      }
      return { x, y, w: this.colW[col], h: this.rowH[row] };
    }
    getCellAt(px, py) {
      const { headerHeight, headerWidth } = this.cfg;
      if (!this.sheet || px < headerWidth || py < headerHeight) return null;
      const frozen = this.sheet.config.frozen || { row: 0, column: 0 };
      const fRows = Math.min(frozen.row || 0, this.rowH.length);
      const fCols = Math.min(frozen.column || 0, this.colW.length);
      let frozenH = 0;
      for (let r = 0; r < fRows; r++) frozenH += this.rowH[r];
      let frozenW = 0;
      for (let c = 0; c < fCols; c++) frozenW += this.colW[c];
      let col = -1;
      if (px < headerWidth + frozenW) {
        let currentX = headerWidth;
        for (let c = 0; c < fCols; c++) {
          if (px >= currentX && px < currentX + this.colW[c]) {
            col = c;
            break;
          }
          currentX += this.colW[c];
        }
      } else {
        let currentX = headerWidth + frozenW - this.scrollLeft;
        for (let c = fCols; c < this.sheet.column; c++) {
          if (px >= currentX && px < currentX + this.colW[c]) {
            col = c;
            break;
          }
          currentX += this.colW[c];
        }
      }
      let row = -1;
      if (py < headerHeight + frozenH) {
        let currentY = headerHeight;
        for (let r = 0; r < fRows; r++) {
          if (py >= currentY && py < currentY + this.rowH[r]) {
            row = r;
            break;
          }
          currentY += this.rowH[r];
        }
      } else {
        let currentY = headerHeight + frozenH - this.scrollTop;
        for (let r = fRows; r < this.sheet.row; r++) {
          if (py >= currentY && py < currentY + this.rowH[r]) {
            row = r;
            break;
          }
          currentY += this.rowH[r];
        }
      }
      if (row >= 0 && col >= 0) {
        return { row, col };
      }
      return null;
    }
    getCellAtPoint(x, y) {
      return this.getCellAt(x, y);
    }
    getHeaderAt(px, py) {
      const { headerHeight, headerWidth } = this.cfg;
      if (!this.sheet) return null;
      const frozen = this.sheet.config.frozen || { row: 0, column: 0 };
      const fRows = Math.min(frozen.row || 0, this.rowH.length);
      const fCols = Math.min(frozen.column || 0, this.colW.length);
      let frozenH = 0;
      for (let r = 0; r < fRows; r++) frozenH += this.rowH[r];
      let frozenW = 0;
      for (let c = 0; c < fCols; c++) frozenW += this.colW[c];
      if (py < headerHeight && px >= headerWidth) {
        if (px < headerWidth + frozenW) {
          let x = headerWidth;
          for (let c = 0; c < fCols; c++) {
            const cw = this.colW[c];
            if (px >= x && px < x + cw) return { type: "col", index: c };
            x += cw;
          }
        } else {
          let x = headerWidth + frozenW - this.scrollLeft;
          for (let c = fCols; c < this.sheet.column; c++) {
            const cw = this.colW[c];
            if (px >= x && px < x + cw) return { type: "col", index: c };
            x += cw;
          }
        }
        return { type: "col", index: this.sheet.column - 1 };
      }
      if (px < headerWidth && py >= headerHeight) {
        if (py < headerHeight + frozenH) {
          let y = headerHeight;
          for (let r = 0; r < fRows; r++) {
            const rh = this.rowH[r];
            if (py >= y && py < y + rh) return { type: "row", index: r };
            y += rh;
          }
        } else {
          let y = headerHeight + frozenH - this.scrollTop;
          for (let r = fRows; r < this.sheet.row; r++) {
            const rh = this.rowH[r];
            if (py >= y && py < y + rh) return { type: "row", index: r };
            y += rh;
          }
        }
        return { type: "row", index: this.sheet.row - 1 };
      }
      if (px < headerWidth && py < headerHeight) {
        return { type: "all", index: -1 };
      }
      return null;
    }
    isOverFillHandle(px, py) {
      if (!this.selection) return false;
      const [_, endRow] = this.selection.row;
      const [__, endCol] = this.selection.column;
      const endRect = this.getCellScreenRect(endRow, endCol);
      if (!endRect) return false;
      const handleX = endRect.x + endRect.w;
      const handleY = endRect.y + endRect.h;
      return Math.abs(px - handleX) <= 6 && Math.abs(py - handleY) <= 6;
    }
    measureColumnWidth(c) {
      if (!this.sheet) return this.cfg.defaultColWidth;
      const ctx = this.ctx;
      const { fontSize, fontFamily } = this.cfg;
      const fe = this.formulaEngine instanceof JSFormulaEngine ? this.formulaEngine : null;
      ctx.save();
      ctx.font = `${fontSize}px ${fontFamily}`;
      let max = 0;
      for (const cell of this.sheet.celldata) {
        if (cell.c !== c) continue;
        const v = cell.v;
        if (v == null) continue;
        let text = "";
        if (v.f && fe) {
          const res = fe.eval(v.f);
          text = String(res.value ?? v.m ?? v.v ?? "");
        } else {
          text = String(v.m ?? v.v ?? "");
        }
        const indentPx = (v.s?.indent || 0) * 12;
        const w = ctx.measureText(text).width + 4 * 2 + indentPx + 2;
        if (w > max) max = w;
      }
      ctx.restore();
      return Math.max(max, 30);
    }
    measureRowHeight(r) {
      if (!this.sheet) return this.cfg.defaultRowHeight;
      const ctx = this.ctx;
      const { fontSize, fontFamily } = this.cfg;
      const fe = this.formulaEngine instanceof JSFormulaEngine ? this.formulaEngine : null;
      ctx.save();
      ctx.font = `${fontSize}px ${fontFamily}`;
      let max = 0;
      for (const cell of this.sheet.celldata) {
        if (cell.r !== r) continue;
        const v = cell.v;
        if (v == null) continue;
        let text = "";
        if (v.f && fe) {
          const res = fe.eval(v.f);
          text = String(res.value ?? v.m ?? v.v ?? "");
        } else {
          text = String(v.m ?? v.v ?? "");
        }
        const fontH = fontSize + 6;
        const indentH = v.s?.tb === 2 ? Math.ceil(ctx.measureText(text).width / 100) * fontH : fontH;
        if (indentH > max) max = indentH;
      }
      ctx.restore();
      return Math.max(max, this.cfg.defaultRowHeight);
    }
    getResizeTarget(px, py) {
      const { headerHeight, headerWidth } = this.cfg;
      if (!this.sheet) return null;
      const frozen = this.sheet.config.frozen || { row: 0, column: 0 };
      const fRows = Math.min(frozen.row || 0, this.rowH.length);
      const fCols = Math.min(frozen.column || 0, this.colW.length);
      let frozenH = 0;
      for (let r = 0; r < fRows; r++) frozenH += this.rowH[r];
      let frozenW = 0;
      for (let c = 0; c < fCols; c++) frozenW += this.colW[c];
      if (py < headerHeight && px >= headerWidth) {
        if (px < headerWidth + frozenW) {
          let x = headerWidth;
          for (let c = 0; c < fCols; c++) {
            const cw = this.colW[c];
            if (Math.abs(px - (x + cw)) < 6) {
              return { type: "col", index: c, startVal: cw };
            }
            x += cw;
          }
        } else {
          let x = headerWidth + frozenW - this.scrollLeft;
          for (let c = fCols; c < this.sheet.column; c++) {
            const cw = this.colW[c];
            if (Math.abs(px - (x + cw)) < 6) {
              return { type: "col", index: c, startVal: cw };
            }
            x += cw;
          }
        }
      }
      if (px < headerWidth && py >= headerHeight) {
        if (py < headerHeight + frozenH) {
          let y = headerHeight;
          for (let r = 0; r < fRows; r++) {
            const rh = this.rowH[r];
            if (Math.abs(py - (y + rh)) < 6) {
              return { type: "row", index: r, startVal: rh };
            }
            y += rh;
          }
        } else {
          let y = headerHeight + frozenH - this.scrollTop;
          for (let r = fRows; r < this.sheet.row; r++) {
            const rh = this.rowH[r];
            if (Math.abs(py - (y + rh)) < 6) {
              return { type: "row", index: r, startVal: rh };
            }
            y += rh;
          }
        }
      }
      return null;
    }
    resize() {
      this.setupCanvas();
      this.render();
    }
    destroy() {
      this.sheet = null;
      this.formulaEngine = null;
    }
  };

  // src/Spreadsheet.ts
  var Spreadsheet = class {
    container;
    canvas;
    editor = null;
    store;
    events;
    renderer;
    formulaEngine;
    options;
    isEditing = false;
    constructor(options) {
      this.options = options;
      this.container = typeof options.container === "string" ? document.getElementById(options.container) : options.container;
      this.store = new Store(options.data);
      this.events = new EventBus();
      this.formulaEngine = new JSFormulaEngine();
      this.renderer = new CanvasRenderer(this.createCanvas());
      this.renderer.setFormulaEngine(this.formulaEngine);
      this.setupEventListeners();
      this.loadInitialData();
    }
    createCanvas() {
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      this.container.appendChild(canvas);
      this.canvas = canvas;
      return canvas;
    }
    setupEventListeners() {
      this.canvas.addEventListener("click", this.handleClick.bind(this));
      this.canvas.addEventListener("dblclick", this.handleDblClick.bind(this));
      this.canvas.addEventListener("wheel", this.handleWheel.bind(this));
      window.addEventListener("resize", this.handleResize.bind(this));
      document.addEventListener("keydown", this.handleKeydown.bind(this));
      this.store.subscribe((state) => {
        this.syncFormula();
        const sheet = state.data.sheets[state.activeSheetIndex];
        if (sheet) {
          this.renderer.setSheet(sheet);
        }
        this.renderer.setSelections(state.selections);
      });
    }
    syncFormula() {
      this.formulaEngine.clear();
      const sheet = this.store.getActiveSheet();
      if (!sheet) return;
      sheet.celldata.forEach((cell) => {
        this.formulaEngine.setCell(cell.r, cell.c, cell.v);
      });
    }
    loadInitialData() {
      this.syncFormula();
      const state = this.store.getState();
      if (state.data.sheets.length > 0) {
        const sheet = state.data.sheets[state.activeSheetIndex];
        this.renderer.setSheet(sheet);
        this.events.emit(Events.WORKBOOK_LOAD, state.data);
      }
    }
    handleClick(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cell = this.renderer.getCellAtPoint(x, y);
      if (cell) {
        this.store.setSelection({
          row: [cell.row, cell.row],
          column: [cell.col, cell.col]
        });
        this.events.emit(Events.CELL_CLICK, cell.row, cell.col);
      }
    }
    handleDblClick(e) {
      if (this.options.readOnly) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cell = this.renderer.getCellAtPoint(x, y);
      if (cell) {
        this.startEditing(cell.row, cell.col);
      }
    }
    handleWheel(e) {
      e.preventDefault();
      const state = this.store.getState();
      const sheet = state.data.sheets[state.activeSheetIndex];
      if (!sheet) return;
      const scrollTop = Math.max(0, e.deltaY);
      const scrollLeft = Math.max(0, e.deltaX);
      this.renderer.setScroll(scrollTop, scrollLeft);
    }
    handleResize() {
      this.renderer.resize();
    }
    handleKeydown(e) {
      if (this.isEditing) {
        if (e.key === "Escape") {
          this.cancelEditing();
        } else if (e.key === "Enter" && !e.shiftKey) {
          this.finishEditing();
        }
        return;
      }
      const state = this.store.getState();
      if (!state.selection) return;
      const [row, col] = [state.selection.row[0], state.selection.column[0]];
      switch (e.key) {
        case "ArrowUp":
          this.store.setSelection({ row: [row - 1, row - 1], column: [col, col] });
          break;
        case "ArrowDown":
          this.store.setSelection({ row: [row + 1, row + 1], column: [col, col] });
          break;
        case "ArrowLeft":
          this.store.setSelection({ row: [row, row], column: [col - 1, col - 1] });
          break;
        case "ArrowRight":
          this.store.setSelection({ row: [row, row], column: [col + 1, col + 1] });
          break;
        case "Delete":
        case "Backspace":
          this.store.clearRange(state.selection);
          break;
        case "F2":
          this.startEditing(row, col);
          break;
        case "z":
          if (e.ctrlKey || e.metaKey) {
            this.store.undo();
          }
          break;
        case "y":
          if (e.ctrlKey || e.metaKey) {
            this.store.redo();
          }
          break;
      }
    }
    startEditing(row, col) {
      this.isEditing = true;
      this.store.setEditingCell({ row, col });
      const cell = this.store.getCell(row, col);
      const value = cell?.f || (cell?.v !== null && cell?.v !== void 0 ? String(cell.v) : "");
      this.editor = document.createElement("textarea");
      this.editor.value = value;
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
    `;
      this.container.style.position = "relative";
      this.container.appendChild(this.editor);
      this.editor.focus();
    }
    finishEditing() {
      if (!this.editor || !this.isEditing) return;
      const state = this.store.getState();
      if (!state.editingCell) return;
      const { row, col } = state.editingCell;
      const value = this.editor.value;
      if (value.startsWith("=")) {
        this.store.setCell(row, col, { v: null, f: value });
      } else {
        const numValue = Number(value);
        this.store.setCell(row, col, {
          v: isNaN(numValue) ? value : numValue
        });
      }
      this.cancelEditing();
      this.events.emit(Events.CELL_CHANGE, row, col, value);
    }
    cancelEditing() {
      if (this.editor) {
        this.container.removeChild(this.editor);
        this.editor = null;
      }
      this.isEditing = false;
      this.store.setEditingCell(null);
    }
    getData() {
      return this.store.getState().data;
    }
    setData(data) {
      this.store.loadData(data);
      this.syncFormula();
    }
    getActiveSheet() {
      return this.store.getActiveSheet();
    }
    setActiveSheet(index) {
      this.store.setActiveSheet(index);
      this.syncFormula();
      this.events.emit(Events.SHEET_CHANGE, index);
    }
    setFrozen(row, col) {
      this.store.setFrozen(row, col);
    }
    setRowHidden(row, hidden) {
      this.store.setRowHidden(row, hidden);
    }
    fillRange(source, target) {
      this.store.fillRange(source, target);
      this.syncFormula();
    }
    getCell(row, col) {
      return this.store.getCell(row, col);
    }
    setCell(row, col, value) {
      this.store.setCell(row, col, value);
      this.syncFormula();
    }
    on(event, handler) {
      return this.events.on(event, handler);
    }
    off(event, handler) {
      this.events.off(event, handler);
    }
    undo() {
      const success = this.store.undo();
      if (success) this.syncFormula();
      return success;
    }
    redo() {
      const success = this.store.redo();
      if (success) this.syncFormula();
      return success;
    }
    destroy() {
      this.canvas.removeEventListener("click", this.handleClick.bind(this));
      this.canvas.removeEventListener("dblclick", this.handleDblClick.bind(this));
      this.canvas.removeEventListener("wheel", this.handleWheel.bind(this));
      window.removeEventListener("resize", this.handleResize.bind(this));
      document.removeEventListener("keydown", this.handleKeydown.bind(this));
      this.renderer.destroy();
      this.events.clear();
      this.container.removeChild(this.canvas);
    }
  };
  return __toCommonJS(src_exports);
})();
