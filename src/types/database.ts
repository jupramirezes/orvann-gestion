export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          accion: string
          cambios: Json | null
          created_at: string | null
          id: string
          registro_id: string
          tabla: string
          usuario_id: string | null
        }
        Insert: {
          accion: string
          cambios?: Json | null
          created_at?: string | null
          id?: string
          registro_id: string
          tabla: string
          usuario_id?: string | null
        }
        Update: {
          accion?: string
          cambios?: Json | null
          created_at?: string | null
          id?: string
          registro_id?: string
          tabla?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_logs: {
        Row: {
          chat_id: string
          created_at: string | null
          error: string | null
          exitoso: boolean | null
          id: string
          intencion: string | null
          latencia_ms: number | null
          mensaje_entrante: string | null
          parametros_json: Json | null
          respuesta: string | null
          usuario_id: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          error?: string | null
          exitoso?: boolean | null
          id?: string
          intencion?: string | null
          latencia_ms?: number | null
          mensaje_entrante?: string | null
          parametros_json?: Json | null
          respuesta?: string | null
          usuario_id?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          error?: string | null
          exitoso?: boolean | null
          id?: string
          intencion?: string | null
          latencia_ms?: number | null
          mensaje_entrante?: string | null
          parametros_json?: Json | null
          respuesta?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_logs_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_gasto: {
        Row: {
          activa: boolean | null
          id: string
          nombre: string
          orden: number | null
          tipo: Database["public"]["Enums"]["tipo_categoria_gasto"]
        }
        Insert: {
          activa?: boolean | null
          id?: string
          nombre: string
          orden?: number | null
          tipo: Database["public"]["Enums"]["tipo_categoria_gasto"]
        }
        Update: {
          activa?: boolean | null
          id?: string
          nombre?: string
          orden?: number | null
          tipo?: Database["public"]["Enums"]["tipo_categoria_gasto"]
        }
        Relationships: []
      }
      cierres_caja: {
        Row: {
          cerrado: boolean | null
          consignaciones_salida: number | null
          created_at: string | null
          diferencia: number | null
          efectivo_contado: number | null
          efectivo_esperado: number | null
          efectivo_inicio: number | null
          fecha: string
          gastos_efectivo: number | null
          id: string
          notas: string | null
          responsable_id: string | null
          updated_at: string | null
          ventas_credito: number | null
          ventas_datafono: number | null
          ventas_efectivo: number | null
          ventas_plan_separe: number | null
          ventas_transferencia: number | null
        }
        Insert: {
          cerrado?: boolean | null
          consignaciones_salida?: number | null
          created_at?: string | null
          diferencia?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          efectivo_inicio?: number | null
          fecha: string
          gastos_efectivo?: number | null
          id?: string
          notas?: string | null
          responsable_id?: string | null
          updated_at?: string | null
          ventas_credito?: number | null
          ventas_datafono?: number | null
          ventas_efectivo?: number | null
          ventas_plan_separe?: number | null
          ventas_transferencia?: number | null
        }
        Update: {
          cerrado?: boolean | null
          consignaciones_salida?: number | null
          created_at?: string | null
          diferencia?: number | null
          efectivo_contado?: number | null
          efectivo_esperado?: number | null
          efectivo_inicio?: number | null
          fecha?: string
          gastos_efectivo?: number | null
          id?: string
          notas?: string | null
          responsable_id?: string | null
          updated_at?: string | null
          ventas_credito?: number | null
          ventas_datafono?: number | null
          ventas_efectivo?: number | null
          ventas_plan_separe?: number | null
          ventas_transferencia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cierres_caja_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          instagram: string | null
          nombre: string
          notas: string | null
          num_compras_cache: number | null
          primera_compra_fecha: string | null
          telefono: string | null
          total_comprado_cache: number | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          nombre: string
          notas?: string | null
          num_compras_cache?: number | null
          primera_compra_fecha?: string | null
          telefono?: string | null
          total_comprado_cache?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          nombre?: string
          notas?: string | null
          num_compras_cache?: number | null
          primera_compra_fecha?: string | null
          telefono?: string | null
          total_comprado_cache?: number | null
        }
        Relationships: []
      }
      consignaciones: {
        Row: {
          comprobante_url: string | null
          created_at: string | null
          cuenta_destino:
            | Database["public"]["Enums"]["cuenta_consignacion"]
            | null
          fecha: string
          id: string
          monto: number
          notas: string | null
          origen: Database["public"]["Enums"]["origen_consignacion"]
          responsable_id: string | null
        }
        Insert: {
          comprobante_url?: string | null
          created_at?: string | null
          cuenta_destino?:
            | Database["public"]["Enums"]["cuenta_consignacion"]
            | null
          fecha?: string
          id?: string
          monto: number
          notas?: string | null
          origen: Database["public"]["Enums"]["origen_consignacion"]
          responsable_id?: string | null
        }
        Update: {
          comprobante_url?: string | null
          created_at?: string | null
          cuenta_destino?:
            | Database["public"]["Enums"]["cuenta_consignacion"]
            | null
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          origen?: Database["public"]["Enums"]["origen_consignacion"]
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consignaciones_responsable_id_fkey"
            columns: ["responsable_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disenos: {
        Row: {
          activo: boolean | null
          categoria: Database["public"]["Enums"]["categoria_diseno"] | null
          created_at: string | null
          descripcion: string | null
          id: string
          nombre: string
          referencia_ano: number | null
        }
        Insert: {
          activo?: boolean | null
          categoria?: Database["public"]["Enums"]["categoria_diseno"] | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre: string
          referencia_ano?: number | null
        }
        Update: {
          activo?: boolean | null
          categoria?: Database["public"]["Enums"]["categoria_diseno"] | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          nombre?: string
          referencia_ano?: number | null
        }
        Relationships: []
      }
      entregas: {
        Row: {
          ciudad: string | null
          costo_envio: number | null
          direccion: string
          estado: Database["public"]["Enums"]["estado_entrega"] | null
          fecha_entrega: string | null
          fecha_programada: string | null
          id: string
          mensajero: string | null
          notas: string | null
          telefono_contacto: string | null
          venta_id: string
        }
        Insert: {
          ciudad?: string | null
          costo_envio?: number | null
          direccion: string
          estado?: Database["public"]["Enums"]["estado_entrega"] | null
          fecha_entrega?: string | null
          fecha_programada?: string | null
          id?: string
          mensajero?: string | null
          notas?: string | null
          telefono_contacto?: string | null
          venta_id: string
        }
        Update: {
          ciudad?: string | null
          costo_envio?: number | null
          direccion?: string
          estado?: Database["public"]["Enums"]["estado_entrega"] | null
          fecha_entrega?: string | null
          fecha_programada?: string | null
          id?: string
          mensajero?: string | null
          notas?: string | null
          telefono_contacto?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entregas_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: true
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          categoria_id: string
          created_at: string | null
          descripcion: string | null
          distribucion: Database["public"]["Enums"]["distribucion_gasto"]
          fecha: string
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto_andres: number | null
          monto_jp: number | null
          monto_kathe: number | null
          monto_orvann: number | null
          monto_total: number
          notas: string | null
          pagador: Database["public"]["Enums"]["pagador_gasto"]
          ref_pedido_id: string | null
        }
        Insert: {
          categoria_id: string
          created_at?: string | null
          descripcion?: string | null
          distribucion?: Database["public"]["Enums"]["distribucion_gasto"]
          fecha: string
          id?: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto_andres?: number | null
          monto_jp?: number | null
          monto_kathe?: number | null
          monto_orvann?: number | null
          monto_total: number
          notas?: string | null
          pagador: Database["public"]["Enums"]["pagador_gasto"]
          ref_pedido_id?: string | null
        }
        Update: {
          categoria_id?: string
          created_at?: string | null
          descripcion?: string | null
          distribucion?: Database["public"]["Enums"]["distribucion_gasto"]
          fecha?: string
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          monto_andres?: number | null
          monto_jp?: number | null
          monto_kathe?: number | null
          monto_orvann?: number | null
          monto_total?: number
          notas?: string | null
          pagador?: Database["public"]["Enums"]["pagador_gasto"]
          ref_pedido_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_ref_pedido_id_fkey"
            columns: ["ref_pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_proveedor"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_inventario: {
        Row: {
          cantidad: number
          fecha: string | null
          id: string
          notas: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id: string | null
          variante_id: string
        }
        Insert: {
          cantidad: number
          fecha?: string | null
          id?: string
          notas?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
          variante_id: string
        }
        Update: {
          cantidad?: number
          fecha?: string | null
          id?: string
          notas?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
          usuario_id?: string | null
          variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_inventario_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_inventario_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      parametros_costo: {
        Row: {
          activo: boolean | null
          aplicable_a: Database["public"]["Enums"]["tipo_producto"][] | null
          concepto: string
          costo_unitario: number
          descripcion: string | null
          id: string
          vigente_desde: string | null
          vigente_hasta: string | null
        }
        Insert: {
          activo?: boolean | null
          aplicable_a?: Database["public"]["Enums"]["tipo_producto"][] | null
          concepto: string
          costo_unitario: number
          descripcion?: string | null
          id?: string
          vigente_desde?: string | null
          vigente_hasta?: string | null
        }
        Update: {
          activo?: boolean | null
          aplicable_a?: Database["public"]["Enums"]["tipo_producto"][] | null
          concepto?: string
          costo_unitario?: number
          descripcion?: string | null
          id?: string
          vigente_desde?: string | null
          vigente_hasta?: string | null
        }
        Relationships: []
      }
      pedidos_proveedor: {
        Row: {
          created_at: string | null
          estado_pago: Database["public"]["Enums"]["estado_pago_pedido"] | null
          fecha_pago: string | null
          fecha_pedido: string
          fecha_recepcion: string | null
          id: string
          notas: string | null
          proveedor_id: string
          total: number | null
        }
        Insert: {
          created_at?: string | null
          estado_pago?: Database["public"]["Enums"]["estado_pago_pedido"] | null
          fecha_pago?: string | null
          fecha_pedido: string
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          proveedor_id: string
          total?: number | null
        }
        Update: {
          created_at?: string | null
          estado_pago?: Database["public"]["Enums"]["estado_pago_pedido"] | null
          fecha_pago?: string | null
          fecha_pedido?: string
          fecha_recepcion?: string | null
          id?: string
          notas?: string | null
          proveedor_id?: string
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_proveedor_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_proveedor_items: {
        Row: {
          costo_unitario: number
          descripcion_libre: string | null
          id: string
          pedido_id: string
          subtotal: number | null
          unidades: number
          variante_id: string | null
        }
        Insert: {
          costo_unitario: number
          descripcion_libre?: string | null
          id?: string
          pedido_id: string
          subtotal?: number | null
          unidades: number
          variante_id?: string | null
        }
        Update: {
          costo_unitario?: number
          descripcion_libre?: string | null
          id?: string
          pedido_id?: string
          subtotal?: number | null
          unidades?: number
          variante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_proveedor_items_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_proveedor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_proveedor_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_separe: {
        Row: {
          abonado: number | null
          cliente_id: string | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_separe"] | null
          fecha_inicio: string | null
          fecha_limite: string | null
          id: string
          notas: string | null
          saldo: number | null
          total: number
          venta_id: string | null
        }
        Insert: {
          abonado?: number | null
          cliente_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_separe"] | null
          fecha_inicio?: string | null
          fecha_limite?: string | null
          id?: string
          notas?: string | null
          saldo?: number | null
          total: number
          venta_id?: string | null
        }
        Update: {
          abonado?: number | null
          cliente_id?: string | null
          created_at?: string | null
          estado?: Database["public"]["Enums"]["estado_separe"] | null
          fecha_inicio?: string | null
          fecha_limite?: string | null
          id?: string
          notas?: string | null
          saldo?: number | null
          total?: number
          venta_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_separe_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_separe_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_separe_abonos: {
        Row: {
          fecha: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas: string | null
          separe_id: string
        }
        Insert: {
          fecha?: string | null
          id?: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas?: string | null
          separe_id: string
        }
        Update: {
          fecha?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          notas?: string | null
          separe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_separe_abonos_separe_id_fkey"
            columns: ["separe_id"]
            isOneToOne: false
            referencedRelation: "plan_separe"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_separe_items: {
        Row: {
          cantidad: number
          id: string
          precio_unit: number
          separe_id: string
          variante_id: string
        }
        Insert: {
          cantidad: number
          id?: string
          precio_unit: number
          separe_id: string
          variante_id: string
        }
        Update: {
          cantidad?: number
          id?: string
          precio_unit?: number
          separe_id?: string
          variante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_separe_items_separe_id_fkey"
            columns: ["separe_id"]
            isOneToOne: false
            referencedRelation: "plan_separe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_separe_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      productos: {
        Row: {
          activo: boolean | null
          created_at: string | null
          descripcion: string | null
          id: string
          imagen_url: string | null
          marca: string | null
          nombre: string
          proveedor_id: string | null
          tipo: Database["public"]["Enums"]["tipo_producto"]
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre: string
          proveedor_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_producto"]
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          descripcion?: string | null
          id?: string
          imagen_url?: string | null
          marca?: string | null
          nombre?: string
          proveedor_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_producto"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "productos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activo: boolean | null
          created_at: string | null
          es_socio: boolean | null
          id: string
          nombre: string
          porcentaje_sociedad: number | null
          rol: Database["public"]["Enums"]["rol_usuario"] | null
          telegram_chat_id: string | null
        }
        Insert: {
          activo?: boolean | null
          created_at?: string | null
          es_socio?: boolean | null
          id: string
          nombre: string
          porcentaje_sociedad?: number | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telegram_chat_id?: string | null
        }
        Update: {
          activo?: boolean | null
          created_at?: string | null
          es_socio?: boolean | null
          id?: string
          nombre?: string
          porcentaje_sociedad?: number | null
          rol?: Database["public"]["Enums"]["rol_usuario"] | null
          telegram_chat_id?: string | null
        }
        Relationships: []
      }
      proveedores: {
        Row: {
          activo: boolean | null
          contacto_nombre: string | null
          email: string | null
          id: string
          nombre: string
          notas: string | null
          telefono: string | null
        }
        Insert: {
          activo?: boolean | null
          contacto_nombre?: string | null
          email?: string | null
          id?: string
          nombre: string
          notas?: string | null
          telefono?: string | null
        }
        Update: {
          activo?: boolean | null
          contacto_nombre?: string | null
          email?: string | null
          id?: string
          nombre?: string
          notas?: string | null
          telefono?: string | null
        }
        Relationships: []
      }
      transformaciones: {
        Row: {
          cantidad: number
          costo_estampado_unit: number
          costo_total: number | null
          created_at: string | null
          fecha: string | null
          id: string
          notas: string | null
          usuario_id: string | null
          variante_destino_id: string
          variante_origen_id: string
        }
        Insert: {
          cantidad: number
          costo_estampado_unit: number
          costo_total?: number | null
          created_at?: string | null
          fecha?: string | null
          id?: string
          notas?: string | null
          usuario_id?: string | null
          variante_destino_id: string
          variante_origen_id: string
        }
        Update: {
          cantidad?: number
          costo_estampado_unit?: number
          costo_total?: number | null
          created_at?: string | null
          fecha?: string | null
          id?: string
          notas?: string | null
          usuario_id?: string | null
          variante_destino_id?: string
          variante_origen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transformaciones_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformaciones_variante_destino_id_fkey"
            columns: ["variante_destino_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformaciones_variante_origen_id_fkey"
            columns: ["variante_origen_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
        ]
      }
      variantes: {
        Row: {
          activo: boolean | null
          color: string | null
          costo_adicional: number | null
          costo_base: number
          costo_total: number | null
          created_at: string | null
          diseno_id: string | null
          estampado: Database["public"]["Enums"]["tipo_estampado"] | null
          id: string
          imagen_url: string | null
          margen_porcentaje: number | null
          notas: string | null
          precio_venta: number
          producto_id: string
          sku: string
          stock_cache: number | null
          talla: string | null
          updated_at: string | null
        }
        Insert: {
          activo?: boolean | null
          color?: string | null
          costo_adicional?: number | null
          costo_base: number
          costo_total?: number | null
          created_at?: string | null
          diseno_id?: string | null
          estampado?: Database["public"]["Enums"]["tipo_estampado"] | null
          id?: string
          imagen_url?: string | null
          margen_porcentaje?: number | null
          notas?: string | null
          precio_venta: number
          producto_id: string
          sku: string
          stock_cache?: number | null
          talla?: string | null
          updated_at?: string | null
        }
        Update: {
          activo?: boolean | null
          color?: string | null
          costo_adicional?: number | null
          costo_base?: number
          costo_total?: number | null
          created_at?: string | null
          diseno_id?: string | null
          estampado?: Database["public"]["Enums"]["tipo_estampado"] | null
          id?: string
          imagen_url?: string | null
          margen_porcentaje?: number | null
          notas?: string | null
          precio_venta?: number
          producto_id?: string
          sku?: string
          stock_cache?: number | null
          talla?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variantes_diseno_id_fkey"
            columns: ["diseno_id"]
            isOneToOne: false
            referencedRelation: "disenos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "variantes_producto_id_fkey"
            columns: ["producto_id"]
            isOneToOne: false
            referencedRelation: "productos"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_abonos: {
        Row: {
          comprobante_url: string | null
          fecha: string | null
          id: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas: string | null
          referencia: string | null
          venta_id: string
        }
        Insert: {
          comprobante_url?: string | null
          fecha?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas?: string | null
          referencia?: string | null
          venta_id: string
        }
        Update: {
          comprobante_url?: string | null
          fecha?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          notas?: string | null
          referencia?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_abonos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_items: {
        Row: {
          cantidad: number
          costo_unitario: number
          id: string
          margen_unit: number | null
          precio_unitario: number
          subtotal: number | null
          variante_id: string
          venta_id: string
        }
        Insert: {
          cantidad?: number
          costo_unitario: number
          id?: string
          margen_unit?: number | null
          precio_unitario: number
          subtotal?: number | null
          variante_id: string
          venta_id: string
        }
        Update: {
          cantidad?: number
          costo_unitario?: number
          id?: string
          margen_unit?: number | null
          precio_unitario?: number
          subtotal?: number | null
          variante_id?: string
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_items_variante_id_fkey"
            columns: ["variante_id"]
            isOneToOne: false
            referencedRelation: "variantes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venta_items_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      venta_pagos: {
        Row: {
          comision_pasarela: number | null
          comprobante_url: string | null
          created_at: string | null
          id: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas: string | null
          referencia: string | null
          venta_id: string
        }
        Insert: {
          comision_pasarela?: number | null
          comprobante_url?: string | null
          created_at?: string | null
          id?: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          notas?: string | null
          referencia?: string | null
          venta_id: string
        }
        Update: {
          comision_pasarela?: number | null
          comprobante_url?: string | null
          created_at?: string | null
          id?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          notas?: string | null
          referencia?: string | null
          venta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venta_pagos_venta_id_fkey"
            columns: ["venta_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
      ventas: {
        Row: {
          canal: Database["public"]["Enums"]["canal_venta"] | null
          cliente_id: string | null
          created_at: string | null
          descuento_monto: number | null
          descuento_motivo: string | null
          efectivo_recibido: number | null
          es_credito: boolean | null
          estado: Database["public"]["Enums"]["estado_venta"] | null
          fecha: string | null
          id: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          notas: string | null
          saldo_pendiente: number | null
          shopify_order_id: string | null
          subtotal: number | null
          tipo_transaccion:
            | Database["public"]["Enums"]["tipo_transaccion"]
            | null
          total: number | null
          vendedor_id: string | null
          venta_original_id: string | null
          vueltas: number | null
        }
        Insert: {
          canal?: Database["public"]["Enums"]["canal_venta"] | null
          cliente_id?: string | null
          created_at?: string | null
          descuento_monto?: number | null
          descuento_motivo?: string | null
          efectivo_recibido?: number | null
          es_credito?: boolean | null
          estado?: Database["public"]["Enums"]["estado_venta"] | null
          fecha?: string | null
          id?: string
          metodo_pago: Database["public"]["Enums"]["metodo_pago"]
          notas?: string | null
          saldo_pendiente?: number | null
          shopify_order_id?: string | null
          subtotal?: number | null
          tipo_transaccion?:
            | Database["public"]["Enums"]["tipo_transaccion"]
            | null
          total?: number | null
          vendedor_id?: string | null
          venta_original_id?: string | null
          vueltas?: number | null
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_venta"] | null
          cliente_id?: string | null
          created_at?: string | null
          descuento_monto?: number | null
          descuento_motivo?: string | null
          efectivo_recibido?: number | null
          es_credito?: boolean | null
          estado?: Database["public"]["Enums"]["estado_venta"] | null
          fecha?: string | null
          id?: string
          metodo_pago?: Database["public"]["Enums"]["metodo_pago"]
          notas?: string | null
          saldo_pendiente?: number | null
          shopify_order_id?: string | null
          subtotal?: number | null
          tipo_transaccion?:
            | Database["public"]["Enums"]["tipo_transaccion"]
            | null
          total?: number | null
          vendedor_id?: string | null
          venta_original_id?: string | null
          vueltas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ventas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ventas_venta_original_id_fkey"
            columns: ["venta_original_id"]
            isOneToOne: false
            referencedRelation: "ventas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_corregir_stock_cache: { Args: never; Returns: number }
      fn_generar_sku: {
        Args: {
          p_color: string
          p_diseno_id: string
          p_producto_id: string
          p_talla: string
        }
        Returns: string
      }
      fn_reconciliar_stock: {
        Args: never
        Returns: {
          diferencia: number
          sku: string
          stock_cache: number
          stock_real: number
          variante_id: string
        }[]
      }
      fn_sku_slug: { Args: { n: number; txt: string }; Returns: string }
    }
    Enums: {
      canal_venta: "tienda_fisica" | "whatsapp" | "shopify" | "otro"
      categoria_diseno:
        | "cine"
        | "musica"
        | "literatura"
        | "tv"
        | "deporte"
        | "cultura_pop"
        | "otro"
      cuenta_consignacion:
        | "ahorros_orvann"
        | "corriente_orvann"
        | "nequi_orvann"
        | "daviplata_orvann"
        | "otro"
      distribucion_gasto: "equitativa" | "asignada" | "orvann" | "custom"
      estado_entrega: "pendiente" | "en_ruta" | "entregado" | "devuelto"
      estado_pago_pedido: "pendiente" | "pagado" | "credito"
      estado_separe: "abierto" | "completado" | "cancelado"
      estado_venta: "completada" | "anulada" | "plan_separe_abierto"
      metodo_pago:
        | "efectivo"
        | "transferencia"
        | "datafono"
        | "credito"
        | "plan_separe"
        | "mixto"
      origen_consignacion:
        | "caja_tienda"
        | "aporte_kathe"
        | "aporte_andres"
        | "aporte_jp"
        | "otro"
      pagador_gasto: "ORVANN" | "KATHE" | "ANDRES" | "JP"
      rol_usuario: "admin" | "vendedor"
      tipo_categoria_gasto: "fijo" | "variable"
      tipo_estampado:
        | "ninguno"
        | "punto_corazon_estampado"
        | "punto_corazon_bordado"
        | "completo_dtg"
        | "doble_punto_y_completo"
        | "doble_bordado_y_completo"
        | "triple_completo"
      tipo_movimiento:
        | "entrada_pedido"
        | "venta"
        | "anulacion_venta"
        | "transformacion_out"
        | "transformacion_in"
        | "ajuste_positivo"
        | "ajuste_negativo"
        | "baja"
      tipo_producto: "prenda" | "fragancia" | "accesorio" | "otro"
      tipo_transaccion: "venta" | "devolucion" | "cambio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      canal_venta: ["tienda_fisica", "whatsapp", "shopify", "otro"],
      categoria_diseno: [
        "cine",
        "musica",
        "literatura",
        "tv",
        "deporte",
        "cultura_pop",
        "otro",
      ],
      cuenta_consignacion: [
        "ahorros_orvann",
        "corriente_orvann",
        "nequi_orvann",
        "daviplata_orvann",
        "otro",
      ],
      distribucion_gasto: ["equitativa", "asignada", "orvann", "custom"],
      estado_entrega: ["pendiente", "en_ruta", "entregado", "devuelto"],
      estado_pago_pedido: ["pendiente", "pagado", "credito"],
      estado_separe: ["abierto", "completado", "cancelado"],
      estado_venta: ["completada", "anulada", "plan_separe_abierto"],
      metodo_pago: [
        "efectivo",
        "transferencia",
        "datafono",
        "credito",
        "plan_separe",
        "mixto",
      ],
      origen_consignacion: [
        "caja_tienda",
        "aporte_kathe",
        "aporte_andres",
        "aporte_jp",
        "otro",
      ],
      pagador_gasto: ["ORVANN", "KATHE", "ANDRES", "JP"],
      rol_usuario: ["admin", "vendedor"],
      tipo_categoria_gasto: ["fijo", "variable"],
      tipo_estampado: [
        "ninguno",
        "punto_corazon_estampado",
        "punto_corazon_bordado",
        "completo_dtg",
        "doble_punto_y_completo",
        "doble_bordado_y_completo",
        "triple_completo",
      ],
      tipo_movimiento: [
        "entrada_pedido",
        "venta",
        "anulacion_venta",
        "transformacion_out",
        "transformacion_in",
        "ajuste_positivo",
        "ajuste_negativo",
        "baja",
      ],
      tipo_producto: ["prenda", "fragancia", "accesorio", "otro"],
      tipo_transaccion: ["venta", "devolucion", "cambio"],
    },
  },
} as const
