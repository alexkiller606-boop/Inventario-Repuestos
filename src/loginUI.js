/* ============================================
   COMPONENTE: Pantalla de Login y Configuración
   ============================================ */

import { login } from './auth.js';
import { isSupabaseConfigured, getConfigStatus } from './supabaseClient.js';

/**
 * Renderiza una pantalla clara en español indicando qué configuración falta
 * para conectar la aplicación con Supabase.
 */
export function renderizarPantallaConfiguracion() {
  const app = document.querySelector('#app');
  const status = getConfigStatus();

  app.innerHTML = `
    <div class="login-wrapper">
      <div class="config-card">
        <div class="login-header">
          <h1>🏍️ MotoRepuestos</h1>
          <p>Sistema de Inventario — Papi Beto</p>
        </div>

        <div class="config-alerta">
          <h2>⚠️ Configuración de Supabase Pendiente</h2>
          <p>
            La aplicación no puede conectarse a la base de datos porque aún no se han configurado
            las credenciales en el archivo <code>.env</code>.
          </p>

          <div class="config-estado">
            <div class="config-item">
              <span class="config-var-name">VITE_SUPABASE_URL</span>
              <span class="badge ${status.hasUrl ? 'badge-ok' : 'badge-faltante'}">
                ${status.hasUrl ? '✓ Configurado' : '✗ Falta configurar'}
              </span>
            </div>
            <div class="config-item">
              <span class="config-var-name">VITE_SUPABASE_ANON_KEY</span>
              <span class="badge ${status.hasKey ? 'badge-ok' : 'badge-faltante'}">
                ${status.hasKey ? '✓ Configurado' : '✗ Falta configurar'}
              </span>
            </div>
          </div>
        </div>

        <div class="config-pasos">
          <h3>Pasos para conectar Supabase:</h3>
          <ol>
            <li>
              <strong>Abre tu proyecto en Supabase:</strong> Ingresa a
              <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" class="link-externo">
                supabase.com/dashboard
              </a> y selecciona tu proyecto.
            </li>
            <li>
              <strong>Copia tus credenciales API:</strong> En el menú lateral izquierdo ve a
              <strong>Project Settings</strong> (icono de engranaje) ➔ <strong>API</strong>.
            </li>
            <li>
              <strong>Edita el archivo <code>.env</code>:</strong> En la carpeta raíz del proyecto, abre el archivo <code>.env</code> y pega tu URL y tu clave anónima pública:
              <pre class="config-codigo"><code>VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-aqui</code></pre>
            </li>
            <li>
              <strong>Reinicia el servidor:</strong> Si estás ejecutando el servidor de desarrollo en la terminal, reinícialo con <code>npm run dev</code> para que Vite recargue las variables de entorno, y luego pulsa el botón de abajo.
            </li>
          </ol>
        </div>

        <div class="config-nota">
          🔒 <strong>Seguridad:</strong> Usa únicamente la clave <code>anon</code> (pública). Nunca agregues la clave <code>service_role</code> en el frontend.
        </div>

        <div class="config-acciones">
          <button id="btn-reintentar" class="btn btn-principal">
            🔄 Recargar y verificar conexión
          </button>
        </div>

        <div class="login-footer">
          <p>© ${new Date().getFullYear()} Moto Repuestos Papi Beto</p>
        </div>
      </div>
    </div>
  `;

  const btnReintentar = document.getElementById('btn-reintentar');
  if (btnReintentar) {
    btnReintentar.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

/**
 * Renderiza la pantalla de login en el contenedor #app.
 * Si Supabase no está configurado, muestra la pantalla de configuración pendiente.
 * @param {function} onLoginSuccess - Callback cuando el login es exitoso
 */
export function renderizarLogin(onLoginSuccess) {
  if (!isSupabaseConfigured()) {
    renderizarPantallaConfiguracion();
    return;
  }

  const app = document.querySelector('#app');

  app.innerHTML = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="login-header">
          <h1>🏍️ MotoRepuestos</h1>
          <p>Sistema de Inventario — Papi Beto</p>
        </div>

        <form id="form-login" class="login-form">
          <div class="form-group">
            <label for="login-email">Correo electrónico</label>
            <input
              type="email"
              id="login-email"
              name="email"
              placeholder="admin@motorepuestos.com"
              required
              autocomplete="email"
            />
          </div>

          <div class="form-group">
            <label for="login-password">Contraseña</label>
            <input
              type="password"
              id="login-password"
              name="password"
              placeholder="Tu contraseña"
              required
              autocomplete="current-password"
              minlength="6"
            />
          </div>

          <button type="submit" class="btn btn-principal" id="btn-login">
            Iniciar Sesión
          </button>

          <div id="login-mensaje" class="mensaje"></div>
        </form>

        <div class="login-footer">
          <p>© ${new Date().getFullYear()} Moto Repuestos Papi Beto</p>
        </div>
      </div>
    </div>
  `;

  // Manejar el envío del formulario
  const form = document.getElementById('form-login');
  const btnLogin = document.getElementById('btn-login');
  const mensaje = document.getElementById('login-mensaje');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      mostrarMensajeLogin(mensaje, 'Completa todos los campos', 'error');
      return;
    }

    // Deshabilitar botón mientras se procesa
    btnLogin.disabled = true;
    btnLogin.textContent = 'Verificando...';

    const { user, error } = await login(email, password);

    if (error) {
      mostrarMensajeLogin(mensaje, error, 'error');
      btnLogin.disabled = false;
      btnLogin.textContent = 'Iniciar Sesión';
      return;
    }

    mostrarMensajeLogin(mensaje, '✅ Acceso concedido. Cargando...', 'exito');

    // Pequeña pausa para que el usuario vea el mensaje
    setTimeout(() => {
      if (onLoginSuccess) onLoginSuccess(user);
    }, 500);
  });
}

/**
 * Muestra un mensaje en el formulario de login.
 */
function mostrarMensajeLogin(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = `mensaje ${tipo}`;

  if (tipo === 'exito') {
    setTimeout(() => { elemento.className = 'mensaje'; }, 5000);
  }
}

