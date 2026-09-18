-- Ejecutar desde SQL Editor con tu cuenta de propietario del proyecto.
-- Primero crea el usuario desde Authentication -> Users.
-- Reemplaza SOLO el correo de ejemplo; puedes repetir el proceso para otra cuenta.
do $$
declare target uuid;
begin
 select id into target from auth.users where lower(email)=lower('javi-nicolas@hotmail.com');
 if target is null then raise exception 'No existe esa cuenta. Créala en Authentication y verifica el correo escrito aquí.'; end if;
 insert into public.admin_users(user_id) values(target) on conflict do nothing;
end $$;
-- Para revocar acceso (ejecuta solo si lo necesitas):
-- delete from public.admin_users where user_id=(select id from auth.users where email='correo-a-revocar@ejemplo.com');
