import { supabase } from './supabaseClient.js';

export async function login(email, password) {
  if (!supabase) return { user: null, error: 'Supabase no está configurado. Revisa tu archivo .env.' };
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return error ? { user: null, error: traducirError(error.message) } : { user: data.user, error: null };
}

export async function logout() {
  if (!supabase) return { error: null };
  const { error } = await supabase.auth.signOut();
  return { error: error ? traducirError(error.message) : null };
}

export async function getSession() {
  if (!supabase) return { session: null };
  const { data } = await supabase.auth.getSession();
  return { session: data?.session || null };
}

export async function getUser() {
  if (!supabase) return { user: null };
  const { data } = await supabase.auth.getUser();
  return { user: data?.user || null };
}

/** Recupera los roles y permisos efectivos de TODOS los roles del usuario. */
export async function getUserProfile() {
  if (!supabase) return { profile: null, error: 'Supabase no está configurado' };
  const { user } = await getUser();
  if (!user) return { profile: null, error: 'No hay sesión activa' };

  const { data, error } = await supabase.rpc('obtener_contexto_usuario');
  if (error) return { profile: null, error: 'No se pudo cargar el perfil y sus permisos: ' + error.message };
  if (!data) return { profile: null, error: 'No existe un perfil vinculado a esta cuenta en la tabla usuario.' };

  const roles = Array.isArray(data.roles) ? data.roles : [];
  const permisos = Array.isArray(data.permisos) ? data.permisos : [];
  if (!data.activo) {
    return { profile: { ...data, user_id: user.id, roles, permisos, rol: roles[0]?.nombre || null, activo: false }, error: null };
  }
  if (!roles.length) return { profile: null, error: 'El usuario no tiene ningún rol asignado.' };

  return {
    profile: {
      ...data,
      user_id: user.id,
      roles,
      permisos,
      rol_id: roles[0]?.id ?? null,
      rol: roles[0]?.nombre ?? null,
      rol_descripcion: roles[0]?.descripcion ?? '',
      roles_nombres: roles.map(r => r.nombre),
    },
    error: null,
  };
}

export function tienePermisoEnPerfil(profile, ruta, accion = 'leer') {
  if (!profile?.activo) return false;
  return (profile.permisos || []).some(p => p.ruta === ruta && p.accion === accion);
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data?.subscription || { unsubscribe: () => {} };
}

export async function tieneRol(rolesPermitidos) {
  const { profile } = await getUserProfile();
  if (!profile?.activo) return false;
  const permitidos = new Set((rolesPermitidos || []).map(r => String(r).toLowerCase().trim()));
  return (profile.roles || []).some(r => permitidos.has(String(r.nombre).toLowerCase().trim()));
}

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
