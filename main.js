/* ============================================
   SISTEMA DE INVENTARIO - MOTO REPUESTOS PAPI BETO
   ============================================
   Punto de entrada principal de la aplicación.
   
   Orquesta la autenticación y el dashboard:
   - Si no hay sesión → muestra Login
   - Si hay sesión → carga el Dashboard con el rol del usuario
   ============================================ */

import './style.css';

import { getSession, getUserProfile, logout, onAuthStateChange } from './src/auth.js';
import { isSupabaseConfigured } from './src/supabaseClient.js';
import { renderizarLogin, renderizarPantallaConfiguracion } from './src/loginUI.js';
import { renderizarDashboard } from './src/dashboardUI.js';

let cargandoDashboard = false;

/**
 * Función principal que inicializa la aplicación.
 * Verifica si Supabase está configurado, si hay una sesión activa y enruta al componente correcto.
 */
async function inicializarApp() {
  console.log('🏍️ MotoRepuestos — Iniciando aplicación...');

  // Si Supabase todavía no está configurado, mostrar la pantalla clara de configuración
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase no está configurado. Mostrando pantalla de configuración requerida...');
    renderizarPantallaConfiguracion();
    return;
  }

  // Verificar si hay una sesión activa
  const { session } = await getSession();

  if (session) {
    await cargarDashboard();
  } else {
    cargarLogin();
  }

  // Escuchar cambios de autenticación (login/logout desde otras pestañas)
  onAuthStateChange(async (event, session) => {
    console.log('🔄 Auth event:', event);

    if (event === 'SIGNED_IN' && session) {
      await cargarDashboard();
    } else if (event === 'SIGNED_OUT') {
      cargarLogin();
    }
  });
}

/**
 * Carga la pantalla de login.
 */
function cargarLogin() {
  renderizarLogin(async () => {
    await cargarDashboard();
  });
}

/**
 * Carga el dashboard con el perfil del usuario autenticado.
 */
async function cargarDashboard() {
  if (cargandoDashboard) return;
  cargandoDashboard = true;

  try {
    const app = document.querySelector('#app');
    app.innerHTML = '<div class="loading"><p>Cargando sistema...</p></div>';

    const { profile, error } = await getUserProfile();

  if (error || !profile) {
    console.error('Error al cargar perfil de usuario:', error);
    // Mostrar pantalla informativa sin cerrar sesión automáticamente
    // para evitar bucles de redirección o esconder errores de BD
    app.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card" style="max-width: 500px;">
          <div class="login-header">
            <h1>🏍️ MotoRepuestos</h1>
            <p>Sistema de Inventario — Papi Beto</p>
          </div>
          <div class="config-alerta" style="border-left: 4px solid #e53e3e; background: rgba(229, 62, 62, 0.08); padding: 1.25rem; border-radius: 8px; margin: 1.5rem 0; text-align: left;">
            <h3 style="color: #e53e3e; margin-bottom: 0.5rem;">⚠️ Error al Cargar Perfil de Usuario</h3>
            <p style="margin-bottom: 0.75rem; font-size: 0.95rem; word-break: break-word;">${escapeHtml(error || 'No se pudo obtener el perfil del usuario.')}</p>
            <p style="font-size: 0.85rem; color: #718096; margin: 0;">
              Tu sesión en Supabase Auth está activa, pero no se pudo consultar el registro correspondiente en la tabla <code>usuario</code> o su rol en <code>r_usuario_rol</code>.
            </p>
          </div>
          <div style="display: flex; gap: 0.75rem; justify-content: center; margin-top: 1.5rem;">
            <button class="btn btn-principal" id="btn-reintentar-perfil">
              🔄 Reintentar
            </button>
            <button class="btn btn-cancelar" id="btn-logout-error">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-reintentar-perfil')?.addEventListener('click', async () => {
      await cargarDashboard();
    });

    document.getElementById('btn-logout-error')?.addEventListener('click', async () => {
      await logout();
      cargarLogin();
    });
    return;
  }

  if (!profile.activo) {
    app.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <h2>🚫 Cuenta Desactivada</h2>
          <p>Tu cuenta ha sido desactivada en el sistema. Contacta al administrador.</p>
          <button class="btn btn-principal" id="btn-logout-inactive">Cerrar Sesión</button>
        </div>
      </div>
    `;
    document.getElementById('btn-logout-inactive').addEventListener('click', async () => {
      await logout();
      cargarLogin();
    });
    return;
  }

  console.log(`✅ Sesión activa: ${profile.nombre} (${profile.rol})`);

  renderizarDashboard(profile, async () => {
    await logout();
    cargarLogin();
  });
  } finally {
    cargandoDashboard = false;
  }
}

function escapeHtml(texto) {
  if (!texto) return '';
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', inicializarApp);
