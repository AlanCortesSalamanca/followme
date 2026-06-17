# 🚗 FollowMe — Documento de Arquitectura Completo

> **Versión:** 1.0  
> **Fecha:** Junio 2026  
> **Estado:** Borrador de arquitectura  

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura General](#2-arquitectura-general)
3. [Modelo de Datos](#3-modelo-de-datos)
4. [Estructura del Frontend React Native](#4-estructura-del-frontend)
5. [Flujo de Datos en Tiempo Real](#5-flujo-de-datos-en-tiempo-real)
6. [Sistema de Alertas](#6-sistema-de-alertas)
7. [Almacenamiento de Fotos Geolocalizadas](#7-almacenamiento-de-fotos)
8. [Modelo de Monetización](#8-modelo-de-monetización)
9. [Seguridad y RLS](#9-seguridad)
10. [Navegación y Screens](#10-navegación)
11. [Recomendación de Nombre](#11-nombre-final)
12. [Decisiones de Arquitectura (ADRs)](#12-adrs)

---

## 1. Resumen Ejecutivo

**FollowMe** es una aplicación móvil diseñada para grupos de personas que viajan en caravana con sus propios vehículos. El objetivo principal es permitir que todos los miembros del grupo se vean en tiempo real en un mapa compartido, con alertas inteligentes de desvíos y alejamientos.

### Principios Arquitectónicos

| Principio | Aplicación |
|-----------|-----------|
| **Offline-first** | Las ubicaciones se cachean localmente y se sincronizan cuando hay conectividad |
| **Tiempo real** | Las ubicaciones se comparten con latencia < 2s en modo premium |
| **Privacidad por diseño** | RLS en todas las tablas, datos mínimos expuestos |
| **Escalabilidad horizontal** | Supabase escala automáticamente, Realtime usa broadcast cuando es posible |
| **Costo eficiente** | Arquitectura híbrida broadcast + persistencia batch para minimizar writes en BD |

---

## 2. Arquitectura General

### 2.1 Diagrama de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTE (React Native / Expo)                  │
│                                                                         │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐  ┌────────────┐           │
│  │MapLibre GL│  │ Supabase │  │RevenueCat │  │ Google     │           │
│  │ (Mapa)    │  │ Client   │  │ SDK       │  │ AdMob      │           │
│  └───────────┘  └──────────┘  └───────────┘  └────────────┘           │
│       │              │              │              │                   │
└───────┼──────────────┼──────────────┼──────────────┼───────────────────┘
        │              │              │              │
        │              │              │              │
┌───────┼──────────────┼──────────────┼──────────────┼───────────────────┐
│       │              │              │              │                   │
│  ▼    │         ▼    │         ▼    │         ▼    │                   │
│  ┌────────┐  ┌───────────┐  ┌──────────┐  ┌──────────┐               │
│  │Tile    │  │ Supabase  │  │RevenueCat│  │ Google   │               │
│  │Server  │  │ Backend   │  │ API      │  │ AdMob    │               │
│  │(MapLibre│  │           │  │          │  │ API      │               │
│  │ o Maptiler│ ┌─────────┐│  └──────────┘  └──────────┘               │
│  │)       │  │PostgreSQL││                                            │
│  └────────┘  │(PostGIS) ││    ┌──────────────┐                        │
│              ├─────────┤│    │   Edge        │                        │
│              │Realtime ││    │   Functions   │                        │
│              │(Broadcast││    │  (Deno/TS)   │                        │
│              │ + DB)   ││    └──────┬───────┘                        │
│              ├─────────┤│           │                                │
│              │Auth     ││           │                                │
│              ├─────────┤│           ▼                                │
│              │Storage  ││    ┌──────────────┐                        │
│              │(S3)     ││    │   APIs Ext   │                        │
│              └─────────┘│    │ - TomTom     │                        │
│                          │    │ - OpenRoute  │                        │
│                          │    │ - Weather    │                        │
│                          │    └──────────────┘                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Tecnológico Detallado

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Frontend** | React Native 0.76+ con Expo SDK 52+ | Una base de código para iOS y Android |
| **Navegación** | Expo Router (file-based routing) | Routing moderno, deep linking nativo |
| **Mapas** | MapLibre GL Native (`@maplibre/maplibre-react-native`) | Open source, sin costos de licencia por mapa |
| **Tile Server** | Maptiler **o** self-hosted con OpenMapTiles | Gratis hasta cierto volumen, después auto-host |
| **Backend** | Supabase (Plan Pro o Team) | BaaS completo: DB, Auth, Realtime, Storage, Edge Functions |
| **Base de Datos** | PostgreSQL 15 + PostGIS 3.4 | Geolocalización nativa, índices espaciales |
| **Tiempo Real** | Supabase Realtime (Broadcast + DB Changes) | WebSocket nativo, integración con PostgreSQL |
| **Auth** | Supabase Auth (Google OAuth + Apple OAuth) | Integración directa con Supabase |
| **Pagos** | RevenueCat SDK (cross-platform) | Manejo de suscripciones en iOS y Android |
| **Anuncios** | Google AdMob / Expo Ads | Monetización freemium |
| **Fotos** | Supabase Storage (S3-compatible) | Almacenamiento escalable de imágenes |
| **Edge Functions** | Supabase Edge Functions (Deno/TypeScript) | Lógica serverless para alertas y procesamiento |
| **APIs Externas** | TomTom Traffic / OpenRouteService / OSRM | Datos de tráfico, routing, geocoding |
| **Geocoding** | Nominatim (OpenStreetMap) | Gratuito, con rate limiting |

### 2.3 Patrones de Comunicación

```
┌─────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Cliente A   │◄──────►│  Supabase        │◄──────►│  Cliente B   │
│  (Conductor) │        │  Realtime Channel │        │ (Pasajero)   │
│              │        │  trip:{id}        │        │              │
└─────────────┘        └──────────────────┘        └──────────────┘

Canales:
──────────
  • trip:{tripId}:locations  → Broadcast de posiciones en tiempo real
  • trip:{tripId}:alerts     → Alertas del sistema
  • trip:{tripId}:chat       → Mensajes del viaje (futuro)
  • user:{userId}:notif      → Notificaciones personales
```

---

## 3. Modelo de Datos

### 3.1 Diagrama Entidad-Relación (Texto)

```
profiles ──1:N──> trips
profiles ──1:N──> trip_participants
trips ────1:N──> trip_participants
trips ────1:N──> location_updates
trips ────1:N──> route_waypoints
trips ────1:N──> photos
trips ────1:N──> alerts
trips ────1:N──> trip_invites

profiles ──M:N──> profiles  (a través de friends)
profiles ──1:N──> friend_requests (sender)
profiles ──1:N──> friend_requests (receiver)

profiles ──1:1──> subscriptions
```

### 3.2 Esquema Completo de Base de Datos

#### 3.2.1 Tabla: `profiles`

```sql
CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT,
  display_name      TEXT NOT NULL CHECK (char_length(display_name) >= 2),
  avatar_url        TEXT,
  phone_number      TEXT,
  bio               TEXT DEFAULT '',
  subscription_tier TEXT NOT NULL DEFAULT 'free'
                    CHECK (subscription_tier IN ('free', 'premium', 'family')),
  is_onboarded      BOOLEAN DEFAULT FALSE,
  location_sharing  BOOLEAN DEFAULT TRUE,
  notification_token TEXT,           -- Expo Push Token
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_display_name ON profiles(display_name);
```

#### 3.2.2 Tabla: `friends`

```sql
CREATE TABLE friends (
  user_id_1   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id_2   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'accepted'
              CHECK (status IN ('accepted', 'blocked')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id_1, user_id_2),
  CHECK (user_id_1 < user_id_2)
);

-- Índice para búsqueda rápida de amigos
CREATE INDEX idx_friends_user1 ON friends(user_id_1) WHERE status = 'accepted';
CREATE INDEX idx_friends_user2 ON friends(user_id_2) WHERE status = 'accepted';
```

#### 3.2.3 Tabla: `friend_requests`

```sql
CREATE TABLE friend_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  message     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sender_id, receiver_id)
);

CREATE INDEX idx_friend_requests_receiver ON friend_requests(receiver_id, status);
```

#### 3.2.4 Tabla: `trips`

```sql
CREATE TABLE trips (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (char_length(title) >= 3),
  description      TEXT DEFAULT '',
  
  -- Geografía del viaje
  origin           GEOGRAPHY(POINT, 4326),
  destination      GEOGRAPHY(POINT, 4326),
  route_geometry   GEOGRAPHY(LINESTRING, 4326),  -- Ruta planeada (opcional)
  
  -- Centro del grupo calculado en tiempo real
  group_center     GEOGRAPHY(POINT, 4326),
  
  -- Configuración
  is_public        BOOLEAN DEFAULT FALSE,
  invite_code      TEXT NOT NULL UNIQUE DEFAULT nanoid(8),
  max_participants INTEGER DEFAULT 20 CHECK (max_participants BETWEEN 2 AND 100),
  
  -- Alertas
  max_distance     INTEGER DEFAULT 1000,    -- metros antes de alertar (default 1km)
  deviation_meters INTEGER DEFAULT 200,      -- metros de desvío antes de alertar
  
  -- Estado
  status           TEXT NOT NULL DEFAULT 'planned'
                   CHECK (status IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_trips_creator ON trips(creator_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_invite_code ON trips(invite_code) WHERE status IN ('planned', 'active');
CREATE INDEX idx_trips_is_public ON trips(is_public) WHERE status = 'active';

-- Índice espacial
CREATE INDEX idx_trips_origin ON trips USING GIST(origin);
CREATE INDEX idx_trips_destination ON trips USING GIST(destination);
CREATE INDEX idx_trips_route ON trips USING GIST(route_geometry);
```

#### 3.2.5 Tabla: `trip_participants`

```sql
CREATE TABLE trip_participants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member'
             CHECK (role IN ('leader', 'member', 'navigator')),
  nickname   TEXT,                           -- alias dentro del viaje
  color      TEXT DEFAULT '#3B82F6',         -- color del marcador en el mapa
  is_muted   BOOLEAN DEFAULT FALSE,          -- silenciar alertas de este usuario
  joined_at  TIMESTAMPTZ DEFAULT NOW(),
  left_at    TIMESTAMPTZ,
  UNIQUE (trip_id, user_id)
);

CREATE INDEX idx_trip_participants_trip ON trip_participants(trip_id);
CREATE INDEX idx_trip_participants_user ON trip_participants(user_id);
```

#### 3.2.6 Tabla: `location_updates` (CORAZÓN DEL SISTEMA)

```sql
-- Esta tabla recibe escrituras PERIÓDICAS (cada ~30s).
-- Las actualizaciones en tiempo real usan Supabase Realtime BROADCAST.
CREATE TABLE location_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location      GEOGRAPHY(POINT, 4326) NOT NULL,
  accuracy      REAL,                         -- metros
  speed         REAL,                         -- m/s
  bearing       REAL,                         -- grados (0=N, 90=E)
  altitude      REAL,                         -- metros
  battery_level REAL CHECK (battery_level BETWEEN 0 AND 100),
  is_moving     BOOLEAN DEFAULT TRUE,
  recorded_at   TIMESTAMPTZ NOT NULL,         -- timestamp del dispositivo
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Índices críticos para performance
CREATE INDEX idx_location_updates_trip_time 
  ON location_updates(trip_id, recorded_at DESC);
CREATE INDEX idx_location_updates_user_trip 
  ON location_updates(user_id, trip_id);
  
-- Índice espacial
CREATE INDEX idx_location_updates_loc 
  ON location_updates USING GIST(location);

-- Particionamiento por mes (opcional, para alta escala)
-- CREATE TABLE location_updates_y2026m06 PARTITION OF location_updates
--   FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
```

#### 3.2.7 Tabla: `route_waypoints`

```sql
CREATE TABLE route_waypoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location    GEOGRAPHY(POINT, 4326) NOT NULL,
  name        TEXT,                         -- nombre opcional del waypoint
  type        TEXT DEFAULT 'stop'
              CHECK (type IN ('stop', 'waypoint', 'start', 'end', 'photo_spot', 'alert')),
  order_index INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (trip_id, order_index)
);

CREATE INDEX idx_route_waypoints_trip ON route_waypoints(trip_id, order_index);
```

#### 3.2.8 Tabla: `photos`

```sql
CREATE TABLE photos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       UUID REFERENCES trips(id) ON DELETE SET NULL,
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location      GEOGRAPHY(POINT, 4326) NOT NULL,
  
  -- Almacenamiento
  storage_path  TEXT NOT NULL,              -- Ruta en Supabase Storage
  thumbnail_path TEXT,
  blurhash      TEXT,                       -- Placeholder mientras carga
  
  -- Metadatos
  caption       TEXT DEFAULT '',
  is_shared     BOOLEAN DEFAULT FALSE,      -- Compartida con el viaje
  is_premium    BOOLEAN DEFAULT FALSE,      -- Solo visible para premium
  width         INTEGER,
  height        INTEGER,
  file_size     INTEGER,                    -- bytes
  
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_photos_trip ON photos(trip_id) WHERE is_shared = TRUE;
CREATE INDEX idx_photos_user ON photos(user_id);
CREATE INDEX idx_photos_location ON photos USING GIST(location)
  WHERE is_shared = TRUE;
```

#### 3.2.9 Tabla: `alerts`

```sql
CREATE TABLE alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                  CHECK (type IN (
                    'distance_exceeded',    -- alguien se alejó del grupo
                    'deviation_detected',   -- alguien se desvió de la ruta
                    'traffic_warning',      -- tráfico en la ruta
                    'road_closure',         -- cierre de carretera
                    'weather_alert',        -- condiciones climáticas
                    'speed_warning',        -- exceso de velocidad
                    'group_halt',           -- el grupo se detuvo
                    'participant_left',     -- alguien abandonó
                    'participant_joined',   -- alguien se unió
                    'battery_low',          -- batería baja
                    'custom'               -- alerta personalizada del líder
                  )),
  severity        TEXT NOT NULL DEFAULT 'warning'
                  CHECK (severity IN ('info', 'warning', 'critical')),
  
  -- ¿A quién afecta?
  subject_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  location        GEOGRAPHY(POINT, 4326),  -- ubicación del evento
  message         TEXT NOT NULL,
  data            JSONB DEFAULT '{}',       -- datos adicionales (velocidad, distancia, etc.)
  
  is_read         BOOLEAN DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_trip ON alerts(trip_id, created_at DESC);
CREATE INDEX idx_alerts_user ON alerts(subject_user_id) WHERE resolved_at IS NULL;
CREATE INDEX idx_alerts_type ON alerts(type) WHERE resolved_at IS NULL;
```

#### 3.2.10 Tabla: `subscriptions`

```sql
CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  revenuecat_id       TEXT NOT NULL UNIQUE,
  platform            TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  product_id          TEXT NOT NULL,        -- ID del producto en RevenueCat
  
  plan_type           TEXT NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'family_monthly', 'family_yearly')),
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'cancelled', 'expired', 'grace_period', 'trial')),
  
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end   TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

#### 3.2.11 Tabla: `trip_invites`

```sql
CREATE TABLE trip_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id     UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  invited_by  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,  -- NULL si es por código
  invite_code TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trip_invites_trip ON trip_invites(trip_id);
CREATE INDEX idx_trip_invites_code ON trip_invites(invite_code);
```

#### 3.2.12 Tabla: `saved_routes`

```sql
-- Los usuarios pueden guardar rutas favoritas / viajes anteriores
CREATE TABLE saved_routes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  origin        GEOGRAPHY(POINT, 4326),
  destination   GEOGRAPHY(POINT, 4326),
  waypoints     JSONB DEFAULT '[]',          -- array de {lat, lng, name}
  distance_km   REAL,
  duration_min  INTEGER,
  source_trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  is_favorite   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_routes_user ON saved_routes(user_id);
```

### 3.3 Funciones PostgreSQL Clave

#### 3.3.1 Calcular centro del grupo

```sql
CREATE OR REPLACE FUNCTION calculate_group_center(trip_uuid UUID)
RETURNS GEOGRAPHY(POINT, 4326)
LANGUAGE SQL STABLE
AS $$
  SELECT ST_Centroid(ST_Collect(location))::GEOGRAPHY(POINT, 4326)
  FROM location_updates
  WHERE trip_id = trip_uuid
    AND recorded_at > NOW() - INTERVAL '2 minutes'
$$;
```

#### 3.3.2 Detectar alejamiento del grupo

```sql
CREATE OR REPLACE FUNCTION check_distance_alert(
  trip_uuid UUID,
  user_uuid UUID,
  user_location GEOGRAPHY(POINT, 4326),
  threshold_meters INTEGER
) RETURNS TABLE(is_alert BOOLEAN, distance_meters REAL)
LANGUAGE SQL STABLE
AS $$
  WITH group_center AS (
    SELECT ST_Centroid(ST_Collect(location)) AS center
    FROM location_updates
    WHERE trip_id = trip_uuid
      AND user_id != user_uuid
      AND recorded_at > NOW() - INTERVAL '2 minutes'
  )
  SELECT 
    ST_Distance(user_location, center) > threshold_meters,
    ST_Distance(user_location, center)::REAL
  FROM group_center
  WHERE center IS NOT NULL;
$$;
```

#### 3.3.3 Detectar desvío de ruta

```sql
CREATE OR REPLACE FUNCTION check_deviation_alert(
  user_location GEOGRAPHY(POINT, 4326),
  route_geom GEOGRAPHY(LINESTRING, 4326),
  threshold_meters INTEGER
) RETURNS TABLE(is_alert BOOLEAN, distance_meters REAL)
LANGUAGE SQL STABLE
AS $$
  SELECT
    ST_Distance(user_location, route_geom) > threshold_meters,
    ST_Distance(user_location, route_geom)::REAL
  WHERE route_geom IS NOT NULL;
$$;
```

#### 3.3.4 Trigger para actualizar `updated_at`

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplicar a tablas relevantes
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_friend_requests_updated_at
  BEFORE UPDATE ON friend_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3.4 PostGIS: Consideraciones Especiales

```sql
-- 1. Habilitar PostGIS (ya habilitado en Supabase)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- para gen_random_uuid()

-- 2. Función nanoid para códigos de invitación
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 8)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(
    substring('abcdefghijklmnopqrstuvwxyz0123456789' 
              FROM (floor(random() * 36)::int + 1) FOR 1), 
    ''
  ) FROM generate_series(1, size);
$$;
```

**Buenas prácticas PostGIS para FollowMe:**

| Operación | Frecuencia | Índice usado |
|-----------|-----------|-------------|
| `ST_DWithin(location, center, radius)` | Cada alerta | GIST |
| `ST_Distance(location, route)` | Cada alerta de desvío | GIST |
| `ST_Centroid(ST_Collect(locations))` | Cada ~30s | GIST |
| `ST_Within(location, polygon)` | Geocercas | GIST |
| `ST_ClusterDBSCAN` | Futuro: agrupar viajeros | - |

---

## 4. Estructura del Frontend

### 4.1 Árbol de directorios

```
followme-app/
├── app/                          # Expo Router (file-based)
│   ├── _layout.tsx               # Root layout (providers, fonts)
│   ├── index.tsx                 # Pantalla de Splash / Redirección
│   ├── (auth)/                   # Grupo de autenticación
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/                   # Grupo principal con tabs
│   │   ├── _layout.tsx           # Tab navigator
│   │   ├── map/                  # Tab: Mapa principal
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Mapa con participantes
│   │   │   ├── trip-settings.tsx # Configuración del viaje activo
│   │   │   └── participant-detail.tsx
│   │   ├── trips/                # Tab: Mis Viajes
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Lista de viajes
│   │   │   ├── create.tsx        # Crear viaje
│   │   │   ├── [id]/             # Detalle de viaje
│   │   │   │   ├── index.tsx
│   │   │   │   ├── participants.tsx
│   │   │   │   └── photos.tsx
│   │   │   └── join.tsx          # Unirse por código
│   │   ├── social/               # Tab: Amigos
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx         # Lista de amigos
│   │   │   ├── add.tsx           # Agregar amigo
│   │   │   └── requests.tsx      # Solicitudes pendientes
│   │   └── profile/              # Tab: Perfil
│   │       ├── _layout.tsx
│   │       ├── index.tsx         # Perfil / Ajustes
│   │       ├── subscription.tsx  # Planes de suscripción
│   │       └── stats.tsx         # Estadísticas personales
│   ├── (modals)/                 # Modales
│   │   ├── take-photo.tsx
│   │   ├── alert-detail.tsx
│   │   └── invite-participants.tsx
│   └── trip/[id]/                # Deep links a viajes
│       └── index.tsx
│
├── src/
│   ├── components/
│   │   ├── map/
│   │   │   ├── MapView.tsx             # Wrapper de MapLibre
│   │   │   ├── UserMarker.tsx          # Marcador de participante
│   │   │   ├── GroupCenterMarker.tsx   # Centro del grupo
│   │   │   ├── PhotoMarker.tsx         # Marcador de foto
│   │   │   ├── AlertMarker.tsx         # Marcador de alerta
│   │   │   ├── RoutePolyline.tsx       # Línea de ruta
│   │   │   ├── DeviationOverlay.tsx    # Corredor de ruta
│   │   │   └── MapControls.tsx         # Botones de control del mapa
│   │   ├── trip/
│   │   │   ├── TripCard.tsx
│   │   │   ├── TripList.tsx
│   │   │   ├── ActiveTripBanner.tsx
│   │   │   ├── ParticipantAvatar.tsx
│   │   │   └── InviteCodeShare.tsx
│   │   ├── social/
│   │   │   ├── FriendCard.tsx
│   │   │   ├── FriendRequestBadge.tsx
│   │   │   └── SearchBar.tsx
│   │   ├── alerts/
│   │   │   ├── AlertBanner.tsx
│   │   │   ├── AlertList.tsx
│   │   │   └── AlertToast.tsx
│   │   ├── photos/
│   │   │   ├── PhotoGrid.tsx
│   │   │   ├── PhotoViewer.tsx
│   │   │   └── CameraButton.tsx
│   │   └── ui/                    # Componentes genéricos
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       ├── Avatar.tsx
│   │       ├── Badge.tsx
│   │       ├── BottomSheet.tsx
│   │       ├── LoadingOverlay.tsx
│   │       └── AdBanner.tsx
│   │
│   ├── hooks/
│   │   ├── useLocationTracking.ts    # Hook principal de GPS
│   │   ├── useRealtimeLocation.ts    # Suscripción Realtime
│   │   ├── useTrip.ts               # Estado del viaje activo
│   │   ├── useAlerts.ts             # Alertas del viaje
│   │   ├── useFriends.ts            # Estado de amigos
│   │   ├── usePhotos.ts             # Fotos del viaje
│   │   ├── useSubscription.ts       # Estado de suscripción
│   │   ├── usePermissions.ts        # Permisos GPS/cámara
│   │   └── useLocationPersistence.ts # Cache de ubicaciones
│   │
│   ├── services/
│   │   ├── supabase/
│   │   │   ├── client.ts            # Cliente Supabase inicializado
│   │   │   ├── auth.ts              # Funciones de autenticación
│   │   │   ├── trips.ts             # CRUD de viajes
│   │   │   ├── locations.ts         # Ubicaciones (batch insert)
│   │   │   ├── photos.ts            # Upload/download de fotos
│   │   │   ├── friends.ts           # Gestión de amigos
│   │   │   └── realtime.ts          # Suscripciones Realtime
│   │   ├── location.ts              # Estrategia de GPS
│   │   ├── notifications.ts         # Push notifications
│   │   ├── revenuecat.ts            # Config RevenueCat
│   │   └── ads.ts                   # Config AdMob
│   │
│   ├── stores/
│   │   ├── useAuthStore.ts          # Zustand: estado de auth
│   │   ├── useTripStore.ts          # Zustand: viaje activo
│   │   ├── useLocationStore.ts      # Zustand: ubicaciones de participantes
│   │   ├── useAlertStore.ts         # Zustand: alertas activas
│   │   └── useSubscriptionStore.ts  # Zustand: suscripción
│   │
│   ├── utils/
│   │   ├── geo.ts                   # Utilidades geográficas
│   │   ├── formatters.ts            # Formatos de fecha/distancia
│   │   ├── constants.ts             # Constantes de la app
│   │   └── permissions.ts           # Helpers de permisos
│   │
│   └── types/
│       ├── database.ts              # Tipos generados de Supabase
│       ├── navigation.ts            # Tipos de navegación
│       ├── location.ts              # Tipos de ubicación
│       ├── trip.ts                  # Tipos de viaje
│       └── alert.ts                 # Tipos de alerta
│
├── assets/
│   ├── images/
│   ├── fonts/
│   └── map-styles/
│       ├── light-style.json        # Estilo de mapa claro
│       └── dark-style.json         # Estilo de mapa oscuro
│
├── supabase/
│   ├── migrations/                 # Migraciones SQL
│   ├── functions/                   # Edge Functions
│   │   ├── check-alerts/
│   │   │   └── index.ts
│   │   ├── batch-location-write/
│   │   │   └── index.ts
│   │   └── geocode-reverse/
│   │       └── index.ts
│   └── seed.sql                    # Datos de prueba
│
├── app.json                        # Expo config
├── supabase-config.ts              # Config de Supabase
├── revenuecat-config.ts            # Config de RevenueCat
├── eas.json                        # Expo EAS Build
└── package.json
```

### 4.2 Árbol de Navegación

```
Root Layout (_layout.tsx)
├── AuthGate (redirige según sesión)
│
├── (auth)                          # No autenticado
│   ├── login
│   ├── register
│   └── onboarding
│
└── (tabs)                          # Autenticado
    ├── map (index)
    │   ├── Trip Settings (modal)
    │   └── Participant Detail (push)
    ├── trips
    │   ├── List (index)
    │   ├── Create
    │   ├── [id]
    │   │   ├── Details
    │   │   ├── Participants
    │   │   └── Photos
    │   └── Join
    ├── social
    │   ├── Friends List
    │   ├── Add Friend
    │   └── Requests
    └── profile
        ├── Settings
        ├── Subscription
        └── Stats

Modales (presentados sobre tabs):
├── Take Photo
├── Alert Detail
└── Invite Participants
```

---

## 5. Flujo de Datos en Tiempo Real

### 5.1 Estrategia Híbrida: Broadcast + Persistencia

El sistema usa dos canales paralelos para optimizar latencia vs. costo:

```
                    ┌─────────────────────────────────────┐
                    │        CLIENTE (React Native)        │
                    │                                       │
                    │  GPS → useLocationTracking()          │
                    │         │                             │
                    │         ├── Cada 2-5s ──────────────┐ │
                    │         │                           │ │
                    │         ▼                           ▼ │
                    │  ┌──────────────┐    ┌──────────────┐│
                    │  │  Realtime    │    │  Batch Queue ││
                    │  │  Broadcast   │    │  (cada 30s)  ││
                    │  └──────┬───────┘    └──────┬───────┘│
                    │         │                   │        │
                    └─────────┼───────────────────┼────────┘
                              │                   │
                              ▼                   ▼
                    ┌─────────────────────────────────────┐
                    │           SUPABASE                    │
                    │                                       │
                    │  Realtime Channel    PostgreSQL       │
                    │  trip:{id}:locations  INSERT batch    │
                    │         │                   │        │
                    │         ▼                   ▼        │
                    │  Broadcast a todos   location_updates │
                    │  los participantes    tabla           │
                    └─────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────────────────────────┐
                    │        OTROS CLIENTES                │
                    │                                       │
                    │  Reciben Broadcast (< 100ms)          │
                    │  Actualizan mapa en vivo              │
                    │                                       │
                    │  Para historial: consultan            │
                    │  location_updates (con delay)         │
                    └─────────────────────────────────────┘
```

### 5.2 Frecuencia de Actualizaciones

| Contexto | Free | Premium | Familia |
|----------|------|---------|---------|
| GPS sampling | Cada 10s | Cada 2s | Cada 2s |
| Broadcast | Cada 10s | Cada 2s | Cada 2s |
| Persistencia batch | Cada 60s | Cada 30s | Cada 30s |
| Historial guardado | 7 días | Ilimitado | Ilimitado |

### 5.3 Implementación del Hook `useLocationTracking`

```typescript
// src/hooks/useLocationTracking.ts
import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { useRealtimeBroadcast } from './useRealtimeLocation';
import { batchInsertLocation } from '../services/supabase/locations';

type LocationConfig = {
  tripId: string;
  userId: string;
  tier: 'free' | 'premium' | 'family';
};

export function useLocationTracking({ tripId, userId, tier }: LocationConfig) {
  const broadcastInterval = tier === 'free' ? 10_000 : 2_000;
  const persistInterval   = tier === 'free' ? 60_000 : 30_000;
  
  const lastLocation = useRef<Location.LocationObject | null>(null);
  const { broadcast } = useRealtimeBroadcast(tripId);
  const batchQueue = useRef<LocationRecord[]>([]);

  // 1. Iniciar GPS
  useEffect(() => {
    const subscription = Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: broadcastInterval,
        distanceInterval: tier === 'premium' ? 10 : 20,
      },
      (location) => {
        lastLocation.current = location;
        
        const record = {
          trip_id: tripId,
          user_id: userId,
          location: `POINT(${location.coords.longitude} ${location.coords.latitude})`,
          accuracy: location.coords.accuracy ?? 0,
          speed: location.coords.speed ?? 0,
          bearing: location.coords.heading ?? 0,
          altitude: location.coords.altitude ?? 0,
          battery_level: getBatteryLevel(), // de expo-device
          recorded_at: new Date().toISOString(),
        };
        
        // 2. Broadcast inmediato (tiempo real)
        broadcast(record);
        
        // 3. Agregar a cola de persistencia
        batchQueue.current.push(record);
      }
    );
    
    return () => subscription.remove();
  }, [tripId, tier]);

  // 4. Persistencia batch periódica
  useEffect(() => {
    const timer = setInterval(async () => {
      if (batchQueue.current.length === 0) return;
      
      const batch = [...batchQueue.current];
      batchQueue.current = [];
      
      try {
        await batchInsertLocation(batch);
      } catch (error) {
        // Fallback: reintentar en próximo ciclo
        batchQueue.current.unshift(...batch);
        console.error('Error persistiendo ubicaciones:', error);
      }
    }, persistInterval);
    
    return () => clearInterval(timer);
  }, [persistInterval]);

  // Última ubicación conocida
  const getLastLocation = useCallback(() => lastLocation.current, []);
  
  return { getLastLocation };
}
```

### 5.4 Suscripción Realtime (Broadcast)

```typescript
// src/services/supabase/realtime.ts
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './client';

type LocationPayload = {
  user_id: string;
  location: string;  // WKT: "POINT(lng lat)"
  speed: number;
  bearing: number;
  recorded_at: string;
};

export function subscribeToTripLocations(
  tripId: string,
  onLocation: (payload: LocationPayload) => void
): RealtimeChannel {
  // Canal de broadcast para ubicaciones en tiempo real
  const channel = supabase.channel(`trip:${tripId}:locations`, {
    config: {
      broadcast: {
        self: true,  // Recibir nuestros propios broadcasts
        ack: false,  // No esperar confirmación
      },
      presence: {
        key: userId,  // Para detectar quién está conectado
      },
    },
  });

  channel
    .on('broadcast', { event: 'location' }, ({ payload }) => {
      onLocation(payload as LocationPayload);
    })
    .subscribe((status) => {
      console.log(`Realtime status: ${status}`);
    });

  return channel;
}

// Función para enviar broadcast
export function broadcastLocation(
  channel: RealtimeChannel,
  payload: LocationPayload
) {
  channel.send({
    type: 'broadcast',
    event: 'location',
    payload,
  });
}
```

### 5.5 Presencia (¿Quién está en línea?)

Supabase Realtime Presence permite detectar participantes activos:

```typescript
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  // state = { userId1: [{ online_at: '...' }], userId2: [...] }
  updateOnlineParticipants(state);
});

channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
  // key = userId, newPresences = array de estados
  showToast(`${key} se conectó`);
});

channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
  // Marcar como "desconectado" en el mapa
  markOffline(key);
});
```

---

## 6. Sistema de Alertas

### 6.1 Arquitectura de Alertas

```
Cliente A                    Supabase                       Cliente B
 (desviado)                                               (líder)
     │                          │                              │
     │  1. Envía ubicación      │                              │
     │ ─────────────────────►   │                              │
     │                          │  2. Edge Function evalúa     │
     │                          │  - ¿Distancia al grupo?     │
     │                          │  - ¿Distancia a la ruta?    │
     │                          │  - ¿Tráfico cercano?        │
     │                          │                              │
     │                          │  3. INSERT en alerts        │
     │                          │  (DB Changes Realtime)      │
     │                          │                              │
     │  ◄─────────── Broadcast de alerta ──────────────────►  │
     │                          │                              │
     │  4. Toast:               │     Toast:                   │
     │  "Te desviaste 300m"     │     "Alice se desvió"       │
     │                          │                              │
```

### 6.2 Edge Function: `check-alerts`

```typescript
// supabase/functions/check-alerts/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LocationPayload {
  trip_id: string;
  user_id: string;
  location: string;   // "POINT(lng lat)"
  speed: number;
  recorded_at: string;
}

serve(async (req) => {
  const { record } = await req.json();  // Trigger de DB
  const data = record as LocationPayload;
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // 1. Obtener datos del viaje
  const { data: trip } = await supabase
    .from('trips')
    .select('route_geometry, max_distance, deviation_meters')
    .eq('id', data.trip_id)
    .single();
  
  if (!trip) return new Response('Trip not found', { status: 404 });
  
  const alerts: Array<Omit<Alert, 'id' | 'created_at'>> = [];
  
  // 2. Verificar alejamiento del grupo
  if (trip.route_geometry) {
    const { data: distanceData } = await supabase.rpc('check_deviation_alert', {
      user_location: data.location,
      route_geom: trip.route_geometry,
      threshold_meters: trip.deviation_meters,
    });
    
    if (distanceData?.is_alert) {
      alerts.push({
        trip_id: data.trip_id,
        type: 'deviation_detected',
        severity: 'warning',
        subject_user_id: data.user_id,
        location: data.location,
        message: `Te has desviado ${Math.round(distanceData.distance_meters)}m de la ruta`,
        data: { distance_meters: distanceData.distance_meters },
      });
    }
  }
  
  // 3. Verificar distancia al grupo
  const { data: groupDist } = await supabase.rpc('check_distance_alert', {
    trip_uuid: data.trip_id,
    user_uuid: data.user_id,
    user_location: data.location,
    threshold_meters: trip.max_distance,
  });
  
  if (groupDist?.is_alert) {
    alerts.push({
      trip_id: data.trip_id,
      type: 'distance_exceeded',
      severity: 'critical',
      subject_user_id: data.user_id,
      location: data.location,
      message: `Estás a ${Math.round(groupDist.distance_meters)}m del grupo`,
      data: { distance_meters: groupDist.distance_meters },
    });
  }
  
  // 4. Verificar tráfico (solo premium - llamada externa)
  const { data: tripInfo } = await supabase
    .from('trip_participants')
    .select('profiles!inner(subscription_tier)')
    .eq('trip_id', data.trip_id)
    .eq('user_id', data.user_id)
    .single();
  
  if (tripInfo?.profiles?.subscription_tier !== 'free') {
    const trafficAlerts = await checkTrafficNearby(data.location, trip.route_geometry);
    alerts.push(...trafficAlerts.map(t => ({
      trip_id: data.trip_id,
      type: 'traffic_warning' as const,
      severity: 'warning' as const,
      location: data.location,
      message: t.description,
      data: t,
    })));
  }
  
  // 5. Insertar alertas
  if (alerts.length > 0) {
    await supabase.from('alerts').insert(alerts);
    // Realtime DB Changes se encarga de broadcast
  }
  
  return new Response(JSON.stringify({ alerts_created: alerts.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### 6.3 Activación de la Edge Function

**Opción A: Trigger de base de datos** (recomendada)

```sql
-- Cuando se inserta una ubicación, se dispara la Edge Function
CREATE OR REPLACE FUNCTION trigger_check_alerts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Llamar a la Edge Function de forma asíncrona
  PERFORM
    net.http_post(
      url := current_setting('supabase.functions.url') || '/check-alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.functions.anon_key')
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_location_check_alerts
  AFTER INSERT ON location_updates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_check_alerts();
```

**Opción B: Procesamiento periódico** (más eficiente para alta escala)

```sql
-- Edge Function se ejecuta cada 15 segundos vía pg_cron
SELECT cron.schedule(
  'check-alerts-every-15s',
  '*/15 * * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('supabase.functions.url') || '/check-alerts-batch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.functions.anon_key')
      ),
      body := jsonb_build_object(
        'since', NOW() - INTERVAL '15 seconds'
      )
    ) AS request_id;
  $$
);
```

### 6.4 Tipos de Alerta y Comportamiento

| Tipo | Severidad | Gatillo | Destinatario | Acción en UI |
|------|-----------|---------|--------------|--------------|
| `distance_exceeded` | 🔴 Critical | Usuario > umbral del grupo | Usuario + Líder | Modal + sonido |
| `deviation_detected` | 🟡 Warning | Usuario > umbral de ruta | Usuario + Líder | Toast + marcador |
| `traffic_warning` | 🟡 Warning | API externa detecta tráfico | Todos | Banner en mapa |
| `road_closure` | 🔴 Critical | API externa detecta cierre | Todos | Modal + sugerir ruta |
| `weather_alert` | 🟡 Warning | API clima en ruta | Todos | Banner |
| `speed_warning` | 🟢 Info | Velocidad > 140 km/h | Usuario | Toast sutil |
| `group_halt` | 🟢 Info | Grupo detenido > 3 min | Ausentes | Banner |
| `battery_low` | 🟢 Info | Batería < 15% | Usuario | Toast + sugerir cargar |

### 6.5 Cálculo del Corredor de Ruta (Desvíos)

```
                  ┌──────────────────────────────┐
                  │   CORREDOR DE RUTA            │
                  │                               │
                  │   ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮     │
                  │  ⋮  ●─────●─────●  ⋮  Límite  │  ← deviation_meters (ej: 200m)
                  │   ⋮    RUTA     ⋮             │
                  │  ⋮  ●───────────●  ⋮          │
                  │   ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮ ⋮           │
                  │                               │
                  └──────────────────────────────┘
                    
                  ● = usuario DENTRO del corredor (ok)
                  ▲ = usuario FUERA del corredor (alerta!)
```

El corredor se calcula con `ST_Buffer(route_geometry, deviation_meters)`.

---

## 7. Almacenamiento de Fotos

### 7.1 Flujo de Captura y Almacenamiento

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Usuario     │    │    App        │    │  Supabase    │    │   Viaje      │
│   toma foto   │    │               │    │  Storage/DB  │    │  Particip.   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │                   │
       │ 1. Capturar foto  │                   │                   │
       │ ─────────────────►│                   │                   │
       │                   │                   │                   │
       │                   │ 2. Obtener GPS    │                   │
       │                   │    actual          │                   │
       │                   │                   │                   │
       │                   │ 3. Generar        │                   │
       │                   │    thumbnail       │                   │
       │                   │    + blurhash      │                   │
       │                   │                   │                   │
       │                   │ 4. Upload original│                   │
       │                   │ ────────────────► │                   │
       │                   │   /photos/{userId}/{id}.jpg           │
       │                   │                   │                   │
       │                   │ 5. Upload thumb   │                   │
       │                   │ ────────────────► │                   │
       │                   │   /photos/{userId}/{id}_thumb.jpg     │
       │                   │                   │                   │
       │                   │ 6. INSERT en      │                   │
       │                   │    tabla photos    │                   │
       │                   │ ────────────────► │                   │
       │                   │                   │                   │
       │                   │                   │ 7. Realtime       │
       │                   │                   │    broadcast a    │
       │                   │                   │    participantes  │
       │                   │                   │ ────────────────► │
       │                   │                   │                   │
       │ 8. Confirmación   │                   │                   │
       │ ◄──────────────── │                   │                   │
       │                   │                   │                   │
```

### 7.2 Estructura en Supabase Storage

```
photos/
├── {userId}/
│   ├── {photoId}_original.jpg     → Imagen original (compressed al 80%)
│   ├── {photoId}_thumb.jpg        → Thumbnail 320×240px
│   └── {photoId}_blurhash.txt     → Blurhash string (placeholder miniatura)
├── shared/                         → Cache de fotos compartidas (opcional)
│   └── {tripId}/
│       └── {photoId}_shared.jpg   → Copia compartida (más comprimida)
└── .temp/
    └── {userId}_pending/           → Fotos sin subir (offline)
        └── {photoId}_pending.jpg
```

### 7.3 Bucket Policies (Storage)

```sql
-- Bucket: photos
-- Políticas de storage:

-- 1. Subir fotos (autenticados)
CREATE POLICY "Users can upload their own photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Leer fotos propias
CREATE POLICY "Users can view own photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Leer fotos compartidas en viajes (vía JOIN con tabla photos)
-- Esto se maneja desde la tabla photos con RLS, que valida si el usuario
-- participa en el viaje donde se compartió la foto.
```

### 7.4 Configuración de la Cámara (React Native)

```typescript
// src/components/take-photo.tsx (simplificado)
export function usePhotoCapture() {
  const takePhoto = async (tripId: string | null) => {
    // 1. Permisos
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    
    // 2. Capturar
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      exif: true,
      allowsEditing: false,
    });
    
    if (result.canceled) return;
    const asset = result.assets[0];
    
    // 3. Obtener GPS de la foto (EXIF) o del último punto conocido
    const location = asset.exif?.GPSLatitude
      ? {
          latitude: asset.exif.GPSLatitude,
          longitude: asset.exif.GPSLongitude,
        }
      : await getLastKnownLocation();
    
    // 4. Procesar y subir
    const photoId = uuid();
    const blurhash = await generateBlurhash(asset.uri);
    const thumbnail = await generateThumbnail(asset.uri, 320, 240);
    
    // 5. Upload paralelo
    const [originalUpload, thumbUpload] = await Promise.all([
      uploadToStorage(`photos/${userId}/${photoId}_original.jpg`, asset.uri),
      uploadToStorage(`photos/${userId}/${photoId}_thumb.jpg`, thumbnail),
    ]);
    
    // 6. Guardar en BD
    await supabase.from('photos').insert({
      id: photoId,
      trip_id: tripId,
      user_id: userId,
      location: `POINT(${location.longitude} ${location.latitude})`,
      storage_path: `photos/${userId}/${photoId}_original.jpg`,
      thumbnail_path: `photos/${userId}/${photoId}_thumb.jpg`,
      blurhash,
      is_shared: tripId !== null,
      width: asset.width,
      height: asset.height,
      file_size: asset.fileSize,
    });
    
    return photoId;
  };
  
  return { takePhoto };
}
```

---

## 8. Modelo de Monetización

### 8.1 Planes

| Feature | Free | Premium ($4.99/mes) | Familia ($7.99/mes) |
|---------|------|---------------------|---------------------|
| Ubicación en tiempo real | ✅ | ✅ | ✅ |
| Mapas | ✅ | ✅ | ✅ |
| Alertas básicas (distancia, desvío) | ✅ | ✅ | ✅ |
| Alertas de tráfico/obras | ❌ | ✅ | ✅ |
| Fotos geolocalizadas | ✅ (7 días) | ✅ (ilimitado) | ✅ (ilimitado) |
| Crear viajes | 3 activos | Ilimitados | Ilimitados |
| Participantes por viaje | 5 | 50 | 100 |
| Frecuencia GPS | 10s | 2s | 2s |
| Historial de viaje | 7 días | Ilimitado | Ilimitado |
| Reproducción de ruta | ❌ | ✅ | ✅ |
| Anuncios | ✅ | ❌ | ❌ |
| Temas de mapa personalizados | ❌ | ✅ | ✅ |
| Soporte prioritario | ❌ | ✅ | ✅ |
| Miembros de familia | 0 | 0 | Hasta 5 |

### 8.2 RevenueCat Configuration

```typescript
// src/services/revenuecat.ts
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-react-native';

const ENTITLEMENT_ID = 'premium';
const OFFERING_ID = 'followme_plans';

export type SubscriptionTier = 'free' | 'premium' | 'family';

// Product IDs (configurados en App Store Connect y Google Play Console)
const PRODUCTS = {
  monthly: 'followme_premium_monthly',
  yearly: 'followme_premium_yearly',       // ~$39.99/yr
  familyMonthly: 'followme_family_monthly',
  familyYearly: 'followme_family_yearly',   // ~$69.99/yr
};

export async function initializeRevenueCat() {
  await Purchases.configure({
    apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY!,
    entitlementIds: [ENTITLEMENT_ID],
  });
}

export async function checkSubscriptionStatus(): Promise<SubscriptionTier> {
  const customerInfo = await Purchases.getCustomerInfo();
  const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
  
  if (!entitlement) return 'free';
  
  // Mapear producto a plan
  if (entitlement.productIdentifier.includes('family')) return 'family';
  return 'premium';
}

export async function purchasePlan(plan: 'monthly' | 'yearly' | 'familyMonthly' | 'familyYearly') {
  const offerings = await Purchases.getOfferings();
  const offering = offerings.current;
  
  if (!offering) throw new Error('No offerings available');
  
  const package = offering.availablePackages.find(
    (p: PurchasesPackage) => p.product.identifier === PRODUCTS[plan]
  );
  
  if (!package) throw new Error('Package not found');
  
  const { customerInfo } = await Purchases.purchasePackage(package);
  return customerInfo;
}

// Sincronizar con Supabase (vía Edge Function webhook de RevenueCat)
// RevenueCat → Webhook → Supabase Edge Function → Actualiza profiles.subscription_tier
```

### 8.3 Sincronización RevenueCat → Supabase

```typescript
// supabase/functions/revenuecat-webhook/index.ts
serve(async (req) => {
  const body = await req.json();
  
  // RevenueCat sends events like: INITIAL_PURCHASE, RENEWAL, CANCELLATION, etc.
  const { event } = body;
  
  if (event.type === 'INITIAL_PURCHASE' || event.type === 'RENEWAL') {
    const { app_user_id, product_id, expiration_at_ms } = event;
    
    const planType = product_id.includes('family')
      ? (product_id.includes('yearly') ? 'family_yearly' : 'family_monthly')
      : (product_id.includes('yearly') ? 'yearly' : 'monthly');
    
    const tier = product_id.includes('family') ? 'family' : 'premium';
    
    // Actualizar profiles.subscription_tier
    await supabase
      .from('profiles')
      .update({ subscription_tier: tier })
      .eq('id', app_user_id);
    
    // Upsert en subscriptions
    await supabase
      .from('subscriptions')
      .upsert({
        user_id: app_user_id,
        revenuecat_id: event.id,
        platform: event.environment === 'SANDBOX' ? 'ios' : 'android',
        product_id,
        plan_type: planType,
        status: 'active',
        current_period_start: new Date(event.purchased_at_ms).toISOString(),
        current_period_end: new Date(expiration_at_ms).toISOString(),
      });
  }
  
  if (event.type === 'CANCELLATION') {
    await supabase
      .from('subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('revenuecat_id', event.id);
  }
  
  if (event.type === 'EXPIRATION') {
    const { app_user_id } = event;
    await supabase
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('revenuecat_id', event.id);
    
    await supabase
      .from('profiles')
      .update({ subscription_tier: 'free' })
      .eq('id', app_user_id);
  }
  
  return new Response('OK', { status: 200 });
});
```

### 8.4 Anuncios (Free Tier)

```typescript
// src/services/ads.ts
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

const adUnitId = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-xxxxxxxxxxxx/yyyyyyyyyy';

export const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
  requestNonPersonalizedAdsOnly: true,
});

// Mostrar interstitial al iniciar/terminar un viaje (free users)
export function showInterstitialIfFree(tier: SubscriptionTier) {
  if (tier !== 'free') return;
  
  interstitial.load();
  interstitial.addAdEventListener(AdEventType.LOADED, () => {
    interstitial.show();
  });
}
```

---

## 9. Seguridad

### 9.1 Row Level Security (RLS) - Políticas Completas

#### `profiles`

```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado puede ver perfiles (necesario para amigos)
CREATE POLICY "Anyone authenticated can read profiles"
ON profiles FOR SELECT
TO authenticated
USING (TRUE);

-- Creación: solo el propio usuario puede crear su perfil (after signup trigger)
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Actualización: solo el propio usuario
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
```

#### `friends`

```sql
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- Lectura: solo si eres parte de la amistad
CREATE POLICY "Users can read their own friendships"
ON friends FOR SELECT
TO authenticated
USING (auth.uid() IN (user_id_1, user_id_2));

-- Inserción: solo si eres user_id_1 y existe solicitud aceptada
CREATE POLICY "Users can add friends"
ON friends FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id_1
  AND EXISTS (
    SELECT 1 FROM friend_requests
    WHERE ((sender_id = user_id_1 AND receiver_id = user_id_2)
        OR (sender_id = user_id_2 AND receiver_id = user_id_1))
      AND status = 'accepted'
  )
);
```

#### `friend_requests`

```sql
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see requests they're involved in"
ON friend_requests FOR SELECT
TO authenticated
USING (auth.uid() IN (sender_id, receiver_id));

CREATE POLICY "Users can send requests"
ON friend_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND sender_id != receiver_id
);

CREATE POLICY "Receiver can accept/reject"
ON friend_requests FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id AND status = 'pending')
WITH CHECK (auth.uid() = receiver_id AND status IN ('accepted', 'rejected'));
```

#### `trips`

```sql
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- Lectura: participantes, amigos si es público, o creator
CREATE POLICY "Trip visibility"
ON trips FOR SELECT
TO authenticated
USING (
  creator_id = auth.uid()                                    -- creador
  OR EXISTS (                                                  -- participante
    SELECT 1 FROM trip_participants
    WHERE trip_id = id AND user_id = auth.uid()
  )
  OR (                                                         -- público + amigos
    is_public = TRUE
    AND EXISTS (
      SELECT 1 FROM friends
      WHERE status = 'accepted'
        AND auth.uid() IN (user_id_1, user_id_2)
        AND creator_id IN (user_id_1, user_id_2)
    )
  )
);

