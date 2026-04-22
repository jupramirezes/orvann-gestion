import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Search, Pencil, Eye, EyeOff } from 'lucide-react'
import { Constants, type Database } from '../../types/database'

type CategoriaDiseno = Database['public']['Enums']['categoria_diseno']
import {
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  TBody,
  TD,
  TH,
  THead,
  Textarea,
  TR,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import { CATEGORIA_DISENO_LABELS } from '../../lib/catalogo'
import {
  createDiseno,
  listDisenos,
  toggleDiseno,
  updateDiseno,
  type Diseno,
} from '../../lib/queries/disenos'

const disenoSchema = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres').max(80),
  categoria: z.enum(Constants.public.Enums.categoria_diseno).nullish(),
  referencia_ano: z.coerce.number().int().min(1900).max(2100).nullish().or(z.literal('').transform(() => null)),
  descripcion: z.string().trim().max(200).nullish(),
})
type DisenoForm = z.infer<typeof disenoSchema>

export default function Disenos() {
  const [rows, setRows] = useState<Diseno[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState<string>('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [editing, setEditing] = useState<Diseno | null>(null)
  const [open, setOpen] = useState(false)
  const { addToast } = useToast()

  const [reloadKey, setReloadKey] = useState(0)
  const reload = () => setReloadKey(k => k + 1)

  useEffect(() => {
    let cancelled = false
    listDisenos({
      search: search || undefined,
      categoria: (categoria || undefined) as CategoriaDiseno | undefined,
      includeInactive,
    }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) { addToast('error', error.message); return }
      setRows(data ?? [])
    })
    return () => { cancelled = true }
  }, [search, categoria, includeInactive, reloadKey, addToast])

  const count = rows.length

  return (
    <>
      <PageHeader
        title="Diseños"
        subtitle={`${count} referencia${count === 1 ? '' : 's'} cultural${count === 1 ? '' : 'es'}`}
        actions={
          <Button variant="accent" onClick={() => { setEditing(null); setOpen(true) }}>
            <Plus size={14} /> Nuevo diseño
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-faint)]" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoria} onChange={e => setCategoria(e.target.value)} className="max-w-[200px]">
          <option value="">Todas las categorías</option>
          {Constants.public.Enums.categoria_diseno.map(c => (
            <option key={c} value={c}>{CATEGORIA_DISENO_LABELS[c]}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] px-2">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={e => setIncludeInactive(e.target.checked)}
            style={{ width: 14, height: 14 }}
          />
          Incluir inactivos
        </label>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-sm text-[var(--color-text-label)]">Cargando…</div>
      ) : count === 0 ? (
        <EmptyState
          title="Sin diseños"
          description="Ajustá los filtros o creá un nuevo diseño."
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH align="center">Nombre</TH>
              <TH align="center">Categoría</TH>
              <TH align="center">Año</TH>
              <TH align="center">Descripción</TH>
              <TH align="center">Estado</TH>
              <TH align="center">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map(d => (
              <TR key={d.id}>
                <TD align="center" className="font-medium">{d.nombre}</TD>
                <TD align="center">{d.categoria ? CATEGORIA_DISENO_LABELS[d.categoria] : '—'}</TD>
                <TD align="center">{d.referencia_ano ?? '—'}</TD>
                <TD align="center" className="text-[var(--color-text-muted)] text-xs max-w-[260px] truncate" title={d.descripcion ?? ''}>
                  {d.descripcion ?? '—'}
                </TD>
                <TD align="center"><StatusBadge estado={d.activo ? 'activo' : 'inactivo'} /></TD>
                <TD align="center">
                  <div className="flex gap-1 justify-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      icon
                      onClick={() => { setEditing(d); setOpen(true) }}
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon
                      onClick={async () => {
                        const { error } = await toggleDiseno(d.id, !d.activo)
                        if (error) addToast('error', error.message)
                        else { addToast('success', d.activo ? 'Diseño desactivado' : 'Diseño activado'); reload() }
                      }}
                      title={d.activo ? 'Desactivar' : 'Activar'}
                    >
                      {d.activo ? <EyeOff size={13} /> : <Eye size={13} />}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <DisenoFormModal
        open={open}
        onClose={() => setOpen(false)}
        diseno={editing}
        onSaved={() => { setOpen(false); reload() }}
      />
    </>
  )
}

function DisenoFormModal({
  open, onClose, diseno, onSaved,
}: {
  open: boolean
  onClose: () => void
  diseno: Diseno | null
  onSaved: () => void
}) {
  const isEdit = !!diseno
  const { addToast } = useToast()

  const defaults = useMemo<DisenoForm>(() => ({
    nombre: diseno?.nombre ?? '',
    categoria: diseno?.categoria ?? null,
    referencia_ano: diseno?.referencia_ano ?? null,
    descripcion: diseno?.descripcion ?? '',
  }), [diseno])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<DisenoForm>({
    resolver: zodResolver(disenoSchema),
    defaultValues: defaults,
  })

  useEffect(() => { reset(defaults) }, [defaults, reset])

  async function onSubmit(values: DisenoForm) {
    const payload = {
      nombre: values.nombre,
      categoria: values.categoria ?? null,
      referencia_ano: values.referencia_ano ?? null,
      descripcion: values.descripcion?.trim() ? values.descripcion.trim() : null,
    }
    if (isEdit && diseno) {
      const { error } = await updateDiseno(diseno.id, payload)
      if (error) return addToast('error', error.message)
      addToast('success', 'Diseño actualizado')
    } else {
      const { error } = await createDiseno(payload)
      if (error) return addToast('error', error.message)
      addToast('success', 'Diseño creado')
    }
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar diseño' : 'Nuevo diseño'}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Nombre" required error={errors.nombre?.message}>
          <Input autoFocus invalid={!!errors.nombre} {...register('nombre')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <Select {...register('categoria')}>
              <option value="">—</option>
              {Constants.public.Enums.categoria_diseno.map(c => (
                <option key={c} value={c}>{CATEGORIA_DISENO_LABELS[c]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Año de referencia" error={errors.referencia_ano?.message}>
            <Input type="number" placeholder="Ej. 1994" invalid={!!errors.referencia_ano} {...register('referencia_ano')} />
          </Field>
        </div>

        <Field label="Descripción" hint="Opcional, máx. 200 chars" error={errors.descripcion?.message}>
          <Textarea rows={3} {...register('descripcion')} />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="accent" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando…' : isEdit ? 'Guardar cambios' : 'Crear diseño'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
