/**
 * Aplica tmp-import/import.sql al proyecto Supabase usando el ANON key
 * del .env.local. Llama al endpoint Postgres via postgrest rpc/query
 * usando supabase-js con la sesión del usuario JP (RLS abierta en F1).
 *
 * Lee el archivo .sql, lo divide por ';\n\n' (statements separados) y
 * los ejecuta en serie. Reporta OK/FAIL por statement.
 *
 * Uso: node scripts/aplicar-import.mjs
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Leer .env.local
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !ANON_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local')
  process.exit(1)
}

const EMAIL = process.env.ORVANN_EMAIL
const PASSWORD = process.env.ORVANN_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error('Seteá las env vars ORVANN_EMAIL y ORVANN_PASSWORD antes de correr el script')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, ANON_KEY)

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (authErr) {
  console.error('Login falló:', authErr.message)
  process.exit(1)
}
console.log('Logueado como', auth.user.email)

// Cargar SQL
const sqlPath = path.resolve('tmp-import/import.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

// Dividir en statements por ';\n\n' (separador que usa el generador)
// Saltar comentarios.
const statements = sql
  .split(/;\s*\n\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'begin' && s !== 'commit')
  .map(s => s.endsWith(';') ? s : s + ';')

console.log(`${statements.length} statements a ejecutar`)

// No hay un RPC genérico para SQL en Supabase con anon; el approach
// simple es usar el endpoint REST /rest/v1/rpc/<fn>. Como no tenemos
// una función exec_sql, tenemos que crear una, o usar el endpoint
// /rest/v1/<table> con inserts. Dado que cada statement es un WITH ...
// INSERT ... INSERT complejo, necesitamos SQL raw.
//
// Plan B: crear una función exec_sql en Supabase y llamarla via rpc.
// Como eso requiere DDL y RLS cerrada, es delicado.
//
// Plan C (más simple en F1): usar pg library directa via connection
// string. Pero requiere la contraseña de la DB.
//
// Por ahora: este script imprime los statements para ejecutar via MCP
// o via SQL Editor de Supabase. No los ejecuta directamente.

console.log('---')
console.log('NOTA: este script no puede ejecutar SQL raw con anon key.')
console.log('Se divide el archivo en chunks para copiar al SQL Editor o MCP.')
console.log('---')

// Generar 5 archivos chunk con los statements divididos
const chunks = [[], [], [], [], []]
statements.forEach((s, i) => chunks[i % 5].push(s))

for (let i = 0; i < chunks.length; i++) {
  const outPath = `tmp-import/exec-${i + 1}.sql`
  fs.writeFileSync(outPath, chunks[i].join('\n\n') + '\n')
  console.log(`${outPath}: ${chunks[i].length} statements, ${fs.statSync(outPath).size} bytes`)
}