-- Creación: cualquier autenticado
CREATE POLICY "Users can create trips"
ON trips FOR INSERT
TO authenticated
WITH CHECK (creator_id = auth.uid());

-- Actualización: solo creador o líder del viaje
CREATE POLICY "Trip update by creator or leader"
ON trips FOR UPDATE
TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM trip_participants
    WHERE trip_id = id
      AND user_id = auth.uid()
      AND role = 'leader'
  )
);
```

#### `trip_participants`

```sql
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can see trip members"
ON trip_participants FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trip_participants tp2
    WHERE tp2.trip_id = trip_id AND tp2.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM trips
    WHERE id = trip_id AND creator_id = auth.uid()
  )
);

CREATE POLICY "User can join via invite code"
ON trip_participants FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM trips
    WHERE id = trip_id
      AND (status = 'planned' OR status = 'active')
      AND (is_public = TRUE OR invite_code IS NOT NULL)
  )
);
```

#### `location_updates`

```sql
ALTER TABLE location_updates ENABLE ROW LEVEL SECURITY;

-- Lectura: participantes del viaje pueden ver ubicaciones
CREATE POLICY "Location visibility for trip participants"
ON location_updates FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trip_participants
    WHERE trip_id = location_updates.trip_id
      AND user_id = auth.uid()
  )
);

