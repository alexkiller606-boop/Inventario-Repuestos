-- Migración incremental: RBAC dinámico para Moto Repuestos Papi Beto
-- Ejecutar sobre el esquema público ya existente. No elimina datos.

begin;

alter table public.vistas add column if not exists modulo_id integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname='fk_vistas_modulo') then
    alter table public.vistas add constraint fk_vistas_modulo
      foreign key (modulo_id) references public.modulo(id) on update cascade on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname='uq_r_modulo_rol_rol_modulo') then
    alter table public.r_modulo_rol add constraint uq_r_modulo_rol_rol_modulo unique (rol_id,modulo_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='uq_r_usuario_rol_usuario_rol') then
    alter table public.r_usuario_rol add constraint uq_r_usuario_rol_usuario_rol unique (usuario_id,rol_id);
  end if;
  if not exists (select 1 from pg_constraint where conname='uq_vistas_permiso_asignacion') then
    alter table public.vistas_permiso add constraint uq_vistas_permiso_asignacion unique (r_modulo_rol_id,vista_id,permiso_id);
  end if;
end $$;

update public.modulo set nombre_modulo='Usuarios',
 descripcion='Gestión de usuarios y cuentas del sistema', icono='👤'
where nombre_modulo='Seguridad';

insert into public.modulo(nombre_modulo,descripcion,icono,orden) values
 ('Movimientos','Entradas, salidas y ajustes de inventario','🔄',3),
 ('Compras','Registro e historial de compras a proveedores','🧾',7),
 ('Roles y permisos','Administración de roles y permisos de acceso','🔐',10),
 ('Configuración','Parámetros generales del sistema','⚙️',12)
on conflict (nombre_modulo) do nothing;

update public.modulo set orden=case nombre_modulo
 when 'Dashboard' then 1 when 'Inventario' then 2 when 'Movimientos' then 3
 when 'Ventas' then 4 when 'Clientes' then 5 when 'Proveedores' then 6
 when 'Compras' then 7 when 'Reportes' then 8 when 'Usuarios' then 9
 when 'Roles y permisos' then 10 when 'Auditoría' then 11
 when 'Configuración' then 12 else orden end;

insert into public.vistas(nombre_vista,ruta_acceso,descripcion) values
 ('Entradas de Inventario','/movimientos/entradas','Registro de entradas de productos'),
 ('Salidas de Inventario','/movimientos/salidas','Registro de salidas de productos'),
 ('Ajustes de Inventario','/movimientos/ajustes','Ajustes manuales de existencias'),
 ('Registro de Compras','/compras/nueva','Registro de compras a proveedores'),
 ('Historial de Compras','/compras/historial','Consulta del historial de compras'),
 ('Configuración General','/configuracion','Parámetros generales del sistema')
on conflict (ruta_acceso) do nothing;

update public.vistas vi set modulo_id=m.id from public.modulo m where
 (vi.ruta_acceso='/dashboard' and m.nombre_modulo='Dashboard')
 or (vi.ruta_acceso like '/inventario/%' and m.nombre_modulo='Inventario')
 or (vi.ruta_acceso like '/movimientos/%' and m.nombre_modulo='Movimientos')
 or (vi.ruta_acceso like '/ventas/%' and m.nombre_modulo='Ventas')
 or (vi.ruta_acceso='/clientes' and m.nombre_modulo='Clientes')
 or (vi.ruta_acceso='/proveedores' and m.nombre_modulo='Proveedores')
 or (vi.ruta_acceso like '/compras/%' and m.nombre_modulo='Compras')
 or (vi.ruta_acceso like '/reportes/%' and m.nombre_modulo='Reportes')
 or (vi.ruta_acceso='/seguridad/usuarios' and m.nombre_modulo='Usuarios')
 or (vi.ruta_acceso='/seguridad/roles' and m.nombre_modulo='Roles y permisos')
 or (vi.ruta_acceso='/auditoria/logs' and m.nombre_modulo='Auditoría')
 or (vi.ruta_acceso='/configuracion' and m.nombre_modulo='Configuración');

insert into public.r_modulo_rol(rol_id,modulo_id,habilitado)
select r.id,m.id,true from public.rol r cross join public.modulo m
on conflict (rol_id,modulo_id) do nothing;

insert into public.vistas_permiso(r_modulo_rol_id,vista_id,permiso_id,permitido)
select mr.id,vi.id,pe.id,false from public.r_modulo_rol mr
join public.vistas vi on vi.modulo_id=mr.modulo_id
cross join public.permisos pe
on conflict (r_modulo_rol_id,vista_id,permiso_id) do nothing;

