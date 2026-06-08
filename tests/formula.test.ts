import { describe, it, expect, beforeEach } from 'vitest'
import { JSFormulaEngine } from '../src/formula/FormulaEngine'

describe('JSFormulaEngine alignment tests', () => {
  let formula: JSFormulaEngine

  beforeEach(() => {
    formula = new JSFormulaEngine()
  })

  const testEval = (f: string) => {
    const result = formula.eval(f)
    if (result.error) {
      throw new Error(`Formula error in '${f}': ${result.error}`)
    }
    return result.value
  }

  it('SUM basic', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    expect(testEval('=SUM(A1,B1)')).toBe(30)
  })

  it('SUM range', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    formula.setCell(0, 2, { v: 30 })
    expect(testEval('=SUM(A1:C1)')).toBe(60)
  })

  it('AVERAGE range', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    formula.setCell(0, 2, { v: 30 })
    expect(testEval('=AVERAGE(A1:C1)')).toBe(20)
  })

  it('COUNT range', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    formula.setCell(0, 2, { v: 'text' })
    expect(testEval('=COUNT(A1:C1)')).toBe(2)
  })

  it('MAX and MIN range', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    formula.setCell(0, 2, { v: 5 })
    expect(testEval('=MAX(A1:C1)')).toBe(20)
    expect(testEval('=MIN(A1:C1)')).toBe(5)
  })

  it('CONCATENATE', () => {
    formula.setCell(0, 0, { v: 'Hello' })
    formula.setCell(0, 1, { v: 'World' })
    expect(testEval('=CONCATENATE(A1," ",B1)')).toBe('Hello World')
  })

  it('UPPER, LOWER, LEN', () => {
    formula.setCell(0, 0, { v: 'Hello World' })
    expect(testEval('=UPPER(A1)')).toBe('HELLO WORLD')
    expect(testEval('=LOWER(A1)')).toBe('hello world')
    expect(testEval('=LEN(A1)')).toBe(11)
  })

  it('LEFT, RIGHT, MID', () => {
    formula.setCell(0, 0, { v: 'Hello World' })
    expect(testEval('=LEFT(A1,5)')).toBe('Hello')
    expect(testEval('=RIGHT(A1,5)')).toBe('World')
    expect(testEval('=MID(A1,7,5)')).toBe('World')
  })

  it('IF condition', () => {
    formula.setCell(0, 0, { v: 10 })
    expect(testEval('=IF(A1>5,"Yes","No")')).toBe('Yes')
    expect(testEval('=IF(A1>15,"Yes","No")')).toBe('No')
  })

  it('AND, OR, NOT', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    expect(testEval('=AND(A1>5,B1>15)')).toBe(true)
    expect(testEval('=OR(A1>15,B1>15)')).toBe(true)
    expect(testEval('=NOT(A1>15)')).toBe(true)
  })

  it('ABS, INT, ROUND, MOD, POWER, SQRT, CEILING, FLOOR, EVEN, ODD, SIGN, EXP, LN, LOG, LOG10, PI, FACT, COMBIN', () => {
    expect(testEval('=ABS(-42)')).toBe(42)
    expect(testEval('=INT(3.7)')).toBe(3)
    expect(testEval('=ROUND(3.14159,2)')).toBe(3.14)
    expect(testEval('=MOD(10,3)')).toBe(1)
    expect(testEval('=POWER(2,3)')).toBe(8)
    expect(testEval('=SQRT(16)')).toBe(4)
    expect(testEval('=CEILING(4.3,1)')).toBe(5)
    expect(testEval('=FLOOR(4.7,1)')).toBe(4)
    expect(testEval('=EVEN(3)')).toBe(4)
    expect(testEval('=ODD(3)')).toBe(3)
    expect(testEval('=SIGN(-5)')).toBe(-1)
    expect(testEval('=EXP(0)')).toBe(1)
    expect(testEval('=LN(1)')).toBe(0)
    expect(testEval('=LOG(100,10)')).toBe(2)
    expect(testEval('=LOG10(100)')).toBe(2)
    expect(testEval('=PI()')).toBeCloseTo(Math.PI, 5)
    expect(testEval('=FACT(5)')).toBe(120)
    expect(testEval('=COMBIN(10,3)')).toBe(120)
  })

  it('SIN, COS, TAN', () => {
    expect(testEval('=SIN(0)')).toBe(0)
    expect(testEval('=COS(0)')).toBe(1)
    expect(testEval('=TAN(0)')).toBe(0)
  })

  it('TRUE, FALSE, IFERROR', () => {
    expect(testEval('=TRUE()')).toBe(true)
    expect(testEval('=FALSE()')).toBe(false)
    expect(formula.eval('=IFERROR(1/0,"Error")').value).toBe('Error')
  })

  it('Operators ADD, MINUS, MULTIPLY, DIVIDE', () => {
    formula.setCell(0, 0, { v: 5 })
    formula.setCell(0, 1, { v: 3 })
    expect(testEval('=ADD(A1,B1)')).toBe(8)
    expect(testEval('=MINUS(A1,B1)')).toBe(2)
    expect(testEval('=MULTIPLY(A1,B1)')).toBe(15)
    expect(testEval('=DIVIDE(A1,B1)')).toBeCloseTo(1.6666666666666667, 5)
    expect(testEval('=GT(A1,B1)')).toBe(true)
    expect(testEval('=LT(A1,B1)')).toBe(false)
    expect(testEval('=EQ(A1,A1)')).toBe(true)
    expect(testEval('=NE(A1,B1)')).toBe(true)
  })

  it('CHAR, CODE, TRIM, PROPER, EXACT, FIND, SEARCH, REPLACE, SUBSTITUTE, REPT, VALUE, T, N', () => {
    expect(testEval('=CHAR(65)')).toBe('A')
    expect(testEval('=CODE("A")')).toBe(65)
    expect(testEval('=TRIM("  Hi  ")')).toBe('Hi')
    expect(testEval('=PROPER("hello")')).toBe('Hello')
    expect(testEval('=EXACT("Hi","Hi")')).toBe(true)
    expect(testEval('=FIND("World","Hello World")')).toBe(7)
    expect(testEval('=SEARCH("world","Hello World")')).toBe(7)
    expect(testEval('=REPLACE("Hello",6,1," World")')).toBe('Hello World')
    expect(testEval('=SUBSTITUTE("Hello World","World","JS")')).toBe('Hello JS')
    expect(testEval('=REPT("Hi",3)')).toBe('HiHiHi')
    expect(testEval('=VALUE("123")')).toBe(123)
    expect(testEval('=T("Hello")')).toBe('Hello')
    expect(testEval('=N(123)')).toBe(123)
  })

  it('STDEV, VAR, MEDIAN, LARGE, SMALL', () => {
    formula.setCell(0, 0, { v: 10 })
    formula.setCell(0, 1, { v: 20 })
    formula.setCell(0, 2, { v: 30 })
    formula.setCell(0, 3, { v: 40 })
    formula.setCell(0, 4, { v: 50 })
    expect(testEval('=STDEV(A1:E1)')).toBeCloseTo(15.811388300841896, 5)
    expect(testEval('=VAR(A1:E1)')).toBe(250)
    expect(testEval('=MEDIAN(A1:E1)')).toBe(30)
    expect(testEval('=LARGE(A1:E1,2)')).toBe(40)
    expect(testEval('=SMALL(A1:E1,2)')).toBe(20)
  })

  it('PMT, SLN', () => {
    expect(testEval('=PMT(0.05/12,60,10000)')).toBeCloseTo(-188.71, 1)
    expect(testEval('=SLN(10000,2000,5)')).toBe(1600)
  })

  it('Nested and complex arithmetic', () => {
    expect(testEval('=(1+2)*3-4/2')).toBe(7)
    expect(testEval('=SUM(1,2,3)+AVERAGE(4,5,6)')).toBe(11)
  })
})
