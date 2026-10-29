/* ============================================
   MÓDULO DE AUTENTICACIÓN
   ============================================
   Maneja inicio/cierre de sesión y verificación
   de sesión activa usando Supabase Auth.
   ============================================ */

import { supabase } from './supabaseClient.js';

/**
 * Inicia sesión con email y contraseña.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function login(email, password) {
  if (!supabase) {
    return { user: null, error: 'Supabase no está configurado. Revisa tu archivo .env.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { user: null, error: traducirError(error.message) };
  }

  return { user: data.user, error: null };
}

/**
 * Cierra la sesión del usuario actual.
 * @returns {Promise<{error: string|null}>}
 */
export async function logout() {
  if (!supabase) {
    return { error: null };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: traducirError(error.message) };
  }
  return { error: null };
}

/**
 * Obtiene la sesión actual (si existe).
 * @returns {Promise<{session: object|null}>}
 */
export async function getSession() {
  if (!supabase) {
    return { session: null };
  }

  const { data } = await supabase.auth.getSession();
  return { session: data?.session || null };
}

/**
 * Obtiene el usuario autenticado actual.
 * @returns {Promise<{user: object|null}>}
 */
export async function getUser() {
  if (!supabase) {
    return { user: null };
  }

  const { data } = await supabase.auth.getUser();
  return { user: data?.user || null };
}

/**
 * Obtiene el perfil completo del usuario (con nombre y rol).
 * @returns {Promise<{profile: object|null, error: string|null}>}
 */
export async function getUserProfile() {
  if (!supabase) {
    return { profile: null, error: 'Supabase no está configurado' };
  }

  const { user } = await getUser();
  if (!user) return { profile: null, error: 'No hay sesión activa' };

  let usuario = null;
  let queryError = null;

  // Intento 1: Consulta anidada con r_usuario_rol y rol
  const { data: usuarioRel, error: errorRel } = await supabase
    .from('usuario')
    .select(`
      id,
      nombre,
      email,
      activo,
      auth_user_id,
      r_usuario_rol (
        rol_id,
        rol (
          id,
          nombre_rol,
          descripcion
        )
      )
    `)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (errorRel) {
    console.warn('Consulta anidada en tabla usuario falló, intentando consulta directa:', errorRel.message);
    const { data: usuarioDirect, error: errorDirect } = await supabase
      .from('usuario')
      .select('id, nombre, email, activo, auth_user_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    usuario = usuarioDirect;
    queryError = errorDirect;
  } else {
    usuario = usuarioRel;
  }

  if (queryError) {
    console.error('Error al consultar tabla usuario:', queryError);
    return {
      profile: null,
      error: `Error al consultar la tabla usuario: ${queryError.message}`,
    };
  }

  if (!usuario) {
    console.error('No se encontró registro en usuario para auth_user_id:', user.id, 'email:', user.email);
    return {
      profile: null,
      error: `No existe un perfil en la tabla "usuario" vinculado al usuario autenticado (${user.email || user.id}).`,
    };
  }

  // Verificar si el usuario está activo
  if (!usuario.activo) {
    return {
      profile: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        activo: false,
        auth_user_id: usuario.auth_user_id || user.id,
        user_id: user.id,
        rol: null,
        rol_descripcion: '',
      },
      error: null,
    };
  }

  // Obtener rol a través de r_usuario_rol y rol
  let rolNombre = null;
  let rolDescripcion = '';
  let rolId = null;

  // 1. Extraer si vino en la relación anidada
  const asignaciones = Array.isArray(usuario.r_usuario_rol)
    ? usuario.r_usuario_rol
    : (usuario.r_usuario_rol ? [usuario.r_usuario_rol] : []);

  if (asignaciones.length > 0) {
    const primera = asignaciones[0];
    rolId = primera.rol_id;
    const rolObj = Array.isArray(primera.rol) ? primera.rol[0] : primera.rol;
    if (rolObj && rolObj.nombre_rol) {
      rolNombre = rolObj.nombre_rol;
      rolDescripcion = rolObj.descripcion || '';
    }
  }

  // 2. Si no se resolvió en la consulta anidada, consultar r_usuario_rol y rol explícitamente
  if (!rolNombre) {
    const { data: rurData, error: rurError } = await supabase
      .from('r_usuario_rol')
      .select('rol_id')
      .eq('usuario_id', usuario.id)
      .limit(1);

    if (rurError) {
      console.error('Error al consultar r_usuario_rol:', rurError);
      return {
        profile: null,
        error: `Error al consultar rol del usuario en r_usuario_rol: ${rurError.message}`,
      };
    }

    if (!rurData || rurData.length === 0) {
      console.error('El usuario no tiene registro en r_usuario_rol:', { usuario_id: usuario.id });
      return {
        profile: null,
        error: `El usuario "${usuario.nombre}" no tiene ningún rol asignado en la tabla r_usuario_rol.`,
      };
    }

    rolId = rurData[0].rol_id;
    const { data: rolData, error: rolError } = await supabase
      .from('rol')
      .select('id, nombre_rol, descripcion')
      .eq('id', rolId)
      .maybeSingle();

    if (rolError) {
      console.error('Error al consultar tabla rol:', rolError);
      return {
        profile: null,
        error: `Error al consultar el rol (id: ${rolId}): ${rolError.message}`,
      };
    }

    if (!rolData) {
      console.error('Rol no encontrado en tabla rol para rol_id:', rolId);
      return {
        profile: null,
        error: `El rol con ID ${rolId} asignado al usuario no existe en la tabla rol.`,
      };
    }

    rolNombre = rolData.nombre_rol;
    rolDescripcion = rolData.descripcion || '';
  }

  if (!rolNombre) {
    return {
      profile: null,
      error: `No se pudo determinar el rol para el usuario "${usuario.nombre}".`,
    };
  }

  return {
    profile: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      activo: Boolean(usuario.activo),
      auth_user_id: usuario.auth_user_id || user.id,
      user_id: user.id,
      rol_id: rolId,
      rol: rolNombre, // Conserva el rol real (ej. "Administrador")
      rol_descripcion: rolDescripcion,
    },
    error: null,
  };
}

/**
 * Escucha cambios en el estado de autenticación.
 * @param {function} callback - Recibe (event, session)
 * @returns {object} Subscription (llamar .unsubscribe() para limpiar)
 */
export function onAuthStateChange(callback) {
  if (!supabase) {
    return { unsubscribe: () => {} };
  }

  const { data } = supabase.auth.onAuthStateChange(callback);
  return data?.subscription || { unsubscribe: () => {} };
}

/**
 * Verifica si el usuario tiene uno de los roles indicados.
 * @param {string[]} rolesPermitidos - Ej: ['administrador', 'almacenista']
 * @returns {Promise<boolean>}
 */
export async function tieneRol(rolesPermitidos) {
  const { profile } = await getUserProfile();
  if (!profile || !profile.activo || !profile.rol) return false;
  const userRolLower = profile.rol.toLowerCase().trim();
  const permitidosLower = rolesPermitidos.map(r => r.toLowerCase().trim());
  return permitidosLower.includes(userRolLower);
}

/**
 * Traduce mensajes de error de Supabase al español.
 * @param {string} msg
 * @returns {string}
 */
function traducirError(msg) {
  const traducciones = {
    'Invalid login credentials': 'Correo o contraseña incorrectos',
    'Email not confirmed': 'Debes confirmar tu correo electrónico',
    'User already registered': 'Este correo ya está registrado',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    'User not found': 'Usuario no encontrado',
    'Invalid email': 'Correo electrónico no válido',
  };
  return traducciones[msg] || msg;
}