-- Los privilegios del Administrador se guardan como permisos explícitos.
update public.vistas_permiso vp set permitido=true
from public.r_modulo_rol mr join public.rol r on r.id=mr.rol_id
where vp.r_modulo_rol_id=mr.id and r.nombre_rol='Administrador';

create or replace function private.tiene_permiso(p_ruta text,p_accion text)
returns boolean language sql stable security definer set search_path to ''
as $$
 select exists (
  select 1 from public.usuario u
  join public.r_usuario_rol ur on ur.usuario_id=u.id
  join public.r_modulo_rol mr on mr.rol_id=ur.rol_id and mr.habilitado
  join public.vistas vi on vi.ruta_acceso=p_ruta and vi.modulo_id=mr.modulo_id
  join public.vistas_permiso vp on vp.r_modulo_rol_id=mr.id and vp.vista_id=vi.id and vp.permitido
  join public.permisos pe on pe.id=vp.permiso_id and pe.nombre_permiso=p_accion
  where u.auth_user_id=(select auth.uid()) and u.activo=true
 );
$$;

create or replace function private.obtener_contexto_usuario()
returns jsonb language sql stable security definer set search_path to ''
as $$
 select jsonb_build_object(
  'id',u.id,'nombre',u.nombre,'email',u.email,'activo',u.activo,'auth_user_id',u.auth_user_id,
  'roles',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nombre',r.nombre_rol,'descripcion',r.descripcion) order by r.id)
    from public.r_usuario_rol ur join public.rol r on r.id=ur.rol_id where ur.usuario_id=u.id),'[]'::jsonb),
  'permisos',coalesce((select jsonb_agg(distinct jsonb_build_object('ruta',vi.ruta_acceso,'accion',pe.nombre_permiso))
    from public.r_usuario_rol ur join public.r_modulo_rol mr on mr.rol_id=ur.rol_id and mr.habilitado
    join public.vistas vi on vi.modulo_id=mr.modulo_id
    join public.vistas_permiso vp on vp.r_modulo_rol_id=mr.id and vp.vista_id=vi.id and vp.permitido
    join public.permisos pe on pe.id=vp.permiso_id where ur.usuario_id=u.id),'[]'::jsonb)
 ) from public.usuario u where u.auth_user_id=(select auth.uid()) limit 1;
$$;
revoke all on function private.obtener_contexto_usuario() from public,anon;
grant execute on function private.obtener_contexto_usuario() to authenticated;

create or replace function public.obtener_contexto_usuario()
returns jsonb language sql stable security invoker set search_path to ''
as $$ select private.obtener_contexto_usuario(); $$;
revoke all on function public.obtener_contexto_usuario() from public,anon;
grant execute on function public.obtener_contexto_usuario() to authenticated;

create or replace function private.registrar_auditoria(
 p_accion text,p_tabla text,p_registro_id integer default null,
 p_datos_anteriores jsonb default null,p_datos_nuevos jsonb default null
) returns void language plpgsql security definer set search_path to ''
as $$
declare v_usuario_id integer; v_ruta text; v_permiso text;
begin
 if (select auth.uid()) is null then raise exception 'Debes iniciar sesión'; end if;
 select u.id into v_usuario_id from public.usuario u
 where u.auth_user_id=(select auth.uid()) and u.activo=true;
 if v_usuario_id is null then raise exception 'Usuario inactivo o sin perfil vinculado'; end if;
 v_ruta:=case lower(p_tabla)
  when 'productos' then '/inventario/productos'
  when 'categorias' then '/inventario/productos'
  when 'clientes' then '/clientes'
  when 'proveedores' then '/proveedores'
  when 'ventas' then '/ventas/nueva' else null end;
 v_permiso:=case upper(p_accion)
  when 'INSERT' then 'crear' when 'UPDATE' then 'actualizar'
  when 'DELETE' then 'eliminar' when 'DELETE (SOFT)' then 'eliminar' else null end;
 if v_ruta is null or v_permiso is null or not private.tiene_permiso(v_ruta,v_permiso) then
  raise exception 'No tienes permiso para registrar esta acción de auditoría';
 end if;
 insert into public.auditoria_logs(usuario_id,accion,tabla_afectada,registro_id,datos_anteriores,datos_nuevos,fecha_hora)
 values(v_usuario_id,p_accion,p_tabla,p_registro_id,p_datos_anteriores,p_datos_nuevos,now());
end;
$$;
revoke all on function private.registrar_auditoria(text,text,integer,jsonb,jsonb) from public,anon;
grant execute on function private.registrar_auditoria(text,text,integer,jsonb,jsonb) to authenticated;

drop policy if exists auditoria_insert on public.auditoria_logs;
create policy auditoria_insert on public.auditoria_logs for insert to authenticated with check(false);

commit;