-- Inserción: solo tu propia ubicación en viajes donde participas
CREATE POLICY "Insert own location"
ON location_updates FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM trip_participants
    WHERE trip_id = location_updates.trip_id
      AND user_id = auth.uid()
  )
);
```

#### `photos` (la más restrictiva)

```sql
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Lectura de fotos compartidas: participantes del viaje
CREATE POLICY "View shared trip photos"
ON photos FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()                                         -- fotos propias
  OR (                                                          -- compartidas en viaje
    is_shared = TRUE
    AND EXISTS (
      SELECT 1 FROM trip_participants
      WHERE trip_id = photos.trip_id
        AND user_id = auth.uid()
    )
  )
);

-- Inserción: fotos propias
CREATE POLICY "Insert own photos"
ON photos FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Actualización: solo el dueño
CREATE POLICY "Update own photos"
ON photos FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Borrado: solo el dueño o líder del viaje
CREATE POLICY "Delete photos"
ON photos FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR (
    trip_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM trip_participants
      WHERE trip_id = photos.trip_id
        AND user_id = auth.uid()
        AND role = 'leader'
    )
  )
);
```

### 9.2 Otras Medidas de Seguridad

```typescript
// 1. Rate limiting en Edge Functions (Deno)
const rateLimit = new Map<string, number>();
const MAX_REQUESTS_PER_MINUTE = 60;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minuto
  const key = `${userId}:${Math.floor(now / window)}`;
  
  const count = rateLimit.get(key) ?? 0;
  if (count >= MAX_REQUESTS_PER_MINUTE) return false;
  
  rateLimit.set(key, count + 1);
  // Cleanup periódico
  if (rateLimit.size > 10000) {
    const cutoff = Math.floor(now / window) * window - window;
    for (const [k] of rateLimit) {
      const ts = parseInt(k.split(':')[1]) * window;
      if (ts < cutoff) rateLimit.delete(k);
    }
  }
  return true;
}

