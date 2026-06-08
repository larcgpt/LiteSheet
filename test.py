#!/usr/bin/env python3
"""LiteSheet 自動化測試腳本"""
import re
import sys

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def test_html_js_alignment(content):
    """檢查 HTML 元素與 JS 事件處理是否對齊"""
    issues = []
    
    # 1. 找出所有 HTML 按鈕 ID
    btn_ids = set(re.findall(r'id="(btn-[^"]+)"', content))
    
    # 2. 找出所有 JS onclick 處理的 ID
    onclick_ids = set(re.findall(r"getElementById\('([^']+)'\)\.onclick", content))
    
    # 3. 找出所有 JS addEventListener 處理的 ID
    listener_ids = set(re.findall(r"getElementById\('([^']+)'\)\.addEventListener", content))
    
    handled = onclick_ids | listener_ids
    
    for btn in sorted(btn_ids):
        if btn not in handled:
            issues.append(f"❌ 按鈕 {btn} 缺少事件處理")
        else:
            print(f"  ✅ {btn}")
    
    return issues

def test_menu_actions(content):
    """檢查所有 data-action 是否有對應處理"""
    issues = []
    
    # 找出所有 data-action
    actions = set(re.findall(r'data-action="([^"]+)"', content))
    
    # 找出所有 switch case 處理
    cases = set(re.findall(r"case '([^']+)'", content))
    
    for action in sorted(actions):
        if action in cases:
            print(f"  ✅ {action}")
        else:
            issues.append(f"❌ 選單項目 {action} 缺少處理")
    
    return issues

def test_duplicate_functions(content):
    """檢查重複的函數定義"""
    issues = []
    
    # 找出所有 function 定義
    funcs = re.findall(r'function\s+(\w+)\s*\(', content)
    seen = {}
    for f in funcs:
        if f in seen:
            seen[f] += 1
        else:
            seen[f] = 1
    
    for name, count in seen.items():
        if count > 1:
            issues.append(f"❌ 函數 {name} 重複定義 {count} 次")
        else:
            print(f"  ✅ {name}")
    
    return issues

def test_duplicate_variables(content):
    """檢查重複的變數宣告"""
    issues = []
    
    # 找出所有 let 變數宣告
    lets = re.findall(r'^\s+let\s+(\w+)', content, re.MULTILINE)
    seen = {}
    for v in lets:
        if v in seen:
            seen[v] += 1
        else:
            seen[v] = 1
    
    for name, count in seen.items():
        if count > 1:
            issues.append(f"❌ 變數 {name} 重複宣告 {count} 次")
    
    return issues

def test_syntax_errors(content):
    """檢查常見語法錯誤"""
    issues = []
    lines = content.split('\n')
    
    for i, line in enumerate(lines, 1):
        # 檢查 case 語句缺少分號
        if re.search(r"case\s+'[^']+':\s+\w.*[^;{}\s]\s+break", line):
            issues.append(f"❌ 第 {i} 行: case 語句可能缺少分號: {line.strip()[:60]}")
        
        # 檢查未關閉的括號
        open_parens = line.count('(') - line.count(')')
        open_braces = line.count('{') - line.count('}')
        if open_parens < 0 or open_braces < 0:
            # 這可能是正常的，只報告異常的
            pass
    
    return issues

def test_function_signatures(content):
    """檢查所有已定義的函數是否被正確呼叫"""
    issues = []
    
    # 找出所有定義的函數
    defined = set(re.findall(r'function\s+(\w+)\s*\(', content))
    
    # 找出所有被呼叫的函數
    called = set(re.findall(r'(?<!function\s)(\w+)\s*\(', content))
    
    # 過濾掉內建函數
    builtins = {'if', 'for', 'while', 'switch', 'catch', 'typeof', 'parseInt', 'parseFloat', 
                'Math', 'Number', 'String', 'Array', 'Object', 'JSON', 'console', 'document',
                'window', 'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval', 'clearTimeout',
                'clearInterval', 'encodeURIComponent', 'decodeURIComponent', 'isNaN', 'isFinite',
                'URL', 'Blob', 'Image', 'Map', 'Set', 'Date', 'RegExp', 'Error', 'Promise',
                'requestAnimationFrame', 'cancelAnimationFrame', 'matchMedia'}
    
    for func in defined:
        if func not in called and func not in builtins:
            issues.append(f"⚠️ 函數 {func} 已定義但可能未被呼叫")
    
    return issues

def test_element_references(content):
    """檢查所有 getElementById 引用的元素是否存在"""
    issues = []
    
    # 找出所有 HTML id
    html_ids = set(re.findall(r'id="([^"]+)"', content))
    
    # 找出所有 getElementById 引用
    js_ids = set(re.findall(r"getElementById\('([^']+)'\)", content))
    
    for ref_id in sorted(js_ids):
        if ref_id in html_ids:
            print(f"  ✅ #{ref_id}")
        else:
            issues.append(f"❌ JS 引用 #{ref_id} 但 HTML 中不存在")
    
    return issues

def test_bracket_balance(content):
    """檢查括號平衡"""
    issues = []
    lines = content.split('\n')
    
    paren_depth = 0
    brace_depth = 0
    bracket_depth = 0
    
    for i, line in enumerate(lines, 1):
        # 跳過字串和註釋中的括號
        in_str = False
        str_char = ''
        j = 0
        while j < len(line):
            ch = line[j]
            if in_str:
                if ch == str_char and line[j-1:j] != '\\':
                    in_str = False
            else:
                if ch == '"' or ch == "'":
                    in_str = True
                    str_char = ch
                elif ch == '/' and j+1 < len(line) and line[j+1] == '/':
                    break  # 註釋
                elif ch == '(':
                    paren_depth += 1
                elif ch == ')':
                    paren_depth -= 1
                elif ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                elif ch == '[':
                    bracket_depth += 1
                elif ch == ']':
                    bracket_depth -= 1
            j += 1
    
    if paren_depth != 0:
        issues.append(f"❌ 括號不平衡: ( 深度 = {paren_depth}")
    if brace_depth != 0:
        issues.append(f"❌ 大括號不平衡: {{ 深度 = {brace_depth}")
    if bracket_depth != 0:
        issues.append(f"❌ 方括號不平衡: [ 深度 = {bracket_depth}")
    
    return issues

def main():
    path = 'vNext/index.html'
    print(f"=== LiteSheet 自動化測試 ===\n")
    
    content = read_file(path)
    
    all_issues = []
    
    print("1. 檢查按鈕事件處理...")
    all_issues.extend(test_html_js_alignment(content))
    
    print("\n2. 檢查選單項目處理...")
    all_issues.extend(test_menu_actions(content))
    
    print("\n3. 檢查重複函數...")
    all_issues.extend(test_duplicate_functions(content))
    
    print("\n4. 檢查重複變數...")
    all_issues.extend(test_duplicate_variables(content))
    
    print("\n5. 檢查語法錯誤...")
    all_issues.extend(test_syntax_errors(content))
    
    print("\n6. 檢查元素引用...")
    all_issues.extend(test_element_references(content))
    
    print("\n7. 檢查括號平衡...")
    all_issues.extend(test_bracket_balance(content))
    
    print("\n" + "=" * 50)
    print(f"測試完成！")
    
    if all_issues:
        print(f"\n❌ 發現 {len(all_issues)} 個問題：\n")
        for issue in all_issues:
            print(f"  {issue}")
    else:
        print("\n✅ 未發現問題！")
    
    return len(all_issues)

if __name__ == '__main__':
    sys.exit(main())
