# Probar el sistema en tu PC

Hay dos formas. La **opción A (Docker)** es la recomendada porque es idéntica a como correrá en el VPS; cuando pases a producción solo cambias el archivo `.env`. La **opción B** sirve si tu PC no puede instalar Docker.

Al terminar tendrás:

| | Opción A (Docker) | Opción B (sin Docker) |
|---|---|---|
| Web de administración | http://localhost:8080 | http://localhost:5173 |
| Documentación de la API | http://localhost:8080/api/docs | http://localhost:3000/api/docs |

Usuario de prueba: `admin@pruebas.com` · contraseña `Pruebas12345`

---

## Opción A: con Docker Desktop

### 1. Instala Docker Desktop

Descárgalo de docker.com (Windows, Mac o Linux) e instálalo. En Windows acepta activar **WSL 2** si te lo pide y reinicia. Abre Docker Desktop y espera a que diga *Engine running*.

### 2. Prepara el proyecto

Descomprime `inventario-drfc-etapa1.zip`, por ejemplo en `C:\inventario-drfc`. Abre **PowerShell** en esa carpeta y copia la configuración de pruebas:

```powershell
cd C:\inventario-drfc
copy .env.pruebas .env
```

### 3. Levántalo

```powershell
docker compose -f docker-compose.yml -f docker-compose.pruebas.yml up -d --build
```

La primera vez tarda unos minutos mientras descarga y compila. Revisa que la API arrancó:

```powershell
docker compose logs api
```

Debe aparecer `Nest application successfully started`.

### 4. Carga tu inventario

```powershell
docker compose exec api npm run seed
```

Crea el administrador de pruebas e importa tus 87 empleados y 212 equipos.

### 5. Úsalo

Abre http://localhost:8080 e inicia sesión. La web ya viene incluida en Docker.

Para probar la API directamente, abre http://localhost:8080/api/docs:

1. **POST /api/auth/login** → *Try it out* → escribe el correo y contraseña de prueba → *Execute*.
2. Copia el valor de `token`.
3. Botón **Authorize** (arriba a la derecha) → pega el token → *Authorize*.
4. Prueba, por ejemplo, **GET /api/equipos/resumen** o **GET /api/empleados**.

### Comandos útiles

Si actualizas el código, vuelve a ejecutar el comando del paso 3 para reconstruir.


| Para | Comando |
|---|---|
| Detener (los datos se conservan) | `docker compose down` |
| Volver a arrancar | `docker compose -f docker-compose.yml -f docker-compose.pruebas.yml up -d` |
| Ver errores | `docker compose logs -f api` |
| Empezar de cero, borrando todos los datos | `docker compose down -v` y luego los pasos 3 y 4 |

### Ver la base de datos directamente (opcional)

Con DBeaver o pgAdmin (gratuitos) conéctate a: servidor `localhost`, puerto `5433`, base `inventario`, usuario `inventario`, contraseña `pruebas123`.

---

## Opción B: sin Docker

### 1. Instala

- **Node.js 22 LTS** desde nodejs.org.
- **PostgreSQL 16** desde postgresql.org/download. Anota la contraseña que le pongas al usuario `postgres`. Deja el puerto 5432.

### 2. Crea la base de datos

Abre **SQL Shell (psql)** (se instaló con PostgreSQL), entra con el usuario `postgres` y ejecuta:

```sql
CREATE USER inventario WITH PASSWORD 'pruebas123';
CREATE DATABASE inventario OWNER inventario;
```

### 3. Prepara y arranca la API

En PowerShell, dentro de la carpeta `api`:

```powershell
cd C:\inventario-drfc\api
copy .env.pruebas .env
npm install
npm run pruebas:preparar
npm run pruebas:iniciar
```

`pruebas:preparar` compila, crea las tablas y carga tu inventario (hace falta la primera vez y cada vez que actualices el código). `pruebas:iniciar` arranca la API; déjala abierta mientras pruebas y detenla con `Ctrl+C`.

### 4. Arranca la web

Abre **otra terminal** (en VS Code, el botón **+** del panel de terminal) y ejecuta:

```powershell
cd C:\inventario-drfc\web
npm install
npm run dev
```

Abre http://localhost:5173 e inicia sesión. La web le pasa las peticiones a la API del puerto 3000, así que **las dos terminales deben quedar abiertas**.

La documentación de la API sigue disponible en http://localhost:3000/api/docs.

### Cuando recibas una versión nueva del código

1. Detén la API y la web con `Ctrl+C` en cada terminal.
2. Copia los archivos nuevos encima de los anteriores.
3. En la terminal de la API: `npm install`, `npm run pruebas:preparar` y `npm run pruebas:iniciar`.
4. En la terminal de la web: `npm install` y `npm run dev`.

---

## Probar desde el celular (misma red Wi-Fi)

Busca la IP de tu PC con `ipconfig` (línea *Dirección IPv4*, algo como `192.168.1.50`) y abre en el celular `http://192.168.1.50:8080` (opción A) o `http://192.168.1.50:5173` (opción B). Si no carga, permite el puerto en el Firewall de Windows. Esto será útil cuando lleguemos a la app Android.

## Cuando pases al VPS

Usa el `README.md`: copia `.env.example` como `.env`, pon tu dominio y contraseñas reales, y levanta solo con `docker compose up -d --build` (sin el archivo de pruebas).
