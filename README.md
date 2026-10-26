# Sistema de inventario de equipos

Sistema para registrar equipos de cómputo, empleados, asignaciones, reparaciones y bajas, con inicio de sesión por roles, bitácora de cambios e importación y exportación de Excel.

- `api/`: base de datos y API (NestJS + Drizzle + PostgreSQL).
- `web/`: web de administración (React + Vite).

Para probarlo en tu computadora sigue **PRUEBAS-PC.md**. Esta guía es para instalarlo en el VPS.

Todo el software es gratuito y de código abierto: PostgreSQL, Node.js, NestJS, Drizzle ORM, Docker y Caddy.

## Cómo está armado

```
Internet ──► Caddy (HTTPS automático, puertos 80/443)
                 │
                 ├── /       ──► Web de administración (archivos estáticos)
                 └── /api/*  ──► API NestJS (puerto 3000, interno)
                                    │
                                    └──► PostgreSQL 16 (interno, sin acceso desde internet)
```

Los tres servicios corren en contenedores Docker dentro de tu VPS. La base de datos no expone ningún puerto hacia afuera.

## Roles

| Rol | Puede |
|---|---|
| ADMIN | Todo, incluido crear usuarios del sistema, ver la bitácora y eliminar registros |
| TECNICO | Consultar, dar de alta, editar, asignar, devolver, enviar a reparación y dar de baja |
| CONSULTA | Solo consultar |

## Instalación en el VPS de Hostinger

Estos pasos asumen la plantilla **Ubuntu 24.04** (o 22.04). Si elegiste la plantilla que ya incluye Docker, salta el paso 2.

### 1. Entra al servidor

En el panel de Hostinger (hPanel → VPS) copia la IP y la contraseña de root. Desde tu computadora:

```bash
ssh root@IP_DE_TU_VPS
```

### 2. Instala Docker

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # debe mostrar la versión
```

### 3. Abre solo los puertos necesarios

```bash
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

Si en hPanel tienes activado el firewall de Hostinger, agrega también ahí las reglas para los puertos 80 y 443.

### 4. Apunta tu dominio al VPS

En el DNS de tu dominio crea un registro **A**, por ejemplo `inventario.tuempresa.com`, con la IP del VPS. Puede tardar unos minutos en propagarse. Sin dominio también funciona por IP, pero sin HTTPS (no recomendado para producción).

### 5. Sube el proyecto

Desde tu computadora, en la carpeta donde descomprimiste el proyecto:

```bash
scp -r inventario-drfc root@IP_DE_TU_VPS:/opt/inventario
```

(O súbelo a un repositorio privado de GitHub y haz `git clone` en `/opt/inventario`.)

### 6. Configura las variables

```bash
cd /opt/inventario
cp .env.example .env
openssl rand -hex 24   # úsalo para POSTGRES_PASSWORD
openssl rand -hex 32   # úsalo para JWT_SECRET
nano .env
```

Llena `DOMINIO`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_USUARIO`, `ADMIN_CORREO` y `ADMIN_PASSWORD`. Guarda con `Ctrl+O` y sal con `Ctrl+X`.

### 7. Levanta el sistema

```bash
docker compose up -d --build
docker compose logs -f api      # espera "Nest application successfully started" y sal con Ctrl+C
```

### 8. Crea el administrador y carga tu inventario

```bash
docker compose exec api npm run seed
```

Esto crea el usuario administrador del `.env` e importa los 87 empleados y 212 equipos de tu Excel (archivo `api/datos/inventario-inicial.json`). Si lo vuelves a ejecutar no duplica nada.

Después de este paso puedes borrar `ADMIN_PASSWORD` del `.env`.

### 9. Pruébalo

Abre `https://inventario.tuempresa.com` e inicia sesión con el administrador.

La documentación interactiva de la API está en `https://inventario.tuempresa.com/api/docs`:

1. Abre **POST /api/auth/login**, pulsa *Try it out*, escribe tu usuario y contraseña, y ejecuta.
2. Copia el `token` de la respuesta.
3. Pulsa **Authorize** arriba a la derecha y pega el token.
4. Ya puedes probar cualquier ruta, por ejemplo **GET /api/equipos/resumen**.

## Respaldos

Programa un respaldo diario a las 2 a. m. (se guardan 30 días en `/opt/inventario/respaldos`):

```bash
crontab -e
# agrega esta línea:
0 2 * * * /opt/inventario/scripts/respaldo.sh >> /opt/inventario/respaldos/registro.log 2>&1
```

Respaldo manual: `./scripts/respaldo.sh`
Restaurar: `./scripts/restaurar.sh respaldos/inventario-AAAA-MM-DD-HHMM.sql.gz`

Copia de vez en cuando la carpeta `respaldos` fuera del VPS (a tu computadora o a Google Drive). Si el servidor se pierde, los respaldos dentro de él también.

## Mantenimiento

| Tarea | Comando |
|---|---|
| Ver si todo está corriendo | `docker compose ps` |
| Ver registros de la API | `docker compose logs -f api` |
| Reiniciar | `docker compose restart` |
| Actualizar a una nueva versión del código | sube los archivos nuevos y ejecuta `docker compose up -d --build` |
| Detener todo | `docker compose down` (los datos se conservan) |

Las migraciones de base de datos se aplican solas cada vez que arranca la API.

## Rutas principales de la API

Todas empiezan con `/api`. Excepto el login y la salud, requieren el encabezado `Authorization: Bearer TOKEN`.

