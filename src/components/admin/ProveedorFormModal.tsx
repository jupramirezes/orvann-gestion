import { useState } from 'react'
import { Modal, Field, Input, Textarea, Button } from '../ui'
import { useToast } from '../Toast'
import {
  createProveedor,
  updateProveedor,
  type Proveedor,
} from '../../lib/queries/proveedores'

/**
 * Modal para crear o editar un proveedor. Si recibe `editing`, actúa
 * en modo edit; sino, crea uno nuevo. Al guardar llama a `onSaved`
 * con el proveedor resultante (útil para auto-seleccionarlo en el
 * caller, ej. el form de pedido nuevo).
 */
export function ProveedorFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing?: Proveedor | null
  onClose: () => void
  onSaved?: (p: Proveedor) => void
}) {
  if (!open) return null
  return (
    <ProveedorFormBody
      key={editing?.id ?? 'new'}
      editing={editing}
      onClose={onClose}
      onSaved={onSaved}
    />
  )
}

function ProveedorFormBody({
  editing,
  onClose,
  onSaved,
}: {
  editing?: Proveedor | null
  onClose: () => void
  onSaved?: (p: Proveedor) => void
}) {
  const { addToast } = useToast()
  // Los initial values salen de editing en useState lazy. El wrapper
  // usa key={editing?.id ?? 'new'} para forzar remount al cambiar —
  // evita useEffect de sincronización y cascading renders.
  const [nombre, setNombre] = useState(editing?.nombre ?? '')
  const [contacto, setContacto] = useState(editing?.contacto_nombre ?? '')
  const [telefono, setTelefono] = useState(editing?.telefono ?? '')
  const [email, setEmail] = useState(editing?.email ?? '')
  const [notas, setNotas] = useState(editing?.notas ?? '')
  const [submitting, setSubmitting] = useState(false)

  const canSave = nombre.trim().length > 0 && !submitting

  async function handleSubmit() {
    if (!canSave) return
    setSubmitting(true)
    const payload = {
      nombre: nombre.trim(),
      contacto_nombre: contacto.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      notas: notas.trim() || null,
    }
    const res = editing
      ? await updateProveedor(editing.id, payload)
      : await createProveedor(payload)
    setSubmitting(false)
    if (res.error || !res.data) {
      addToast('error', res.error?.message ?? 'Error guardando proveedor')
      return
    }
    addToast('success', editing ? 'Proveedor actualizado' : 'Proveedor creado')
    onSaved?.(res.data)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
      size="sm"
    >
      <div className="space-y-3">
        <Field label="Nombre" required>
          <Input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="AUREN, BRACOR, …"
            autoFocus
          />
        </Field>
        <Field label="Persona de contacto">
          <Input
            value={contacto}
            onChange={e => setContacto(e.target.value)}
            placeholder="Nombre de la persona"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Teléfono">
            <Input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              inputMode="tel"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Notas">
          <Textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            placeholder="Condiciones de pago, forma de contacto, etc."
          />
        </Field>
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1"
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSave}
            className="flex-1"
          >
            {submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
