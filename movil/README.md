# App móvil del inventario

App en React Native con Expo (SDK 58) que usa la misma API que la web.

| Quién entra | Qué puede hacer |
|---|---|
| Admin, Técnico, Consulta | Escanear el QR o el código de barras de la etiqueta y ver la ficha del equipo y quién lo tiene |
| Empleado | Ver sus datos y sus equipos (sin editar nada) y reportar una falla; ve la respuesta de soporte |

Las cuentas de empleado se crean en la web: perfil del empleado → **Acceso a la app** → **Crear acceso**. La primera vez que entra, la app le pide cambiar la contraseña temporal.

## Probar en tu celular

1. Instala **Expo Go** desde Play Store (o App Store).
2. Conecta el celular a la **misma red Wi-Fi** que tu PC.
3. Copia la configuración y pon la IP de tu PC (`ipconfig` → *Dirección IPv4*):

   ```powershell
   cd movil
   copy .env.example .env
   ```

   En `.env`, `EXPO_PUBLIC_API_URL` debe apuntar a la API, por ejemplo `http://192.168.0.61:3000/api`.
4. Arranca la app y escanea con Expo Go el QR que aparece en la terminal:

   ```powershell
   npm start
   ```

Si cambias `.env`, detén la app y vuelve a correr `npx expo start --clear`.

Si el celular no conecta: revisa que la API esté encendida, que la IP sea la de la red Wi-Fi y que el Firewall de Windows permita Node.js.

## Comandos

```powershell
npm start              # servidor de desarrollo
npm run typecheck      # revisar tipos
npx expo-doctor        # revisar dependencias y configuración
npx expo install <pkg> # agregar paquetes (elige la versión compatible con el SDK)
```

## Estructura

- `src/app/` pantallas (Expo Router). `_layout.tsx` decide qué pantallas ve cada quien según su sesión.
- `src/lib/` API, sesión (el token se guarda cifrado con `expo-secure-store`) y tipos.
- `src/componentes/` piezas visuales compartidas.

## Notificaciones push

- Cuando un empleado reporta una falla, les llega un aviso a los **administradores y técnicos** que tienen sesión iniciada en la app. Al tocarlo se abre la ficha del equipo.
- Cuando soporte atiende, manda a reparación o cierra el reporte, le llega un aviso al **empleado**.
- El celular se registra al iniciar sesión y se da de baja al salir. Si un aviso no se puede enviar, el reporte se guarda igual.

**Expo Go no recibe notificaciones en Android.** Para probarlas hay que instalar la app propia (APK), que se genera en la nube de Expo con EAS Build (no necesitas Android Studio).

## Generar el APK

Se hace una sola vez por versión de la app:

1. Crea una cuenta gratis en [expo.dev](https://expo.dev) y entra desde la terminal:

   ```powershell
   cd movil
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` liga la app a tu cuenta y agrega su `projectId` al `app.json`. Sin él la app funciona, pero sin notificaciones.
2. **Credenciales de Android para las notificaciones (Firebase).** Sigue la guía de Expo: <https://docs.expo.dev/push-notifications/fcm-credentials/>
   - Crea un proyecto en Firebase y registra la app Android con el paquete `com.drfc.inventario`.
   - Descarga `google-services.json`, ponlo en `movil/` y agrega `"googleServicesFile": "./google-services.json"` dentro de `"android"` en `app.json`.
   - Sube la clave de la cuenta de servicio (FCM V1) con `npx eas-cli@latest credentials`.
3. Genera el APK:

   ```powershell
   npx eas-cli@latest build --profile preview --platform android
   ```

   Al terminar, Expo te da un enlace para descargar e instalar el APK en los celulares.

| Perfil | Para qué | API |
|---|---|---|
| `preview` | Pruebas en tu red | `http://192.168.0.61:3000/api` (en `eas.json`; cámbiala si cambia la IP de tu PC) |
| `production` | Uso real | Agrega `"env": { "EXPO_PUBLIC_API_URL": "https://tu-dominio/api" }` al perfil en `eas.json` |

La app solo permite conexiones HTTP sin cifrar cuando la dirección de la API empieza con `http://` (ver `app.config.ts`). En producción usa la dirección HTTPS del VPS.
