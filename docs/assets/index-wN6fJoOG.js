(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))n(a);new MutationObserver(a=>{for(const r of a)if(r.type==="childList")for(const c of r.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&n(c)}).observe(document,{childList:!0,subtree:!0});function e(a){const r={};return a.integrity&&(r.integrity=a.integrity),a.referrerPolicy&&(r.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?r.credentials="include":a.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(a){if(a.ep)return;a.ep=!0;const r=e(a);fetch(a.href,r)}})();const h="repuestos_motos";let i=[],v=!1,u=null,m=null;function d(){const t=localStorage.getItem(h);return t?JSON.parse(t):[]}function y(t){localStorage.setItem(h,JSON.stringify(t))}function L(){return Date.now().toString(36)+Math.random().toString(36).substr(2)}function S(t){const o={id:L(),codigo:t.codigo,nombre:t.nombre,marca:t.marca,cantidad:parseInt(t.cantidad),precio:parseFloat(t.precio),fechaCreacion:new Date().toISOString()},e=d();return e.push(o),y(e),o}function f(){return d()}function R(t,o){const e=d(),n=e.findIndex(a=>a.id===t);return n!==-1?(e[n]={...e[n],codigo:o.codigo,nombre:o.nombre,marca:o.marca,cantidad:parseInt(o.cantidad),precio:parseFloat(o.precio),fechaActualizacion:new Date().toISOString()},y(e),e[n]):null}function A(t){const o=d(),e=o.filter(n=>n.id!==t);return e.length!==o.length?(y(e),!0):!1}function C(t){const o=d(),e=t.toLowerCase().trim();return o.filter(n=>n.codigo.toLowerCase().includes(e)||n.nombre.toLowerCase().includes(e))}function j(){document.querySelector("#app").innerHTML=`
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
  `}function b(){const t=d();document.getElementById("stat-total").textContent=t.length;const o=t.reduce((a,r)=>a+r.cantidad*r.precio,0);document.getElementById("stat-valor").textContent=I(o);const e=t.filter(a=>a.cantidad<5).length;document.getElementById("stat-bajo").textContent=e;const n=new Set(t.map(a=>a.marca.toLowerCase()));document.getElementById("stat-marcas").textContent=n.size}function l(t){const o=document.getElementById("tabla-body");if(t.length===0){o.innerHTML=`
      <tr class="sin-datos">
        <td colspan="6">
          No hay repuestos registrados. Agregue uno nuevo usando el formulario.
        </td>
      </tr>
    `;return}o.innerHTML=t.map(e=>`
    <tr>
      <td><strong>${p(e.codigo)}</strong></td>
      <td>${p(e.nombre)}</td>
      <td>${p(e.marca)}</td>
      <td>
        <span style="color: ${e.cantidad<5?"var(--color-error)":"var(--color-exito)"}">
          ${e.cantidad}
        </span>
      </td>
      <td>${I(e.precio)}</td>
      <td class="acciones">
        <button class="btn btn-editar" data-id="${e.id}" data-accion="editar">
          Editar
        </button>
        <button class="btn btn-eliminar" data-id="${e.id}" data-accion="eliminar">
          Eliminar
        </button>
      </td>
    </tr>
  `).join("")}function I(t){return"$"+t.toFixed(2).replace(/\d(?=(\d{3})+\.)/g,"$&,")}function p(t){const o=document.createElement("div");return o.textContent=t,o.innerHTML}function s(t,o){const e=document.getElementById("mensaje");e.textContent=t,e.className=`mensaje ${o}`,setTimeout(()=>{e.className="mensaje"},3e3)}function B(){document.getElementById("codigo").value="",document.getElementById("nombre").value="",document.getElementById("marca").value="",document.getElementById("cantidad").value="",document.getElementById("precio").value=""}function x(t){document.getElementById("codigo").value=t.codigo,document.getElementById("nombre").value=t.nombre,document.getElementById("marca").value=t.marca,document.getElementById("cantidad").value=t.cantidad,document.getElementById("precio").value=t.precio,v=!0,u=t.id,document.getElementById("titulo-form").textContent="Editar Repuesto",document.getElementById("form-buttons").style.display="none",document.getElementById("edit-buttons").style.display="flex"}function E(){v=!1,u=null,B(),document.getElementById("titulo-form").textContent="Agregar Repuesto",document.getElementById("form-buttons").style.display="block",document.getElementById("edit-buttons").style.display="none"}function O(t){m=t,document.getElementById("modal-confirmar").classList.add("activo")}function g(){m=null,document.getElementById("modal-confirmar").classList.remove("activo")}function M(){document.getElementById("form-repuesto").addEventListener("submit",o=>{o.preventDefault();const e={codigo:document.getElementById("codigo").value.trim(),nombre:document.getElementById("nombre").value.trim(),marca:document.getElementById("marca").value.trim(),cantidad:document.getElementById("cantidad").value,precio:document.getElementById("precio").value};if(!e.codigo||!e.nombre||!e.marca||!e.cantidad||!e.precio){s("Por favor complete todos los campos","error");return}v&&u?R(u,e)?(s("Repuesto actualizado correctamente","exito"),E()):s("Error al actualizar el repuesto","error"):(S(e),s("Repuesto agregado correctamente","exito"),B()),i=f(),l(i),b()}),document.getElementById("btn-cancelar").addEventListener("click",E),document.getElementById("buscador").addEventListener("input",o=>{const e=o.target.value;if(e.trim()==="")l(i);else{const n=C(e);l(n)}}),document.getElementById("tabla-body").addEventListener("click",o=>{const e=o.target;if(e.dataset.accion&&e.dataset.id){const n=e.dataset.accion,a=e.dataset.id;if(n==="editar"){const r=i.find(c=>c.id===a);r&&(x(r),document.querySelector(".card").scrollIntoView({behavior:"smooth"}))}else n==="eliminar"&&O(a)}}),document.getElementById("btn-confirmar-eliminar").addEventListener("click",()=>{m&&(A(m),i=f(),l(i),b(),s("Repuesto eliminado correctamente","exito"),g())}),document.getElementById("btn-cancelar-eliminar").addEventListener("click",g),document.getElementById("modal-confirmar").addEventListener("click",o=>{o.target.id==="modal-confirmar"&&g()})}function T(){j(),i=f(),l(i),b(),M(),console.log("✅ Sistema de Inventario iniciado correctamente"),console.log(`📦 ${i.length} repuestos cargados desde localStorage`)}document.addEventListener("DOMContentLoaded",T);
