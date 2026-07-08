/* ============================================
   SISTEMA DE INVENTARIO - REPUESTOS DE MOTOS
   JavaScript Vanilla - CRUD con localStorage
   ============================================ */

// Importamos los estilos CSS
import './style.css';

/* ============================================
   SECCIÓN 1: CONFIGURACIÓN Y CONSTANTES
   ============================================ */

// Nombre de la clave en localStorage para los repuestos
const STORAGE_KEY = 'repuestos_motos';

// Estado de la aplicación
let repuestos = [];           // Array con todos los repuestos
let modoEdicion = false;       // Indica si estamos editando un registro
let idEditando = null;         // ID del repuesto que se está editando
let idEliminar = null;         // ID del repuesto a eliminar (para el modal)

/* ============================================
   SECCIÓN 2: FUNCIONES DE LOCALSTORAGE
   Estas funciones interactúan directamente con localStorage
   ============================================ */

/**
 * Obtiene todos los repuestos almacenados en localStorage.
 * Si no existen, devuelve un array vacío.
 * @returns {Array} Lista de repuestos
 */
function obtenerRepuestos() {
  const datos = localStorage.getItem(STORAGE_KEY);
  // Si hay datos, los parseamos de JSON; si no, devolvemos array vacío
  return datos ? JSON.parse(datos) : [];
}

/**
 * Guarda el array de repuestos en localStorage.
 * Convierte el array a formato JSON antes de guardarlo.
 * @param {Array} lista - Array de repuestos a guardar
 */
function guardarRepuestos(lista) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
}

/**
 * Genera un ID único para cada repuesto.
 * Usa el timestamp actual más un número aleatorio.
 * @returns {string} ID único generado
 */
function generarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/* ============================================
   SECCIÓN 3: OPERACIONES CRUD
   Create, Read, Update, Delete
   ============================================ */

/**
 * CREATE - Crea un nuevo repuesto y lo guarda en localStorage.
 * @param {Object} datos - Datos del nuevo repuesto
 * @returns {Object} El repuesto creado con su ID
 */
function crearRepuesto(datos) {
  const nuevoRepuesto = {
    id: generarId(),
    codigo: datos.codigo,
    nombre: datos.nombre,
    marca: datos.marca,
    cantidad: parseInt(datos.cantidad),
    precio: parseFloat(datos.precio),
    fechaCreacion: new Date().toISOString()
  };

  // Obtenemos la lista actual, añadimos el nuevo y guardamos
  const lista = obtenerRepuestos();
  lista.push(nuevoRepuesto);
  guardarRepuestos(lista);

  return nuevoRepuesto;
}

/**
 * READ - Lee todos los repuestos de localStorage.
 * @returns {Array} Lista de todos los repuestos
 */
function leerRepuestos() {
  return obtenerRepuestos();
}

/**
 * UPDATE - Actualiza un repuesto existente.
 * @param {string} id - ID del repuesto a actualizar
 * @param {Object} datos - Nuevos datos del repuesto
 * @returns {Object|null} El repuesto actualizado o null si no existe
 */
function actualizarRepuesto(id, datos) {
  const lista = obtenerRepuestos();
  const indice = lista.findIndex(r => r.id === id);

  // Si encontramos el repuesto, lo actualizamos
  if (indice !== -1) {
    lista[indice] = {
      ...lista[indice],
      codigo: datos.codigo,
      nombre: datos.nombre,
      marca: datos.marca,
      cantidad: parseInt(datos.cantidad),
      precio: parseFloat(datos.precio),
      fechaActualizacion: new Date().toISOString()
    };
    guardarRepuestos(lista);
    return lista[indice];
  }
  return null;
}

/**
 * DELETE - Elimina un repuesto por su ID.
 * @param {string} id - ID del repuesto a eliminar
 * @returns {boolean} true si se eliminó, false si no existía
 */
function eliminarRepuesto(id) {
  const lista = obtenerRepuestos();
  const nuevaLista = lista.filter(r => r.id !== id);

  // Si las listas tienen diferente longitud, se eliminó algo
  if (nuevaLista.length !== lista.length) {
    guardarRepuestos(nuevaLista);
    return true;
  }
  return false;
}

/**
 * SEARCH - Busca repuestos por código o nombre.
 * @param {string} termino - Término de búsqueda
 * @returns {Array} Lista de repuestos que coinciden
 */
