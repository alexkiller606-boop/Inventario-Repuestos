import { supabase } from './supabaseClient.js';

const acciones = ['crear','leer','actualizar','eliminar','exportar','importar','anular'];
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
      <h2>Roles y permisos</h2>
      <p>Crea roles personalizados, asigna varios roles a cada usuario y define permisos por pantalla y acción.</p>
      <div class="card">
        <h3>Crear un rol</h3>
        <form id="form-nuevo-rol" class="form-row">
          <div class="form-group"><label for="nuevo-rol-nombre">Nombre</label><input id="nuevo-rol-nombre" required maxlength="60" placeholder="Ej. Supervisor"></div>
          <div class="form-group"><label for="nuevo-rol-descripcion">Descripción</label><input id="nuevo-rol-descripcion" maxlength="180" placeholder="Responsabilidades del rol"></div>
          <button class="btn btn-principal" type="submit">Crear rol</button>
        </form>
        <div id="seguridad-mensaje" class="mensaje" aria-live="polite"></div>
      </div>
      <div class="card">
        <h3>Crear cuenta de usuario</h3>
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
      <div class="card">
        <h3>Asignar roles a un usuario</h3>
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
      <div class="card">
        <h3>Configurar permisos</h3>
        <div class="form-group"><label for="rol-permisos">Rol que deseas configurar</label>
          <select id="rol-permisos"><option value="">Selecciona un rol</option>
            ${roles.map(r => `<option value="${r.id}">${escapeHtml(r.nombre_rol)}</option>`).join('')}
          </select>
        </div>
        <div id="matriz-permisos"><p>Selecciona un rol para cargar su matriz de permisos.</p></div>
      </div>
    </section>
  `;

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

  document.getElementById('rol-permisos').addEventListener('change', async event => {
    const roleId = Number(event.target.value);
    const box = document.getElementById('matriz-permisos');
    if (!roleId) { box.innerHTML='<p>Selecciona un rol.</p>'; return; }
    const {data: enlaces,error:e1} = await supabase.from('r_modulo_rol').select('id,modulo_id,habilitado').eq('rol_id',roleId);
    if (e1) { box.textContent=e1.message; return; }
    const {data: filas,error:e2} = await supabase.from('vistas_permiso').select('id,r_modulo_rol_id,vista_id,permiso_id,permitido');
    if (e2) { box.textContent=e2.message; return; }
    const enlacePorModulo = new Map((enlaces||[]).map(x=>[x.modulo_id,x.id]));
    const rowByKey = new Map((filas||[]).map(x=>[`${x.r_modulo_rol_id}:${x.vista_id}:${x.permiso_id}`,x]));
    box.innerHTML = modulos.map(m => {
      const assignmentId = enlacePorModulo.get(m.id);
      const views = vistas.filter(v=>v.modulo_id===m.id);
      if (!views.length) return '';
      return `<div class="seguridad-modulo"><h4>${escapeHtml(m.nombre_modulo)} <label class="seguridad-modulo-toggle"><input type="checkbox" data-module-id="${assignmentId}" ${enlaces.find(x=>x.id===assignmentId)?.habilitado ? "checked" : ""}> Módulo habilitado</label></h4>${views.map(v => `
        <div class="seguridad-vista"><strong>${escapeHtml(v.nombre_vista)}</strong><span class="seguridad-ruta">${escapeHtml(v.ruta_acceso)}</span>
          <div class="seguridad-acciones">${permisos.map(p => {
            const row = rowByKey.get(`${assignmentId}:${v.id}:${p.id}`);
            return row ? `<label><input type="checkbox" data-permission-id="${row.id}" ${row.permitido?'checked':''}> ${escapeHtml(p.nombre_permiso)}</label>` : '';
          }).join('')}</div>
        </div>`).join('')}</div>`;
    }).join('') || '<p>No hay vistas asociadas a este rol.</p>';
    box.querySelectorAll('[data-module-id]').forEach(input => input.addEventListener('change', async () => {
      input.disabled = true;
      const {error} = await supabase.from('r_modulo_rol').update({habilitado:input.checked}).eq('id',Number(input.dataset.moduleId));
      input.disabled = false;
      if (error) { input.checked=!input.checked; mensaje('No se pudo cambiar el módulo: '+error.message,true); }
      else mensaje('Módulo actualizado.');
    }));
    box.querySelectorAll('[data-permission-id]').forEach(input => input.addEventListener('change', async () => {
      input.disabled = true;
      const {error} = await supabase.from('vistas_permiso').update({permitido:input.checked}).eq('id',Number(input.dataset.permissionId));
      input.disabled = false;
      if (error) { input.checked=!input.checked; mensaje('No se pudo guardar el permiso: '+error.message,true); }
      else mensaje('Permiso actualizado.');
    }));
  });
}
