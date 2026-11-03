import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply({ error: "Falta configuración interna de Supabase" }, 500);
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return reply({ error: "Sesión requerida" }, 401);
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply({ error: "Sesión no válida" }, 401);
  const { data: allowed, error: permissionError } = await caller.rpc("puede_crear_usuarios");
  if (permissionError || allowed !== true) return reply({ error: "No tienes permiso para crear usuarios" }, 403);
  let body: { nombre?: string; email?: string; role_ids?: number[] };
  try { body = await req.json(); } catch { return reply({ error: "Solicitud JSON inválida" }, 400); }
  const nombre = String(body.nombre || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const roleIds = Array.isArray(body.role_ids) ? [...new Set(body.role_ids.map(Number).filter(Number.isInteger))] : [];
  if (nombre.length < 2 || nombre.length > 100) return reply({ error: "El nombre debe tener entre 2 y 100 caracteres" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Correo electrónico no válido" }, 400);
  if (!roleIds.length) return reply({ error: "Selecciona al menos un rol" }, 400);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: roles, error: rolesError } = await admin.from("rol").select("id").in("id", roleIds);
  if (rolesError || !roles || roles.length !== roleIds.length) return reply({ error: "Uno o más roles seleccionados no existen" }, 400);
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, { data: { nombre } });
  if (inviteError || !invited.user) return reply({ error: inviteError?.message || "No se pudo enviar la invitación" }, 400);
  const authUserId = invited.user.id;
  const { data: userRow, error: userError } = await admin.from("usuario").insert({ nombre, email, auth_user_id: authUserId, activo: true }).select("id").single();
  if (userError || !userRow) {
    await admin.auth.admin.deleteUser(authUserId);
    return reply({ error: "No se pudo crear el perfil del inventario: " + (userError?.message || "error desconocido") }, 500);
  }
  const { error: assignmentError } = await admin.from("r_usuario_rol").insert(roleIds.map(rol_id => ({ usuario_id: userRow.id, rol_id })));
  if (assignmentError) {
    await admin.from("usuario").delete().eq("id", userRow.id);
    await admin.auth.admin.deleteUser(authUserId);
    return reply({ error: "No se pudieron asignar los roles: " + assignmentError.message }, 500);
  }
  return reply({ success: true, message: "Invitación enviada y usuario creado.", usuario_id: userRow.id });
});