# Follow Me Supabase

## Servicios Usados

- Auth para registro e inicio de sesion.
- PostgreSQL con PostGIS.
- Realtime Broadcast para ubicacion en vivo.
- Row Level Security para privacidad.
- Storage en version 1.1 para fotos.

## Tablas MVP

- `profiles`
- `friend_requests`
- `friends`
- `trips`
- `trip_participants`
- `location_updates`
- `alerts`

## Realtime MVP

- Canal `trip:{tripId}:locations` para ubicaciones.
- Canal `trip:{tripId}:presence` para conexion/desconexion.
- Persistencia de ubicaciones cada 60 segundos.

## Privacidad

- Solo participantes pueden ver ubicaciones del viaje.
- Solo el lider puede modificar estado del viaje.
- La ubicacion solo se comparte durante viajes activos.

## Version 1.1

- Tabla `photos`.
- Bucket `photos`.
- Politicas Storage.
- Tabla `route_waypoints`.