// 2. Validación de datos en Edge Functions
const locationSchema = z.object({
  trip_id: z.string().uuid(),
  user_id: z.string().uuid(),
  location: z.string().regex(/^POINT\(-?\d+\.?\d* -?\d+\.?\d*\)$/),
  recorded_at: z.string().datetime(),
});

// 3. Sanitización de inputs en el frontend
// (usar parámetros preparados de Supabase = automático)

// 4. Cifrado en tránsito: HTTPS everywhere (por defecto en Supabase)

// 5. Códigos de invitación de 8 caracteres (nanoid)
// Espacio: 36^8 = 2.8 billones de combinaciones
// Tasa de colisión despreciable para uso normal

// 6. Tokens JWT: Supabase Auth maneja expiración y refresh automáticos
```

### 9.3 Consideraciones de Privacidad

```
Privacy by Design:
───────────────────
• Ubicaciones solo visibles para participantes del viaje
• El líder no puede ver ubicaciones fuera del viaje
• Las fotos compartidas solo son visibles durante el viaje
• Un usuario puede dejar de compartir ubicación en cualquier momento
• Los datos de ubicación se eliminan automáticamente tras X días (según plan)
• Opción de "modo invisible" premium (apareces como desconectado)
• Exportar / eliminar todos mis datos (GDPR)
```

---

## 10. Navegación y Screens (Detalle)

### 10.1 Pantalla Principal: Mapa

```
┌──────────────────────────────────────┐
│  ▲  Status Bar                        │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │                                │  │
│  │         MAPLIBRE GL MAP        │  │
│  │                                │  │
│  │   ● Alice (yo)   300m adelante │  │
│  │   ● Bob          200m detrás  │  │
│  │   ● Charlie      500m atrás   │  │
│  │   ★ Centro del grupo          │  │
│  │   📷 Foto de Alice aquí       │  │
│  │   ⚠️ Alerta: desvío           │  │
│  │                                │  │
│  │  ┌──────────────────────────┐  │  │
│  │  │  "Viaje a la playa"      │  │  │
│  │  │  🟢 3/5 participantes    │  │  │
│  │  │  12:30 - 45 min rest.    │  │  │
│  │  └──────────────────────────┘  │  │
│  │                                │  │
│  │      [📷]  [📍]  [⚙️]         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────┬──────────┬──────────┬──────┐ │
│  │Mapa│ Viajes   │ Amigos   │ Perfil│ │
│  └────┴──────────┴──────────┴──────┘ │
└──────────────────────────────────────┘
```

### 10.2 Componentes Clave del Mapa

```typescript
// src/components/map/MapView.tsx
export function FollowMeMap() {
  const { participants, myLocation, trip } = useTripStore();
  const cameraRef = useRef<MapLibreCamera>(null);
  
  // Actualizar cámara para seguir al grupo
  useEffect(() => {
    if (trip.groupCenter) {
      cameraRef.current?.fitBounds(
        [trip.groupCenter.lng, trip.groupCenter.lat],
        [myLocation?.lng, myLocation?.lat],
        100, // padding
        1000 // duración animación
      );
    }
  }, [trip.groupCenter]);
  
  return (
    <MapLibreMap
      ref={cameraRef}
      styleURL={MapStyle.Light}
      compassEnabled
      logoEnabled={false}
    >
      {/* Ruta planeada */}
      {trip.routeGeometry && (
        <RoutePolyline
          geometry={trip.routeGeometry}
          color="#3B82F6"
          width={4}
        />
      )}
      
      {/* Marcadores de participantes */}
      {participants.map((p) => (
        <UserMarker
          key={p.userId}
          coordinate={p.location}
          color={p.color}
          name={p.displayName}
          isMe={p.userId === myUserId}
          isOnline={p.isOnline}
          speed={p.speed}
          bearing={p.bearing}
        />
      ))}
      
      {/* Centro del grupo */}
      {trip.groupCenter && (
        <GroupCenterMarker coordinate={trip.groupCenter} />
      )}
      
      {/* Fotos geolocalizadas */}
      {photos.filter(p => p.isShared).map((photo) => (
        <PhotoMarker
          key={photo.id}
          coordinate={photo.location}
          thumbnailUrl={photo.thumbnailUrl}
          onPress={() => navigateToPhoto(photo.id)}
        />
      ))}
      
      {/* Alertas activas */}
      {alerts.filter(a => !a.resolved).map((alert) => (
        <AlertMarker
          key={alert.id}
          coordinate={alert.location}
          type={alert.type}
          severity={alert.severity}
        />
      ))}
    </MapLibreMap>
  );
}
```

---

## 11. Recomendación de Nombre Final

Después de analizar opciones, el nombre recomendado es:

# 🚗 **FollowMe**

### Alternativas consideradas:

| Nombre | Positivo | Negativo | Veredicto |
|--------|----------|----------|-----------|
| **FollowMe** ✓ | Simple, memorable, describe la función | Quizás demasiado genérico | ✅ **Elegido** |
| CaravanGO | Evoca caravana, moderno | Menos intuitivo, "caravana" es larga | ❌ |
| Convoy | Corto, profesional | Tonos militares, frío | ❌ |
| RouteMate | Amigable, "compañero de ruta" | Ya existe RouteMate (otra app) | ❌ |
| TrailBlaze | Aventurero | No describe seguimiento | ❌ |
| RoadSync | Técnico, sincronización | Frío, corporativo | ❌ |
| PathBond | Único, emocional | Difícil de pronunciar | ❌ |

**¿Por qué FollowMe?**
1. **Verbo en imperativo** que invita a la acción: "¡Sígueme!"
2. **Fácil de recordar** y pronunciar en cualquier idioma
3. **Describe el core function**: seguir a otros viajeros
4. **Corto** (8 letras) → fácil de tipear, buen branding
5. **Disponible** para App Store y Google Play (verificar antes de publicar)

### Sugerencias de dominio:
- `followme.app`
- `followme.travel`
- `followme.rocks`

---

## 12. ADRs (Architecture Decision Records)

### ADR-001: Broadcast Realtime para ubicaciones

| Campo | Valor |
|-------|-------|
| **Contexto** | Necesitamos compartir ubicaciones en tiempo real con latencia <2s |
| **Decisión** | Usar Supabase Realtime BROADCAST para ubicaciones en vivo, y escrituras batch periódicas en DB para persistencia |
| **Alternativas** | 1) Solo DB Changes Realtime → latencia mayor, más writes. 2) WebSocket propio → más complejidad operativa. 3) MQTT → otra infraestructura que mantener |
| **Consecuencia +** | Latencia <100ms para broadcasts, sin writes por cada update GPS |
| **Consecuencia -** | Dos mecanismos que mantener sincronizados. Broadcast no persiste (necesitamos batch). |
| **Status** | ✅ Accepted |

### ADR-002: MapLibre GL en vez de Google Maps

| Campo | Valor |
|-------|-------|
| **Contexto** | Necesitamos un mapa interactivo con rendimiento nativo |
| **Decisión** | MapLibre GL Native con tiles de Maptiler (free tier: 50k map views/mes) |
| **Alternativas** | 1) Google Maps → más caro, terms restrictivos. 2) Mapbox → costoso, menos open. |
| **Consecuencia +** | Open source, sin límites de usage onerosos, personalizable al 100% |
| **Consecuencia -** | Menos documentación, curvas de aprendizaje, menos plugins |
| **Status** | ✅ Accepted |

### ADR-003: Estado global con Zustand

| Campo | Valor |
|-------|-------|
| **Contexto** | Múltiples componentes necesitan acceso a ubicaciones, viajes, alertas |
| **Decisión** | Zustand para stores (vs Redux, vs Context API, vs Jotai) |
| **Alternativas** | Redux (mucho boilerplate), Context API (re-renders innecesarios), Jotai (más atómico pero menos probado en RN) |
| **Consecuencia +** | Simple, typescript-friendly, sin providers, actualizaciones selectivas |
| **Consecuencia -** | Menos ecosistema de middlewares que Redux |
| **Status** | ✅ Accepted |

### ADR-004: Supabase como backend único

| Campo | Valor |
|-------|-------|
| **Contexto** | Necesitamos DB, Auth, Storage, Realtime, y Serverless |
| **Decisión** | Supabase como plataforma integral |
| **Alternativas** | Firebase (costo impredecible, vendor lock-in más fuerte), Backend propio (más control pero mucho overhead) |
| **Consecuencia +** | PostGIS nativo, RLS por defecto, Realtime integrado, costo predecible |
| **Consecuencia -** | Dependencia de Supabase, menos control de infraestructura |
| **Status** | ✅ Accepted |

### ADR-005: Código de invitación para viajes

| Campo | Valor |
|-------|-------|
| **Contexto** | Los usuarios deben poder invitar a otros a sus viajes de forma simple |
| **Decisión** | Código alfanumérico de 8 caracteres (nanoid) + deep link |
| **Alternativas** | Solo deep links (más frágil), QR (requiere cámara), invitación por contacto directo (más pasos) |
| **Consecuencia +** | Simple de compartir por voz/chat/WhatsApp, funciona offline |
| **Consecuencia -** | Posible adivinanza (36^8 ≈ 2.8T combinaciones → seguro) |
| **Status** | ✅ Accepted |

---

## Apéndice A: Comandos de Inicio Rápido

```bash
# 1. Crear proyecto Expo
npx create-expo-app@latest followme-app --template blank-typescript

