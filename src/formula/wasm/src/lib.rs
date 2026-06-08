use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CellValue {
    pub v: Option<f64>,
    pub s: Option<String>,
    pub f: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CalcResult {
    pub value: Option<f64>,
    pub text: Option<String>,
    pub error: Option<String>,
}

#[wasm_bindgen]
pub struct FormulaEngine {
    cells: HashMap<(u32, u32), CellValue>,
    cache: HashMap<String, CalcResult>,
}

#[wasm_bindgen]
impl FormulaEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        FormulaEngine {
            cells: HashMap::new(),
            cache: HashMap::new(),
        }
    }

    #[wasm_bindgen]
    pub fn set_cell(&mut self, row: u32, col: u32, value: JsValue) {
        let cell: CellValue = serde_wasm_bindgen::from_value(value).unwrap_or(CellValue {
            v: None,
            s: None,
            f: None,
        });
        self.cells.insert((row, col), cell);
        self.cache.clear();
    }

    #[wasm_bindgen]
    pub fn get_cell(&self, row: u32, col: u32) -> JsValue {
        let result = self.cells.get(&(row, col)).cloned();
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    #[wasm_bindgen]
    pub fn calculate(&mut self, row: u32, col: u32) -> JsValue {
        let key = format!("{}:{}", row, col);
        
        if let Some(cached) = self.cache.get(&key) {
            return serde_wasm_bindgen::to_value(cached).unwrap_or(JsValue::NULL);
        }

        let cell = match self.cells.get(&(row, col)) {
            Some(cell) => cell.clone(),
            None => {
                let result = CalcResult {
                    value: None,
                    text: None,
                    error: None,
                };
                return serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL);
            }
        };

        let result = if let Some(formula) = &cell.f {
            self.evaluate_formula(formula)
        } else {
            CalcResult {
                value: cell.v,
                text: cell.s.clone(),
                error: None,
            }
        };

        self.cache.insert(key, result.clone());
        serde_wasm_bindgen::to_value(&result).unwrap_or(JsValue::NULL)
    }

    fn evaluate_formula(&self, formula: &str) -> CalcResult {
        let formula = formula.trim();
        
        if formula.starts_with("=SUM(") && formula.ends_with(")") {
            let args = &formula[5..formula.len()-1];
            return self.calculate_sum(args);
        }
        
        if formula.starts_with("=AVERAGE(") && formula.ends_with(")") {
            let args = &formula[9..formula.len()-1];
            return self.calculate_average(args);
        }
        
        if formula.starts_with("=COUNT(") && formula.ends_with(")") {
            let args = &formula[7..formula.len()-1];
            return self.calculate_count(args);
        }
        
        if formula.starts_with("=MAX(") && formula.ends_with(")") {
            let args = &formula[5..formula.len()-1];
            return self.calculate_max(args);
        }
        
        if formula.starts_with("=MIN(") && formula.ends_with(")") {
            let args = &formula[5..formula.len()-1];
            return self.calculate_min(args);
        }

        if formula.starts_with("=") {
            let ref_str = &formula[1..];
            if let Some(value) = self.resolve_reference(ref_str) {
                return CalcResult {
                    value: Some(value),
                    text: Some(value.to_string()),
                    error: None,
                };
            }
        }

        CalcResult {
            value: None,
            text: Some(formula.to_string()),
            error: None,
        }
    }

    fn parse_range(&self, range_str: &str) -> Vec<(u32, u32)> {
        let mut cells = Vec::new();
        
        if range_str.contains(':') {
            let parts: Vec<&str> = range_str.split(':').collect();
            if parts.len() == 2 {
                let start = self.parse_cell_ref(parts[0]);
                let end = self.parse_cell_ref(parts[1]);
                
                if let (Some((sr, sc)), Some((er, ec))) = (start, end) {
                    for r in sr..=er {
                        for c in sc..=ec {
                            cells.push((r, c));
                        }
                    }
                }
            }
        } else if let Some((r, c)) = self.parse_cell_ref(range_str) {
            cells.push((r, c));
        }
        
        cells
    }

    fn parse_cell_ref(&self, ref_str: &str) -> Option<(u32, u32)> {
        let ref_str = ref_str.trim();
        let mut col = 0u32;
        let mut i = 0;
        
        for ch in ref_str.chars() {
            if ch.is_ascii_uppercase() {
                col = col * 26 + (ch as u32 - 'A' as u32 + 1);
                i += 1;
            } else {
                break;
            }
        }
        
        if col > 0 && i < ref_str.len() {
            col -= 1;
            if let Ok(row) = ref_str[i..].parse::<u32>() {
                return Some((row - 1, col));
            }
        }
        
        None
    }

    fn resolve_reference(&self, ref_str: &str) -> Option<f64> {
        if let Some((r, c)) = self.parse_cell_ref(ref_str) {
            return self.cells.get(&(r, c))?.v;
        }
        None
    }

    fn get_range_values(&self, range_str: &str) -> Vec<f64> {
        let cells = self.parse_range(range_str);
        cells.iter()
            .filter_map(|&(r, c)| self.cells.get(&(r, c))?.v)
            .collect()
    }

    fn calculate_sum(&self, args: &str) -> CalcResult {
        let values = self.get_range_values(args);
        let sum: f64 = values.iter().sum();
        CalcResult {
            value: Some(sum),
            text: Some(sum.to_string()),
            error: None,
        }
    }

    fn calculate_average(&self, args: &str) -> CalcResult {
        let values = self.get_range_values(args);
        if values.is_empty() {
            return CalcResult {
                value: None,
                text: None,
                error: Some("#DIV/0!".to_string()),
            };
        }
        let avg = values.iter().sum::<f64>() / values.len() as f64;
        CalcResult {
            value: Some(avg),
            text: Some(avg.to_string()),
            error: None,
        }
    }

    fn calculate_count(&self, args: &str) -> CalcResult {
        let values = self.get_range_values(args);
        let count = values.len() as f64;
        CalcResult {
            value: Some(count),
            text: Some(count.to_string()),
            error: None,
        }
    }

    fn calculate_max(&self, args: &str) -> CalcResult {
        let values = self.get_range_values(args);
        if values.is_empty() {
            return CalcResult {
                value: None,
                text: None,
                error: None,
            };
        }
        let max = values.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        CalcResult {
            value: Some(max),
            text: Some(max.to_string()),
            error: None,
        }
    }

    fn calculate_min(&self, args: &str) -> CalcResult {
        let values = self.get_range_values(args);
        if values.is_empty() {
            return CalcResult {
                value: None,
                text: None,
                error: None,
            };
        }
        let min = values.iter().cloned().fold(f64::INFINITY, f64::min);
        CalcResult {
            value: Some(min),
            text: Some(min.to_string()),
            error: None,
        }
    }

    #[wasm_bindgen]
    pub fn clear_cache(&mut self) {
        self.cache.clear();
    }

    #[wasm_bindgen]
    pub fn clear(&mut self) {
        self.cells.clear();
        self.cache.clear();
    }
}
