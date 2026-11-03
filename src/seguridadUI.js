import { supabase } from './supabaseClient.js';

const acciones = ['crear','leer','actualizar','eliminar','exportar','importar','anular'];
const icono = (nombre) => ({"shield":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z\"/><path d=\"m9 12 2 2 4-4\"/></svg>","users":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20\"/><circle cx=\"10\" cy=\"7\" r=\"3.5\"/><path d=\"M17 11a3.5 3.5 0 0 0 0-7M20 20v-1.5a4.5 4.5 0 0 0-3-4.25\"/></svg>","key":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"8\" cy=\"15\" r=\"4\"/><path d=\"m11 12 9-9m-3 3 3 3m-6 0 3 3\"/></svg>","plus":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 5v14M5 12h14\"/></svg>","search":"<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"10.8\" cy=\"10.8\" r=\"6.8\"/><path d=\"m16 16 5 5\"/></svg>"})[nombre] || '';
const escapeHtml = (value='') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export async function renderizarSeguridad(contenedor) {
  contenedor.innerHTML = '<section class="panel"><p>Cargando gestión de roles y permisos...</p></section>';
  const [rolesRes, modulosRes, vistasRes, permisosRes, usuariosRes] = await Promise.all([
    supabase.from('rol').select('id,nombre_rol,descripcion').order('id'),
    supabase.from('modulo').select('id,nombre_modulo,orden').order('orden'),
    supabase.from('vistas').select('id,nombre_vista,ruta_acceso,modulo_id').order('id'),
    supabase.from('permisos').select('id,nombre_permiso').order('id'),
    supabase.from('usuario').select('id,nombre,email,activo').order('nombre')
  ]);
  const error = [rolesRes,modulosRes,vistasRes,permisosRes,usuariosRes].find(x => x.error)?.error;
  if (error) {
    contenedor.innerHTML = '<section class="panel"><h2>Gestión de seguridad</h2><p class="mensaje error">No se pudieron cargar los datos. Verifica que tu cuenta tenga permiso para administrar roles.</p></section>';
    console.error(error);
    return;
  }

  const roles = rolesRes.data || [];
  const modulos = modulosRes.data || [];
  const vistas = vistasRes.data || [];
  const permisos = permisosRes.data || [];
  const usuarios = usuariosRes.data || [];

  contenedor.innerHTML = `
    <section class="panel seguridad-panel">
      <header class="seguridad-header">
        <div><span class="eyebrow">ADMINISTRACIÓN DEL SISTEMA</span><h2>${icono('shield')} Roles y permisos</h2><p>Controla quién puede acceder a cada módulo y qué acciones puede realizar.</p></div>
      </header>
      <div class="seguridad-resumen">
        <article><span class="seguridad-resumen-icon">${icono('shield')}</span><div><strong>${roles.length}</strong><small>Roles registrados</small></div></article>
        <article><span class="seguridad-resumen-icon">${icono('users')}</span><div><strong>${usuarios.length}</strong><small>Usuarios registrados</small></div></article>
        <article><span class="seguridad-resumen-icon">${icono('key')}</span><div><strong>${permisos.length}</strong><small>Tipos de permiso</small></div></article>
      </div>
      <nav class="seguridad-nav" aria-label="Secciones de seguridad">
        <button type="button" class="seguridad-nav-btn active" data-security-tab="roles">${icono('shield')} Roles</button>
        <button type="button" class="seguridad-nav-btn" data-security-tab="usuarios">${icono('users')} Usuarios</button>
        <button type="button" class="seguridad-nav-btn" data-security-tab="permisos">${icono('key')} Permisos</button>
      </nav>
      <div class="card seguridad-seccion active" data-security-panel="roles">
        <h3>${icono('plus')} Crear un rol</h3>
        <form id="form-nuevo-rol" class="form-row">
          <div class="form-group"><label for="nuevo-rol-nombre">Nombre</label><input id="nuevo-rol-nombre" required maxlength="60" placeholder="Ej. Supervisor"></div>
          <div class="form-group"><label for="nuevo-rol-descripcion">Descripción</label><input id="nuevo-rol-descripcion" maxlength="180" placeholder="Responsabilidades del rol"></div>
          <button class="btn btn-principal" type="submit">Crear rol</button>
        </form>
        <div id="seguridad-mensaje" class="mensaje" aria-live="polite"></div>
      </div>
      <div class="card seguridad-seccion" data-security-panel="usuarios">
        <h3>${icono('users')} Crear cuenta de usuario</h3>
        <p>Se enviará una invitación al correo. Puedes asignarle varios roles desde el momento de crear la cuenta.</p>
        <form id="form-nuevo-usuario" class="form-row">
          <div class="form-group"><label for="nuevo-usuario-nombre">Nombre</label><input id="nuevo-usuario-nombre" required maxlength="100"></div>
          <div class="form-group"><label for="nuevo-usuario-email">Correo electrónico</label><input id="nuevo-usuario-email" type="email" required></div>
          <div class="form-group"><label for="nuevo-usuario-roles">Roles</label>
            <select id="nuevo-usuario-roles" multiple required size="4">
              ${roles.map(r => `<option value="${r.id}">${escapeHtml(r.nombre_rol)}</option>`).join('')}
            </select>
            <small>Mantén presionada Ctrl para elegir varios roles.</small>
          </div>
          <button class="btn btn-principal" type="submit">Crear y enviar invitación</button>
        </form>
      </div>
      <div class="card seguridad-seccion" data-security-panel="usuarios">
        <h3>${icono('shield')} Asignar roles a un usuario</h3>
        <form id="form-asignar-rol" class="form-row">
          <div class="form-group"><label for="usuario-seguridad">Usuario</label>
            <select id="usuario-seguridad" required>
              <option value="">Selecciona un usuario</option>
              ${usuarios.map(u => `<option value="${u.id}">${escapeHtml(u.nombre)} — ${escapeHtml(u.email)}${u.activo ? '' : ' (inactivo)'}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label for="rol-asignar">Rol</label>
            <select id="rol-asignar" required><option value="">Selecciona un rol</option>
              ${roles.map(r => `<option value="${r.id}">${escapeHtml(r.nombre_rol)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-principal" type="submit">Asignar rol</button>
        </form>
        <div id="roles-usuario" class="mensaje"></div>
      </div>
      <div class="card seguridad-seccion" data-security-panel="permisos">
        <div class="permisos-intro">
          <div><span class="eyebrow">ACCESO AL SISTEMA</span><h3>${icono('key')} Configurar permisos</h3>
            <p>Elige un rol y define a qué secciones puede entrar y qué acciones puede realizar.</p></div>
          <div class="permisos-help"><strong>Cómo funciona</strong><span>Los cambios se guardan al instante en Supabase.</span></div>
        </div>
        <div class="permisos-toolbar">
          <div class="form-group"><label for="rol-permisos">1. Selecciona el rol</label>
            <select id="rol-permisos"><option value="">Elige un rol para comenzar</option>
              ${roles.map(r => `<option value="${r.id}">${escapeHtml(r.nombre_rol)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group permisos-search-group"><label for="buscar-permiso">2. Busca una sección</label>
            <div class="seguridad-filtro">${icono('search')}<input id="buscar-permiso" type="search" placeholder="Ej. inventario, ventas, usuarios..." aria-label="Buscar módulos o pantallas" disabled></div>
          </div>
        </div>
        <div id="permisos-resumen" class="permisos-resumen" hidden></div>
        <div id="matriz-permisos" class="matriz-permisos"><div class="permisos-empty"><span class="permisos-empty-icon">${icono('shield')}</span><strong>Configura el acceso de cada rol</strong><p>Selecciona un rol arriba para ver sus módulos y permisos.</p></div></div>
        <div id="permisos-estado" class="permisos-estado" role="status" aria-live="polite">Aún no has seleccionado un rol.</div>
      </div>
    </section>
  `;

  // Navegación entre apartados sin recargar los datos.
  const cambiarSeccion = (nombre) => {
    contenedor.querySelectorAll('[data-security-tab]').forEach(b => b.classList.toggle('active', b.dataset.securityTab === nombre));
    contenedor.querySelectorAll('[data-security-panel]').forEach(p => p.classList.toggle('active', p.dataset.securityPanel === nombre));
  };
  contenedor.querySelectorAll('[data-security-tab]').forEach(b => b.addEventListener('click', () => cambiarSeccion(b.dataset.securityTab)));
  document.getElementById('buscar-permiso')?.addEventListener('input', e => {
    const q = e.target.value.toLocaleLowerCase('es');
    contenedor.querySelectorAll('.seguridad-modulo').forEach(card => { card.hidden = !card.textContent.toLocaleLowerCase('es').includes(q); });
  });

  const mensaje = (text, isError=false) => {
    const el = document.getElementById('seguridad-mensaje');
    if (el) { el.textContent = text; el.className = isError ? 'mensaje error' : 'mensaje exito'; }
  };

  document.getElementById('form-nuevo-rol').addEventListener('submit', async event => {
    event.preventDefault();
    const nombre_rol = document.getElementById('nuevo-rol-nombre').value.trim();
    const descripcion = document.getElementById('nuevo-rol-descripcion').value.trim();
    const { data, error } = await supabase.from('rol').insert({nombre_rol,descripcion}).select('id').single();
    if (error) return mensaje(error.message, true);
    const enlaces = modulos.map(m => ({rol_id:data.id,modulo_id:m.id,habilitado:true}));
    const { data: asignaciones, error: errorAsignaciones } = await supabase.from('r_modulo_rol').insert(enlaces).select('id,modulo_id');
    if (errorAsignaciones) return mensaje('El rol se creó, pero no se pudieron crear sus módulos: '+errorAsignaciones.message, true);
    const idsVista = vistas.map(v => v.id);
    const matriz = [];
    for (const a of asignaciones || []) {
      for (const v of vistas.filter(x => x.modulo_id === a.modulo_id)) {
        for (const p of permisos) matriz.push({r_modulo_rol_id:a.id,vista_id:v.id,permiso_id:p.id,permitido:false});
      }
    }
    if (matriz.length) {
      const {error: errorMatriz} = await supabase.from('vistas_permiso').insert(matriz);
      if (errorMatriz) return mensaje('Rol creado; falló la inicialización de permisos: '+errorMatriz.message,true);
    }
    mensaje('Rol creado. Todos sus permisos comienzan denegados.');
    await renderizarSeguridad(contenedor);
  });

  document.getElementById('form-nuevo-usuario').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    const nombre = document.getElementById('nuevo-usuario-nombre').value.trim();
    const email = document.getElementById('nuevo-usuario-email').value.trim();
    const role_ids = Array.from(document.getElementById('nuevo-usuario-roles').selectedOptions).map(o => Number(o.value));
    const {data,error} = await supabase.functions.invoke('admin-create-user',{body:{nombre,email,role_ids}});
    button.disabled = false;
    if (error || data?.error) {
      mensaje(data?.error || error.message || 'No se pudo crear el usuario.',true);
      return;
    }
    mensaje(data.message || 'Invitación enviada.');
    await renderizarSeguridad(contenedor);
  });

  document.getElementById('form-asignar-rol').addEventListener('submit', async event => {
    event.preventDefault();
    const usuario_id = Number(document.getElementById('usuario-seguridad').value);
    const rol_id = Number(document.getElementById('rol-asignar').value);
    const {error} = await supabase.from('r_usuario_rol').insert({usuario_id,rol_id});
    if (error) {
      const out = document.getElementById('roles-usuario');
      out.textContent = error.code === '23505' ? 'Ese usuario ya tiene asignado ese rol.' : error.message;
      return;
    }
    document.getElementById('roles-usuario').textContent = 'Rol asignado correctamente. El usuario puede tener más de un rol.';
  });

  document.getElementById('usuario-seguridad').addEventListener('change', async event => {
    const id = Number(event.target.value);
    const out = document.getElementById('roles-usuario');
    if (!id) { out.textContent=''; return; }
    const {data,error} = await supabase.from('r_usuario_rol').select('rol:rol(nombre_rol)').eq('usuario_id',id);
    if (error) { out.textContent=error.message; return; }
    out.textContent = 'Roles actuales: '+((data||[]).map(x=>x.rol?.nombre_rol).filter(Boolean).join(', ') || 'Sin roles asignados');
  });

  const selectorRol = document.getElementById('rol-permisos');
  const buscadorPermisos = document.getElementById('buscar-permiso');
  const resumenPermisos = document.getElementById('permisos-resumen');
  const estadoPermisos = document.getElementById('permisos-estado');
  const estadoPermiso = (texto, error=false) => {
    estadoPermisos.textContent = texto;
    estadoPermisos.classList.toggle('error', error);
    estadoPermisos.classList.toggle('exito', !error);
  };
  const etiquetaPermiso = nombre => ({
    crear: 'Crear registros', leer: 'Consultar información', actualizar: 'Modificar registros',
    eliminar: 'Eliminar registros', exportar: 'Exportar información',
    importar: 'Importar información', anular: 'Anular operaciones'
  }[String(nombre).toLowerCase()] || nombre);
  const descripcionPermiso = nombre => ({
    crear: 'Permite registrar nuevos datos.',
    leer: 'Permite consultar y visualizar información.',
    actualizar: 'Permite editar información existente.',
    eliminar: 'Permite eliminar o desactivar registros.',
    exportar: 'Permite descargar información.',
    importar: 'Permite cargar información desde archivos.',
    anular: 'Permite anular operaciones registradas.'
  }[String(nombre).toLowerCase()] || 'Permite realizar esta acción en la pantalla.');
  
  selectorRol.addEventListener('change', async event => {
    const roleId = Number(event.target.value);
    const box = document.getElementById('matriz-permisos');
    resumenPermisos.hidden = true;
    buscadorPermisos.disabled = !roleId;
    buscadorPermisos.value = '';
    if (!roleId) {
      box.innerHTML = '<div class="permisos-empty"><strong>Configura el acceso de cada rol</strong><p>Selecciona un rol para ver sus módulos y permisos.</p></div>';
      estadoPermiso('Aún no has seleccionado un rol.');
      return;
    }
    box.innerHTML = '<div class="permisos-empty"><strong>Cargando permisos...</strong><p>Estamos consultando la configuración del rol.</p></div>';
    estadoPermiso('Consultando permisos del rol...');
    const [{data: enlaces,error:e1},{data: filas,error:e2}] = await Promise.all([
      supabase.from('r_modulo_rol').select('id,modulo_id,habilitado').eq('rol_id',roleId),
      supabase.from('vistas_permiso').select('id,r_modulo_rol_id,vista_id,permiso_id,permitido')
    ]);
    if (e1 || e2) {
      box.textContent = 'No se pudieron cargar los permisos: ' + (e1?.message || e2?.message);
      estadoPermiso('No se pudo cargar la configuración.', true);
      return;
    }
    const enlacePorModulo = new Map((enlaces||[]).map(x=>[x.modulo_id,x]));
    const rowByKey = new Map((filas||[]).map(x=>[`${x.r_modulo_rol_id}:${x.vista_id}:${x.permiso_id}`,x]));
    let totalPermitidos = (filas||[]).filter(row => {
      const relation = (enlaces||[]).find(link => link.id === row.r_modulo_rol_id);
      return relation && relation.habilitado && row.permitido;
    }).length;
    const totalAsignables = modulos.reduce((sum,m) => {
      const count = vistas.filter(v=>v.modulo_id===m.id).length * permisos.length;
      return sum + (enlacePorModulo.has(m.id) ? count : 0);
    },0);
    resumenPermisos.hidden = false;
    resumenPermisos.innerHTML = `
      <article><strong>${enlaces?.filter(x=>x.habilitado).length || 0}</strong><span>Módulos habilitados</span></article>
      <article><strong>${totalPermitidos}</strong><span>Permisos concedidos</span></article>
      <article><strong>${Math.max(0,totalAsignables-totalPermitidos)}</strong><span>Permisos no concedidos</span></article>`;
    const iconoEstado = habilitado => habilitado
      ? '<span class="permiso-status activo">Habilitado</span>'
      : '<span class="permiso-status inactivo">Deshabilitado</span>';
    box.innerHTML = modulos.map((m,index) => {
      const enlace = enlacePorModulo.get(m.id);
      const views = vistas.filter(v=>v.modulo_id===m.id);
      if (!views.length) return '';
      if (!enlace) return `<article class="permiso-modulo permiso-sin-enlace"><div><strong>${escapeHtml(m.nombre_modulo)}</strong><p>Este rol aún no tiene una asignación para este módulo.</p></div></article>`;
      const activeCount = views.reduce((sum,v) => sum + permisos.filter(p => rowByKey.get(`${enlace.id}:${v.id}:${p.id}`)?.permitido).length,0);
      return `
        <details class="permiso-modulo" data-permiso-modulo open="${index===0 ? 'open' : ''}">
          <summary class="permiso-modulo-cabecera">
            <span class="permiso-modulo-identidad"><span class="permiso-modulo-icon">${icono('key')}</span><span><strong>${escapeHtml(m.nombre_modulo)}</strong><small>${views.length} pantalla(s) · <span data-module-count="${m.id}">${activeCount}</span> permisos activos</small></span></span>
            <span class="permiso-modulo-controles"><span data-module-status="${m.id}">${iconoEstado(enlace.habilitado)}</span><label class="switch-permiso" title="Habilitar o deshabilitar este módulo"><input type="checkbox" data-module-id="${enlace.id}" ${enlace.habilitado?'checked':''}><span></span></label></span>
          </summary>
          <div class="permiso-modulo-cuerpo">
            ${views.map(v => {
              const rows = permisos.map(p => ({p,row:rowByKey.get(`${enlace.id}:${v.id}:${p.id}`)})).filter(x=>x.row);
              const enabled = rows.filter(x=>x.row.permitido).length;
              return `
                <section class="permiso-pantalla" data-permiso-pantalla>
                  <div class="permiso-pantalla-cabecera"><div><strong>${escapeHtml(v.nombre_vista)}</strong><small>${escapeHtml(v.ruta_acceso)}</small></div>
                    <button type="button" class="btn-texto" data-toggle-view="${v.id}" data-link-id="${enlace.id}" title="Activar o quitar todos los permisos de esta pantalla">${enabled===rows.length && rows.length ? 'Quitar todos' : 'Permitir todos'}</button>
                  </div>
                  <div class="permiso-opciones">
                    ${rows.map(({p,row}) => `
                      <label class="permiso-opcion ${row.permitido?'seleccionado':''}" title="${escapeHtml(descripcionPermiso(p.nombre_permiso))}">
                        <input type="checkbox" data-permission-id="${row.id}" data-module="${m.id}" data-view="${v.id}" ${row.permitido?'checked':''}>
                        <span class="permiso-check"></span><span><strong>${escapeHtml(etiquetaPermiso(p.nombre_permiso))}</strong><small>${escapeHtml(descripcionPermiso(p.nombre_permiso))}</small></span>
                      </label>`).join('')}
                  </div>
                </section>`;
            }).join('')}
          </div>
        </details>`;
    }).join('') || '<div class="permisos-empty"><strong>No hay pantallas configuradas</strong><p>Este rol no tiene vistas asociadas.</p></div>';
    estadoPermiso('Los permisos se guardan automáticamente al cambiar una opción.');
    
    const actualizarResumen = () => {
      const checks = [...box.querySelectorAll('[data-permission-id]')];
      totalPermitidos = checks.filter(input => input.checked).length;
      resumenPermisos.querySelector('article:nth-child(2) strong').textContent = totalPermitidos;
      resumenPermisos.querySelector('article:nth-child(3) strong').textContent = Math.max(0,totalAsignables-totalPermitidos);
      modulos.forEach(m => {
        const count = box.querySelectorAll(`[data-module="${m.id}"]:checked`).length;
        const node = box.querySelector(`[data-module-count="${m.id}"]`);
        if (node) node.textContent = count;
      });
    };
    const guardarPermiso = async input => {
      const nuevoValor = input.checked;
      const anterior = !nuevoValor;
      input.disabled = true;
      const {error} = await supabase.from('vistas_permiso').update({permitido:nuevoValor}).eq('id',Number(input.dataset.permissionId));
      input.disabled = false;
      if (error) {
        input.checked = anterior;
        input.closest('.permiso-opcion')?.classList.toggle('seleccionado',anterior);
        estadoPermiso('No se pudo guardar el permiso: '+error.message,true);
      } else {
        input.closest('.permiso-opcion')?.classList.toggle('seleccionado',nuevoValor);
        estadoPermiso('Permiso guardado correctamente.');
      }
      actualizarResumen();
    };
    box.querySelectorAll('[data-module-id]').forEach(input => {
      input.addEventListener('click', event => event.stopPropagation());
      input.addEventListener('change', async () => {
      const valor = input.checked;
      input.disabled = true;
      const {error} = await supabase.from('r_modulo_rol').update({habilitado:valor}).eq('id',Number(input.dataset.moduleId));
      input.disabled = false;
      if (error) {
        input.checked = !valor;
        estadoPermiso('No se pudo cambiar el módulo: '+error.message,true);
      } else {
        estadoPermiso(valor ? 'Módulo habilitado.' : 'Módulo deshabilitado. Sus permisos se conservan, pero no estarán disponibles mientras permanezca apagado.');
        const moduleId = Number(modulos.find(m => enlacePorModulo.get(m.id)?.id === Number(input.dataset.moduleId))?.id);
        const node = box.querySelector(`[data-module-status="${moduleId}"]`);
        if (node) node.innerHTML = iconoEstado(valor);
        actualizarResumen();
      }
      });
    });
    box.querySelectorAll('[data-permission-id]').forEach(input => input.addEventListener('change', () => guardarPermiso(input)));
    box.querySelectorAll('[data-toggle-view]').forEach(button => button.addEventListener('click', async () => {
      const viewId = Number(button.dataset.toggleView);
      const linkId = Number(button.dataset.linkId);
      const inputs = [...box.querySelectorAll(`[data-view="${viewId}"]`)];
      const shouldEnable = inputs.some(input=>!input.checked);
      const previous = inputs.map(input=>input.checked);
      inputs.forEach(input => { input.checked=shouldEnable; input.closest('.permiso-opcion')?.classList.toggle('seleccionado',shouldEnable); });
      button.disabled = true;
      const results = await Promise.all(inputs.map(input => supabase.from('vistas_permiso').update({permitido:shouldEnable}).eq('id',Number(input.dataset.permissionId))));
      button.disabled = false;
      const failed = results.find(result=>result.error);
      if (failed) {
        inputs.forEach((input,i) => { input.checked=previous[i]; input.closest('.permiso-opcion')?.classList.toggle('seleccionado',previous[i]); });
        estadoPermiso('No se pudieron guardar todos los permisos: '+failed.error.message,true);
      } else estadoPermiso(shouldEnable ? 'Se habilitaron los permisos de esta pantalla.' : 'Se quitaron los permisos de esta pantalla.');
      button.textContent = shouldEnable ? 'Quitar todos' : 'Permitir todos';
      actualizarResumen();
    }));
  });
  buscadorPermisos.addEventListener('input', () => {
    const query = buscadorPermisos.value.trim().toLocaleLowerCase('es');
    const matrix = document.getElementById('matriz-permisos');
    matrix.querySelectorAll('.permiso-modulo').forEach(card => {
      card.hidden = query && !card.textContent.toLocaleLowerCase('es').includes(query);
      if (query && !card.hidden) card.open = true;
    });
  });
}