| Método y ruta | Para qué |
|---|---|
| `POST /auth/login` | Iniciar sesión (máx. 5 intentos por minuto) |
| `GET /auth/yo` · `PATCH /auth/password` | Datos de la sesión · cambiar contraseña propia |
| `GET /equipos` | Lista con búsqueda (`q`), filtros (`tipo`, `estatus`, `empleadoId`, `departamentoId`) y paginación |
| `GET /equipos/resumen` | Conteos por estatus y por tipo |
| `GET /equipos/codigo/{codigo}` | Buscar por código de barras o serie (para el escáner) |
| `GET /equipos/{id}` | Ficha con historial de asignaciones y reparaciones |
| `POST /equipos` · `PATCH /equipos/{id}` | Registrar (opcionalmente ya asignado) · editar |
| `POST /equipos/{id}/estatus` | Marcar como disponible o dañado |
| `POST /equipos/{id}/baja` · `/reactivar` | Dar de baja (retira al empleado si lo tenía) · reactivar |
| `DELETE /equipos/{id}` | Eliminar (solo ADMIN y solo equipos dados de baja) |
| `GET /empleados` · `GET /empleados/{id}` | Lista · ficha con equipos actuales e historial |
| `POST /empleados` · `PATCH /empleados/{id}` | Alta · edición |
| `POST /empleados/{id}/baja` · `/reactivar` | Baja (sus equipos vuelven a disponibles) · reactivar |
| `POST /asignaciones` | Entregar un equipo disponible a un empleado |
| `POST /asignaciones/devolucion` | Registrar devolución |
| `GET /asignaciones` | Historial (filtros `empleadoId`, `equipoId`, `abiertas`) |
| `POST /reparaciones` · `POST /reparaciones/{id}/recepcion` | Enviar a reparación · registrar regreso |
| `GET/POST/PATCH/DELETE /departamentos` | Consultar · crear · renombrar · eliminar si no tiene empleados |
| `GET/POST/PATCH/DELETE /departamentos/{id}/puestos` | Consultar y administrar puestos de cada departamento |
| `GET /catalogos/tipos-equipo` · `GET /catalogos/marcas` | Consultar tipos y marcas disponibles |
| `POST/PATCH/DELETE /catalogos/tipos-equipo` · `/catalogos/marcas` | Administrar categorías y marcas (solo ADMIN) |
| `GET/POST/PATCH /usuarios-sistema` | Usuarios que entran al sistema (solo ADMIN) |
| `GET /bitacora` | Quién hizo qué y cuándo (solo ADMIN) |
| `GET /excel/exportar` | Descargar el inventario en Excel |
| `POST /excel/analizar` · `POST /excel/importar` | Revisar un Excel sin guardar · importarlo |
| `GET /salud` | Comprobar que API y base responden |

## Reglas que aplica el sistema

- Un equipo solo se puede asignar si está **disponible**. Si dos personas intentan asignarlo al mismo tiempo, solo una lo logra.
- La base de datos garantiza que un equipo nunca tenga dos asignaciones vigentes.
- El número de serie y el código de barras no se pueden repetir en equipos nuevos. Los equipos importados con series repetidas se conservan con una nota para revisarlos.
- Al enviar a reparación un equipo asignado, se registra la devolución automáticamente.
- Al dar de baja a un empleado, todos sus equipos regresan al inventario como disponibles.
- Cada alta, cambio, asignación, devolución, reparación y baja queda en la bitácora con el usuario que la hizo.
- En **Altas → Departamentos y puestos**, los administradores pueden crear, renombrar y eliminar departamentos vacíos. No se elimina un departamento mientras tenga empleados asignados.
- En **Altas**, los administradores mantienen departamentos y puestos por departamento, además de tipos de equipo y marcas. Lenovo y DELL se agregan como marcas iniciales; las marcas usadas no se pueden eliminar y al renombrarlas se actualizan los equipos relacionados.
- Los puestos solo se pueden asignar a empleados del departamento correspondiente. Los tipos originales se conservan; los tipos personalizados se pueden renombrar y no se pueden eliminar mientras tengan equipos asociados.
- Los equipos se separan en **Equipo de usuario** e **Infraestructura**. Los equipos de infraestructura no se pueden asignar a empleados; los registros existentes quedan clasificados como equipos de usuario hasta que un administrador los cambie.

## Publicar la web de pruebas en GitHub Pages

GitHub Pages solo aloja la web estática; la API y PostgreSQL deben estar ejecutándose en un servidor público con HTTPS para que otras personas puedan iniciar sesión y probar el sistema.

1. En **Settings → Pages → Build and deployment**, selecciona **GitHub Actions** como origen.
2. En **Settings → Secrets and variables → Actions → Variables**, crea `VITE_API_URL` con la URL pública de la API, incluyendo `/api` (por ejemplo, `https://inventario.tudominio.com/api`). No pongas contraseñas ni claves aquí.
3. Configura `CORS_ORIGEN` en el servidor de la API con `https://drfc-developer.github.io` y reinicia la API.
4. Sube los cambios a la rama `main`. GitHub Actions compilará y publicará la web en `https://drfc-developer.github.io/Sistem_-management_DRFC/`.

Sin una API pública configurada, la página puede mostrarse, pero las funciones que requieren datos e inicio de sesión no estarán disponibles.

## Para desarrolladores

```bash
cd api
npm install
# PostgreSQL local y variables DATABASE_URL, JWT_SECRET, ADMIN_USUARIO, ADMIN_PASSWORD
npm run build && npm run migrar && npm run seed
npm run start:dev
```

En otra terminal, la web:

```bash
cd web
npm install
npm run dev     # http://localhost:5173
```

Para cambiar la base de datos: edita `api/src/db/esquema.ts`, ejecuta `npm run migracion:generar` y revisa el SQL nuevo en `api/drizzle/`. Se aplicará solo en el siguiente arranque.

## Próximas etapas

- Carta responsiva en PDF al asignar un equipo.
- App Android (APK) con escaneo de códigos de barras por cámara.