function buscarRepuestos(termino) {
  const lista = obtenerRepuestos();
  const terminoLower = termino.toLowerCase().trim();

  // Filtramos buscando coincidencias en código o nombre
  return lista.filter(r =>
    r.codigo.toLowerCase().includes(terminoLower) ||
    r.nombre.toLowerCase().includes(terminoLower)
  );
}

/* ============================================
   SECCIÓN 4: FUNCIONES DE LA INTERFAZ (UI)
   Estas funciones actualizan el DOM
   ============================================ */

/**
 * Renderiza la estructura HTML principal del dashboard.
 */
function renderizarApp() {
  document.querySelector('#app').innerHTML = `
    <!-- ENCABEZADO DEL DASHBOARD -->
    <header class="header">
      <h1>MotoRepuestos - Sistema de Inventario</h1>
      <p>Gestión completa de repuestos para motocicletas</p>
    </header>

    <!-- ESTADÍSTICAS RÁPIDAS -->
    <section class="stats">
      <div class="stat-card">
        <h3>Total Repuestos</h3>
        <p id="stat-total">0</p>
      </div>
      <div class="stat-card">
        <h3>Valor del Inventario</h3>
        <p id="stat-valor">$0</p>
      </div>
      <div class="stat-card">
        <h3>Stock Bajo</h3>
        <p id="stat-bajo">0</p>
      </div>
      <div class="stat-card">
        <h3>Marcas</h3>
        <p id="stat-marcas">0</p>
      </div>
    </section>

    <!-- PANEL PRINCIPAL: Formulario + Tabla -->
    <div class="panel">
      <!-- FORMULARIO DE REGISTRO -->
      <aside class="card">
        <h2 id="titulo-form">Agregar Repuesto</h2>
        <form id="form-repuesto">
          <div class="form-group">
            <label for="codigo">Código *</label>
            <input
              type="text"
              id="codigo"
              name="codigo"
              placeholder="Ej: MTO-001"
              required
            />
          </div>
          <div class="form-group">
            <label for="nombre">Nombre del Repuesto *</label>
            <input
              type="text"
              id="nombre"
              name="nombre"
              placeholder="Ej: Filtro de aceite"
              required
            />
          </div>
          <div class="form-group">
            <label for="marca">Marca *</label>
            <input
              type="text"
              id="marca"
              name="marca"
              placeholder="Ej: Bajaj, Honda, Yamaha"
              required
            />
          </div>
          <div class="form-group">
            <label for="cantidad">Cantidad en Stock *</label>
            <input
              type="number"
              id="cantidad"
              name="cantidad"
              placeholder="Ej: 10"
              min="0"
              required
            />
          </div>
          <div class="form-group">
            <label for="precio">Precio ($) *</label>
            <input
              type="number"
              id="precio"
              name="precio"
              placeholder="Ej: 25.50"
              step="0.01"
              min="0"
              required
            />
          </div>

          <!-- Botones del formulario -->
          <div id="form-buttons">
            <button type="submit" class="btn btn-principal" id="btn-guardar">
              + Agregar Repuesto
            </button>
          </div>
          <div class="form-actions" id="edit-buttons" style="display: none;">
            <button type="submit" class="btn btn-principal">
              Guardar Cambios
            </button>
            <button type="button" class="btn btn-cancelar" id="btn-cancelar">
              Cancelar
            </button>
          </div>

          <!-- Mensaje de estado -->
          <div id="mensaje" class="mensaje"></div>
        </form>
      </aside>

      <!-- TABLA DE REPUESTOS -->
      <main class="card">
        <h2>Lista de Repuestos</h2>

        <!-- Buscador -->
        <div class="buscador-container">
          <input
            type="text"
            id="buscador"
            class="buscador"
            placeholder="Buscar por código o nombre..."
          />
        </div>

        <!-- Tabla de datos -->
        <div class="tabla-container">
          <table class="tabla">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Marca</th>
                <th>Stock</th>
                <th>Precio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="tabla-body">
              <!-- Los datos se cargan dinámicamente -->
            </tbody>
          </table>
        </div>
      </main>
    </div>
  `;
}

/**
 * Actualiza las estadísticas del dashboard.
 */
