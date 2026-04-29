/**
 * Inspecciona Control_Operativo_Orvann_Sheet_Original.xlsx para ver
 * qué hojas tiene, dimensiones de cada una y primeras filas.
 *
 * Uso: node scripts/inspeccionar-sheet.mjs
 */

import XLSX from 'xlsx'

const FILE = 'docs/referencia/Control_Operativo_Orvann.xlsx'

const wb = XLSX.readFile(FILE)
console.log(`\n=== ${FILE} ===`)
console.log(`Hojas (${wb.SheetNames.length}):`)
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name]
  const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
  const cols = range ? range.e.c - range.s.c + 1 : 0
  const rows = range ? range.e.r - range.s.r + 1 : 0
  console.log(`  - "${name}" — ${rows} filas × ${cols} cols`)
}

console.log('\n=== Primeras 4 filas de cada hoja ===')
for (const name of wb.SheetNames) {
  const sheet = wb.Sheets[name]
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: false })
  console.log(`\n--- "${name}" ---`)
  for (let i = 0; i < Math.min(4, aoa.length); i++) {
    const row = aoa[i].slice(0, 12).map(c => {
      const s = String(c ?? '').slice(0, 25)
      return s || '∅'
    })
    console.log(`  [${i}]`, row.join(' | '))
  }
  if (aoa.length > 4) console.log(`  ... ${aoa.length - 4} filas más`)
}
