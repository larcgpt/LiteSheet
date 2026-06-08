const { JSDOM } = require('jsdom')
const fs = require('fs')

const html = fs.readFileSync('index.html', 'utf-8')
const dom = new JSDOM(html, { 
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  url: 'file:///test.html'
})

const { window } = dom
const { document } = window

async function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

async function test() {
  await wait(2000)
  
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
  
  try {
    const store = window.store
    const formula = window.formula
    
    assert('Store 初始化', !!store)
    assert('Formula 引擎初始化', !!formula)
    
    const state = store.getState()
    assert('資料載入', state.data.sheets.length === 3)
    assert('活動工作表', state.activeSheetIndex === 0)
    
    const sheet = store.getActiveSheet()
    assert('取得工作表', !!sheet)
    assert('工作表名稱', sheet.name === '工作表1')
    assert('儲存格數量', sheet.celldata.length > 0)
    
    const cellB2 = store.getCell(1, 1)
    assert('取得 B2 儲存格', !!cellB2)
    assert(' B2 值為 25', cellB2.v === 25)
    
    const cellB3 = store.getCell(2, 1)
    assert('取得 B3 儲存格', !!cellB3)
    assert('B3 值為 30', cellB3.v === 30)
    
    const cellB4 = store.getCell(3, 1)
    assert('取得 B4 儲存格', !!cellB4)
    assert('B4 值為 28', cellB4.v === 28)
    
    store.setCell(10, 0, { v: '測試' })
    const testCell = store.getCell(10, 0)
    assert('設定儲存格', testCell?.v === '測試')
    
    store.setCell(10, 1, { v: 100 })
    assert('設定數值儲存格', store.getCell(10, 1)?.v === 100)
    
    formula.clear()
    formula.setCell(1, 1, { v: 25 })
    formula.setCell(2, 1, { v: 30 })
    formula.setCell(3, 1, { v: 28 })
    
    const sumResult = formula.calculate(6, 1)
    assert('SUM 公式計算', sumResult.value === 83)
    
    const avgResult = formula.calculate(5, 1)
    assert('AVERAGE 公式計算', Math.abs(avgResult.value - 27.666666666666668) < 0.001)
    
    const maxResult = formula.calculate(7, 1)
    assert('MAX 公式計算', maxResult.value === 30)
    
    const minResult = formula.calculate(8, 1)
    assert('MIN 公式計算', minResult.value === 25)
    
    formula.clear()
    formula.setCell(0, 0, { v: 'A' })
    formula.setCell(0, 1, { v: 'B' })
    formula.setCell(1, 0, { v: 'C' })
    formula.setCell(1, 1, { v: 'D' })
    
    const concatResult = formula.eval('=CONCATENATE(A1,B1)')
    assert('CONCATENATE 函數', concatResult.value === 'AB')
    
    formula.setCell(2, 0, { v: 'Hello World' })
    const upperResult = formula.eval('=UPPER(A3)')
    assert('UPPER 函數', upperResult.value === 'HELLO WORLD')
    
    const lowerResult = formula.eval('=LOWER(A3)')
    assert('LOWER 函數', lowerResult.value === 'hello world')
    
    const lenResult = formula.eval('=LEN(A3)')
    assert('LEN 函數', lenResult.value === 11)
    
    const leftResult = formula.eval('=LEFT(A3,5)')
    assert('LEFT 函數', leftResult.value === 'Hello')
    
    const rightResult = formula.eval('=RIGHT(A3,5)')
    assert('RIGHT 函數', rightResult.value === 'World')
    
    const midResult = formula.eval('=MID(A3,7,5)')
    assert('MID 函數', midResult.value === 'World')
    
    formula.setCell(3, 0, { v: 10 })
    formula.setCell(3, 1, { v: 20 })
    formula.setCell(3, 2, { v: 30 })
    
    const ifResult = formula.eval('=IF(A4>15,"大","小")')
    assert('IF 函數', ifResult.value === '小')
    
    const andResult = formula.eval('=AND(A4>5,B4>15)')
    assert('AND 函數', andResult.value === true)
    
    const orResult = formula.eval('=OR(A4>15,B4>15)')
    assert('OR 函數', orResult.value === true)
    
    const notResult = formula.eval('=NOT(A4>15)')
    assert('NOT 函數', notResult.value === true)
    
    formula.setCell(4, 0, { v: 100 })
    formula.setCell(4, 1, { v: 200 })
    formula.setCell(4, 2, { v: 300 })
    
    const sumRange = formula.eval('=SUM(A5:C5)')
    assert('SUM 範圍', sumRange.value === 600)
    
    const avgRange = formula.eval('=AVERAGE(A5:C5)')
    assert('AVERAGE 範圍', avgRange.value === 200)
    
    const countRange = formula.eval('=COUNT(A5:C5)')
    assert('COUNT 範圍', countRange.value === 3)
    
    const roundResult = formula.eval('=ROUND(3.14159,2)')
    assert('ROUND 函數', roundResult.value === 3.14)
    
    const absResult = formula.eval('=ABS(-42)')
    assert('ABS 函數', absResult.value === 42)
    
    const intResult = formula.eval('=INT(3.7)')
    assert('INT 函數', intResult.value === 3)
    
    const modResult = formula.eval('=MOD(10,3)')
    assert('MOD 函數', modResult.value === 1)
    
    const powerResult = formula.eval('=POWER(2,3)')
    assert('POWER 函數', powerResult.value === 8)
    
    const sqrtResult = formula.eval('=SQRT(16)')
    assert('SQRT 函數', sqrtResult.value === 4)
    
    const todayResult = formula.eval('=TODAY()')
    assert('TODAY 函數', todayResult.value !== null)
    
    const nowResult = formula.eval('=NOW()')
    assert('NOW 函數', nowResult.value !== null)
    
    formula.setCell(5, 0, { v: 1 })
    formula.setCell(5, 1, { v: 2 })
    formula.setCell(5, 2, { v: 3 })
    formula.setCell(5, 3, { v: 4 })
    formula.setCell(5, 4, { v: 5 })
    
    const sumifResult = formula.eval('=SUMIF(A6:E6,">3")')
    assert('SUMIF 函數', sumifResult.value === 9)
    
    const countifResult = formula.eval('=COUNTIF(A6:E6,">3")')
    assert('COUNTIF 函數', countifResult.value === 2)
    
    formula.setCell(6, 0, { v: 'Apple' })
    formula.setCell(6, 1, { v: 'Banana' })
    formula.setCell(6, 2, { v: 'Cherry' })
    
    const vlookupData = [
      [{ v: 'Apple' }, { v: 1 }],
      [{ v: 'Banana' }, { v: 2 }],
      [{ v: 'Cherry' }, { v: 3 }]
    ]
    
    const isblankResult = formula.eval('=ISBLANK(A100)')
    assert('ISBLANK 函數', isblankResult.value === true)
    
    const isnumberResult = formula.eval('=ISNUMBER(A6)')
    assert('ISNUMBER 函數', isnumberResult.value === false)
    
    const istextResult = formula.eval('=ISTEXT(A7)')
    assert('ISTEXT 函數', istextResult.value === true)
    
    const trueResult = formula.eval('=TRUE()')
    assert('TRUE 函數', trueResult.value === true)
    
    const falseResult = formula.eval('=FALSE()')
    assert('FALSE 函數', falseResult.value === false)
    
    const iferrorResult = formula.eval('=IFERROR(1/0,"錯誤")')
    assert('IFERROR 函數', iferrorResult.value === '錯誤')
    
    const addResult = formula.eval('=ADD(1,2)')
    assert('ADD 運算子', addResult.value === 3)
    
    const minusResult = formula.eval('=MINUS(5,3)')
    assert('MINUS 運算子', minusResult.value === 2)
    
    const multiplyResult = formula.eval('=MULTIPLY(4,5)')
    assert('MULTIPLY 運算子', multiplyResult.value === 20)
    
    const divideResult = formula.eval('=DIVIDE(10,2)')
    assert('DIVIDE 運算子', divideResult.value === 5)
    
    const gtResult = formula.eval('=GT(5,3)')
    assert('GT 運算子', gtResult.value === true)
    
    const ltResult = formula.eval('=LT(3,5)')
    assert('LT 運算子', ltResult.value === true)
    
    const eqResult = formula.eval('=EQ(5,5)')
    assert('EQ 運算子', eqResult.value === true)
    
    const neResult = formula.eval('=NE(5,3)')
    assert('NE 運算子', neResult.value === true)
    
    const charResult = formula.eval('=CHAR(65)')
    assert('CHAR 函數', charResult.value === 'A')
    
    const codeResult = formula.eval('=CODE("A")')
    assert('CODE 函數', codeResult.value === 65)
    
    const trimResult = formula.eval('=TRIM("  Hello  ")')
    assert('TRIM 函數', trimResult.value === 'Hello')
    
    const cleanResult = formula.eval('=CLEAN("Hello\x00World")')
    assert('CLEAN 函數', cleanResult.value === 'HelloWorld')
    
    const properResult = formula.eval('=PROPER("hello world")')
    assert('PROPER 函數', properResult.value === 'Hello World')
    
    const exactResult = formula.eval('=EXACT("Hello","Hello")')
    assert('EXACT 函數', exactResult.value === true)
    
    const findResult = formula.eval('=FIND("World","Hello World")')
    assert('FIND 函數', findResult.value === 7)
    
    const searchResult = formula.eval('=SEARCH("world","Hello World")')
    assert('SEARCH 函數', searchResult.value === 7)
    
    const replaceResult = formula.eval('=REPLACE("Hello World",7,5,"JS")')
    assert('REPLACE 函數', replaceResult.value === 'Hello JS')
    
    const substituteResult = formula.eval('=SUBSTITUTE("Hello World","World","JS")')
    assert('SUBSTITUTE 函數', substituteResult.value === 'Hello JS')
    
    const reptResult = formula.eval('=REPT("Hi",3)')
    assert('REPT 函數', reptResult.value === 'HiHiHi')
    
    const valueResult = formula.eval('=VALUE("123")')
    assert('VALUE 函數', valueResult.value === 123)
    
    const tResult = formula.eval('=T("Hello")')
    assert('T 函數', tResult.value === 'Hello')
    
    const nResult = formula.eval('=N(123)')
    assert('N 函數', nResult.value === 123)
    
    formula.setCell(7, 0, { v: 3.7 })
    formula.setCell(7, 1, { v: -3.7 })
    
    const ceilResult = formula.eval('=CEILING(4.3,1)')
    assert('CEILING 函數', ceilResult.value === 5)
    
    const floorResult = formula.eval('=FLOOR(4.7,1)')
    assert('FLOOR 函數', floorResult.value === 4)
    
    const evenResult = formula.eval('=EVEN(3)')
    assert('EVEN 函數', evenResult.value === 4)
    
    const oddResult = formula.eval('=ODD(3)')
    assert('ODD 函數', oddResult.value === 3)
    
    const signResult = formula.eval('=SIGN(-5)')
    assert('SIGN 函數', signResult.value === -1)
    
    const expResult = formula.eval('=EXP(1)')
    assert('EXP 函數', Math.abs(expResult.value - Math.E) < 0.001)
    
    const lnResult = formula.eval('=LN(1)')
    assert('LN 函數', lnResult.value === 0)
    
    const logResult = formula.eval('=LOG(100,10)')
    assert('LOG 函數', logResult.value === 2)
    
    const log10Result = formula.eval('=LOG10(100)')
    assert('LOG10 函數', log10Result.value === 2)
    
    const piResult = formula.eval('=PI()')
    assert('PI 函數', Math.abs(piResult.value - Math.PI) < 0.001)
    
    const factResult = formula.eval('=FACT(5)')
    assert('FACT 函數', factResult.value === 120)
    
    const combinResult = formula.eval('=COMBIN(10,3)')
    assert('COMBIN 函數', combinResult.value === 120)
    
    const sinResult = formula.eval('=SIN(0)')
    assert('SIN 函數', sinResult.value === 0)
    
    const cosResult = formula.eval('=COS(0)')
    assert('COS 函數', cosResult.value === 1)
    
    const tanResult = formula.eval('=TAN(0)')
    assert('TAN 函數', tanResult.value === 0)
    
    const degreesResult = formula.eval('=DEGREES(3.14159)')
    assert('DEGREES 函數', Math.abs(degreesResult.value - 180) < 1)
    
    const radiansResult = formula.eval('=RADIANS(180)')
    assert('RADIANS 函數', Math.abs(radiansResult.value - Math.PI) < 0.01)
    
    formula.setCell(8, 0, { v: 10 })
    formula.setCell(8, 1, { v: 20 })
    formula.setCell(8, 2, { v: 30 })
    formula.setCell(8, 3, { v: 40 })
    formula.setCell(8, 4, { v: 50 })
    
    const stdevResult = formula.eval('=STDEV(A9:E9)')
    assert('STDEV 函數', stdevResult.value > 0)
    
    const varResult = formula.eval('=VAR(A9:E9)')
    assert('VAR 函數', varResult.value > 0)
    
    const medianResult = formula.eval('=MEDIAN(A9:E9)')
    assert('MEDIAN 函數', medianResult.value === 30)
    
    const largeResult = formula.eval('=LARGE(A9:E9,2)')
    assert('LARGE 函數', largeResult.value === 40)
    
    const smallResult = formula.eval('=SMALL(A9:E9,2)')
    assert('SMALL 函數', smallResult.value === 20)
    
    const rankResult = formula.eval('=RANK(30,A9:E9)')
    assert('RANK 函數', rankResult.value === 3)
    
    const pmtResult = formula.eval('=PMT(0.05/12,60,10000)')
    assert('PMT 函數', pmtResult.value !== null)
    
    const fvResult = formula.eval('=FV(0.05/12,60,-200)')
    assert('FV 函數', fvResult.value !== null)
    
    const pvResult = formula.eval('=PV(0.05/12,60,-200)')
    assert('PV 函數', pvResult.value !== null)
    
    const npvResult = formula.eval('=NPV(0.1,-1000,300,400,500)')
    assert('NPV 函數', npvResult.value !== null)
    
    const slnResult = formula.eval('=SLN(10000,2000,5)')
    assert('SLN 函數', slnResult.value === 1600)
    
    const yearResult = formula.eval('=YEAR(44197)')
    assert('YEAR 函數', yearResult.value === 2021)
    
    const monthResult = formula.eval('=MONTH(44197)')
    assert('MONTH 函數', monthResult.value === 1)
    
    const dayResult = formula.eval('=DAY(44197)')
    assert('DAY 函數', dayResult.value === 1)
    
    const weekdayResult = formula.eval('=WEEKDAY(44197)')
    assert('WEEKDAY 函數', weekdayResult.value > 0)
    
    const arithResult = formula.eval('=(1+2)*3-4/2')
    assert('四則運算', arithResult.value === 7)
    
    const nestedResult = formula.eval('=SUM(1,2,3)+AVERAGE(4,5,6)')
    assert('巢狀函數', nestedResult.value === 11)
    
    const stringConcat = formula.eval('="Hello" & " " & "World"')
    assert('字串連接', stringConcat.value === 'Hello World')
    
  } catch (e) {
    results.push(`💥 錯誤: ${e.message}`)
    failed++
  }
  
  console.log('\n========================================')
  console.log('      LiteSheet 功能測試報告')
  console.log('========================================\n')
  results.forEach(r => console.log(r))
  console.log('\n========================================')
  console.log(`總計: ${passed + failed} 項測試`)
  console.log(`通過: ${passed} 項`)
  console.log(`失敗: ${failed} 項`)
  console.log(`通過率: ${((passed / (passed + failed)) * 100).toFixed(1)}%`)
  console.log('========================================\n')
  
  process.exit(failed > 0 ? 1 : 0)
}

test().catch(e => {
  console.error('測試執行錯誤:', e)
  process.exit(1)
})