function actualizarEstadisticas() {
  const lista = obtenerRepuestos();

  // Total de repuestos
  document.getElementById('stat-total').textContent = lista.length;

  // Valor total del inventario (suma de cantidad * precio)
  const valorTotal = lista.reduce((total, r) => total + (r.cantidad * r.precio), 0);
  document.getElementById('stat-valor').textContent = formatearPrecio(valorTotal);

  // Repuestos con stock bajo (menos de 5 unidades)
  const stockBajo = lista.filter(r => r.cantidad < 5).length;
  document.getElementById('stat-bajo').textContent = stockBajo;

  // Cantidad de marcas diferentes
  const marcas = new Set(lista.map(r => r.marca.toLowerCase()));
  document.getElementById('stat-marcas').textContent = marcas.size;
}

/**
 * Renderiza la tabla con los repuestos.
 * @param {Array} datos - Lista de repuestos a mostrar
 */
function renderizarTabla(datos) {
  const tbody = document.getElementById('tabla-body');

  // Si no hay datos, mostramos mensaje
  if (datos.length === 0) {
    tbody.innerHTML = `
      <tr class="sin-datos">
        <td colspan="6">
          No hay repuestos registrados. Agregue uno nuevo usando el formulario.
        </td>
      </tr>
    `;
    return;
  }

  // Generamos las filas de la tabla
  tbody.innerHTML = datos.map(r => `
    <tr>
      <td><strong>${escapeHtml(r.codigo)}</strong></td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.marca)}</td>
      <td>
        <span style="color: ${r.cantidad < 5 ? 'var(--color-error)' : 'var(--color-exito)'}">
          ${r.cantidad}
        </span>
      </td>
      <td>${formatearPrecio(r.precio)}</td>
      <td class="acciones">
        <button class="btn btn-editar" data-id="${r.id}" data-accion="editar">
          Editar
        </button>
        <button class="btn btn-eliminar" data-id="${r.id}" data-accion="eliminar">
          Eliminar
        </button>
      </td>
    </tr>
  `).join('');
}

/**
 * Formatea un número como precio en moneda.
 * @param {number} valor - Valor a formatear
 * @returns {string} Precio formateado
 */
function formatearPrecio(valor) {
  return '$' + valor.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} texto - Texto a escapar
 * @returns {string} Texto escapado
 */
function escapeHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

/**
 * Muestra un mensaje de éxito o error en el formulario.
 * @param {string} texto - Texto del mensaje
 * @param {string} tipo - 'exito' o 'error'
 */
function mostrarMensaje(texto, tipo) {
  const mensaje = document.getElementById('mensaje');
  mensaje.textContent = texto;
  mensaje.className = `mensaje ${tipo}`;

  // Ocultar mensaje después de 3 segundos
  setTimeout(() => {
    mensaje.className = 'mensaje';
  }, 3000);
}

/**
 * Limpia todos los campos del formulario.
 */
function limpiarFormulario() {
  document.getElementById('codigo').value = '';
  document.getElementById('nombre').value = '';
  document.getElementById('marca').value = '';
  document.getElementById('cantidad').value = '';
  document.getElementById('precio').value = '';
}

/**
 * Carga los datos de un repuesto en el formulario para edición.
 * @param {Object} repuesto - Repuesto a editar
 */
function cargarFormularioEdicion(repuesto) {
  document.getElementById('codigo').value = repuesto.codigo;
  document.getElementById('nombre').value = repuesto.nombre;
  document.getElementById('marca').value = repuesto.marca;
  document.getElementById('cantidad').value = repuesto.cantidad;
  document.getElementById('precio').value = repuesto.precio;

  // Cambiar a modo edición
  modoEdicion = true;
  idEditando = repuesto.id;

  // Actualizar interfaz
  document.getElementById('titulo-form').textContent = 'Editar Repuesto';
  document.getElementById('form-buttons').style.display = 'none';
  document.getElementById('edit-buttons').style.display = 'flex';
}

/**
 * Cancela el modo edición y restaura el formulario.
 */
function cancelarEdicion() {
  modoEdicion = false;
  idEditando = null;
  limpiarFormulario();

  // Restaurar interfaz
  document.getElementById('titulo-form').textContent = 'Agregar Repuesto';
  document.getElementById('form-buttons').style.display = 'block';
  document.getElementById('edit-buttons').style.display = 'none';
}

/**
 * Abre el modal de confirmación para eliminar.
 * @param {string} id - ID del repuesto a eliminar
 */
function abrirModalEliminar(id) {
  idEliminar = id;
  document.getElementById('modal-confirmar').classList.add('activo');
}

/**
 * Cierra el modal de confirmación.
 */
function cerrarModalEliminar() {
  idEliminar = null;
  document.getElementById('modal-confirmar').classList.remove('activo');
}

