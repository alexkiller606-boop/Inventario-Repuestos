/* ============================================
   CLIENTE SUPABASE — Conexión a la base de datos
   ============================================
   Este módulo crea y exporta la instancia del cliente
   de Supabase que se usa en toda la aplicación.
   
   Las credenciales se leen de variables de entorno
   (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY)
   que Vite inyecta durante el build.
   
   NOTA: La "anon key" es PÚBLICA y segura para usar
   en el frontend. La seguridad real la proveen las
   políticas RLS configuradas en la base de datos.
   ============================================ */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Verifica si el cliente está correctamente configurado con credenciales válidas.
 * @returns {boolean}
 */
export function isSupabaseConfigured() {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.trim() !== '' &&
    supabaseAnonKey.trim() !== '' &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
    !supabaseUrl.includes('TU-PROYECTO')
  );
}

/**
 * Proporciona el estado detallado de cada variable de entorno requerida.
 * @returns {{hasUrl: boolean, hasKey: boolean}}
 */
export function getConfigStatus() {
  const hasUrl = Boolean(
    supabaseUrl &&
    supabaseUrl.trim() !== '' &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
    !supabaseUrl.includes('TU-PROYECTO')
  );
  const hasKey = Boolean(
    supabaseAnonKey &&
    supabaseAnonKey.trim() !== '' &&
    !supabaseAnonKey.includes('TU_CLAVE')
  );
  return { hasUrl, hasKey };
}

// Advertir en consola si las credenciales están ausentes
if (!isSupabaseConfigured()) {
  console.warn(
    '⚠️ Faltan las credenciales de Supabase o no están configuradas en .env.\n' +
    '   Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env.\n' +
    '   La interfaz mostrará la pantalla de configuración guiada.'
  );
}

/**
 * Cliente Supabase configurado.
 * Se exporta como singleton si está configurado, o null si faltan credenciales,
 * evitando que la aplicación lance el error "supabaseUrl is required" en tiempo de carga.
 */
export const supabase = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