# 2. Instalar dependencias principales
cd followme-app
npx expo install @maplibre/maplibre-react-native expo-location expo-camera
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install react-native-google-mobile-ads
npm install @revenuecat/purchases-react-native zustand expo-router

# 3. Inicializar Supabase local
npx supabase init
npx supabase start

# 4. Ejecutar migraciones
npx supabase db push

# 5. Iniciar app
npx expo start
```

## Apéndice B: Diagrama de Estados del Viaje

```
                     ┌──────────┐
                     │  PLANNED │  ← Creado pero no iniciado
                     └────┬─────┘
                          │  Iniciar viaje
                          ▼
                     ┌──────────┐
               ┌────►│  ACTIVE  │  ← En progreso (compartiendo ubicaciones)
               │     └────┬─────┘
               │          │  Pausar
               │          ▼
               │     ┌──────────┐
               ├─────│  PAUSED  │  ← Temporalmente detenido
               │     └────┬─────┘
               │          │  Reanudar
               │          │
               │          │  Finalizar
               │          ▼
               │     ┌──────────┐
               └─────│COMPLETED│  ← Terminado normalmente
                     └──────────┘

  Cualquier estado → CANCELLED (solo creador/líder)
```

## Apéndice C: Indicadores Clave de Performance (KPIs)

| Métrica | Target | Cómo se mide |
|---------|--------|-------------|
| Latencia de ubicación | < 500ms P95 | Logs en Edge Function |
| Tiempo de carga del mapa | < 2s | Firebase Performance |
| Escrituras batch (ubicaciones) | < 100ms P99 | Supabase Logs |
| Alertas generadas | < 5s desde desvío | Logs + timestamps |
| Uptime del servicio | > 99.9% | Supabase Status |
| Tasa de conversión free→premium | > 5% | RevenueCat Analytics |
| DAU (Daily Active Users) | 10,000 (mes 6) | Supabase Analytics |
| Tamaño de la app (APK/IPA) | < 50 MB | Expo Build Report |

---

> **Documento generado:** Junio 2026  
> **Próxima revisión:** Diciembre 2026  
> **Mantenedor:** Equipo de arquitectura FollowMe