/* ============================================
   SECCIÓN 5: MANEJO DE EVENTOS
   Conecta las acciones del usuario con la lógica
   ============================================ */

/**
 * Configura todos los event listeners de la aplicación.
 */
function configurarEventos() {
  // === EVENTO: Enviar formulario ===
  const form = document.getElementById('form-repuesto');
  form.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevenir recarga de página

    // Obtener datos del formulario
    const datos = {
      codigo: document.getElementById('codigo').value.trim(),
      nombre: document.getElementById('nombre').value.trim(),
      marca: document.getElementById('marca').value.trim(),
      cantidad: document.getElementById('cantidad').value,
      precio: document.getElementById('precio').value
    };

    // Validar que todos los campos estén llenos
    if (!datos.codigo || !datos.nombre || !datos.marca || !datos.cantidad || !datos.precio) {
      mostrarMensaje('Por favor complete todos los campos', 'error');
      return;
    }

    // Crear o actualizar según el modo
    if (modoEdicion && idEditando) {
      // Modo edición: actualizar repuesto existente
      const actualizado = actualizarRepuesto(idEditando, datos);
      if (actualizado) {
        mostrarMensaje('Repuesto actualizado correctamente', 'exito');
        cancelarEdicion();
      } else {
        mostrarMensaje('Error al actualizar el repuesto', 'error');
      }
    } else {
      // Modo creación: crear nuevo repuesto
      crearRepuesto(datos);
      mostrarMensaje('Repuesto agregado correctamente', 'exito');
      limpiarFormulario();
    }

    // Actualizar vista
    repuestos = leerRepuestos();
    renderizarTabla(repuestos);
    actualizarEstadisticas();
  });

  // === EVENTO: Cancelar edición ===
  document.getElementById('btn-cancelar').addEventListener('click', cancelarEdicion);

  // === EVENTO: Buscador en tiempo real ===
  document.getElementById('buscador').addEventListener('input', (e) => {
    const termino = e.target.value;

    if (termino.trim() === '') {
      // Si el buscador está vacío, mostrar todos
      renderizarTabla(repuestos);
    } else {
      // Filtrar según el término de búsqueda
      const resultados = buscarRepuestos(termino);
      renderizarTabla(resultados);
    }
  });

  // === EVENTO: Botones de la tabla (editar/eliminar) ===
  document.getElementById('tabla-body').addEventListener('click', (e) => {
    const boton = e.target;

    // Verificar que sea un botón con acción
    if (boton.dataset.accion && boton.dataset.id) {
      const accion = boton.dataset.accion;
      const id = boton.dataset.id;

      if (accion === 'editar') {
        // Buscar el repuesto y cargar en formulario
        const repuesto = repuestos.find(r => r.id === id);
        if (repuesto) {
          cargarFormularioEdicion(repuesto);
          // Scroll al formulario
          document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
        }
      } else if (accion === 'eliminar') {
        // Abrir modal de confirmación
        abrirModalEliminar(id);
      }
    }
  });

  // === EVENTOS DEL MODAL ===
  document.getElementById('btn-confirmar-eliminar').addEventListener('click', () => {
    if (idEliminar) {
      eliminarRepuesto(idEliminar);
      repuestos = leerRepuestos();
      renderizarTabla(repuestos);
      actualizarEstadisticas();
      mostrarMensaje('Repuesto eliminado correctamente', 'exito');
      cerrarModalEliminar();
    }
  });

  document.getElementById('btn-cancelar-eliminar').addEventListener('click', cerrarModalEliminar);

  // Cerrar modal al hacer clic fuera
  document.getElementById('modal-confirmar').addEventListener('click', (e) => {
    if (e.target.id === 'modal-confirmar') {
      cerrarModalEliminar();
    }
  });
}

/* ============================================
   SECCIÓN 6: INICIALIZACIÓN
   Punto de entrada de la aplicación
   ============================================ */

/**
 * Función principal que inicializa la aplicación.
 */
function inicializarApp() {
  // Renderizar la estructura HTML
  renderizarApp();

  // Cargar datos desde localStorage
  repuestos = leerRepuestos();

  // Mostrar datos en la tabla
  renderizarTabla(repuestos);

  // Actualizar estadísticas
  actualizarEstadisticas();

  // Configurar event listeners
  configurarEventos();

  // Mensaje en consola para depuración
  console.log('✅ Sistema de Inventario iniciado correctamente');
  console.log(`📦 ${repuestos.length} repuestos cargados desde localStorage`);
}

// Iniciar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarApp);
