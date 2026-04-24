import { useEffect, useState } from 'react'
import { Plus, Pencil, Mail, Phone } from 'lucide-react'
import {
  PageHeader,
  Button,
  Table,
  THead,
  TH,
  TBody,
  TR,
  TD,
  EmptyState,
} from '../../components/ui'
import { useToast } from '../../components/Toast'
import {
  listProveedores,
  type Proveedor,
} from '../../lib/queries/proveedores'
import { ProveedorFormModal } from '../../components/admin/ProveedorFormModal'

export default function Proveedores() {
  const { addToast } = useToast()
  const [rows, setRows] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    listProveedores({ includeInactive: true }).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        addToast('error', error.message)
        return
      }
      setRows(data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [reloadKey, addToast])

  return (
    <div>
      <PageHeader
        title="Proveedores"
        subtitle="Empresas a las que ORVANN compra mercancía o servicios"
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setEditing(null)
              setModalOpen(true)
            }}
          >
            <Plus size={14} /> Nuevo proveedor
          </Button>
        }
      />

      {loading ? (
        <div className="card p-10 text-center text-sm text-[var(--color-text-label)]">
          Cargando…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin proveedores"
          description="Agregá tu primer proveedor para poder registrar pedidos."
          action={
            <Button variant="primary" size="sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Crear el primero
            </Button>
          }
        />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Nombre</TH>
              <TH>Contacto</TH>
              <TH>Teléfono</TH>
              <TH>Email</TH>
              <TH>Notas</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {rows.map(p => (
              <TR key={p.id}>
                <TD className="font-medium">
                  {p.nombre}
                  {!p.activo && (
                    <span className="ml-2 text-[10px] text-[var(--color-text-faint)] italic">
                      (inactivo)
                    </span>
                  )}
                </TD>
                <TD className="text-[var(--color-text-muted)]">{p.contacto_nombre ?? '—'}</TD>
                <TD>
                  {p.telefono ? (
                    <a
                      href={`tel:${p.telefono}`}
                      className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <Phone size={12} /> {p.telefono}
                    </a>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">—</span>
                  )}
                </TD>
                <TD>
                  {p.email ? (
                    <a
                      href={`mailto:${p.email}`}
                      className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    >
                      <Mail size={12} /> {p.email}
                    </a>
                  ) : (
                    <span className="text-[var(--color-text-faint)]">—</span>
                  )}
                </TD>
                <TD
                  className="max-w-[240px] truncate text-xs text-[var(--color-text-label)]"
                  title={p.notas ?? ''}
                >
                  {p.notas ?? '—'}
                </TD>
                <TD align="right">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(p)
                      setModalOpen(true)
                    }}
                    className="p-1.5 text-[var(--color-text-label)] hover:text-[var(--color-text)] rounded-md"
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <ProveedorFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={() => setReloadKey(k => k + 1)}
      />
    </div>
  )
}
