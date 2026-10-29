# Hub

Hub privado para organizar tus webs, con React + Vite, Firebase Authentication (correo y contraseña) y Cloud Firestore.

## Requisitos

- Node.js 20 o posterior
- Proyecto Firebase
- Acceso de administrador a Firebase Console

## Puesta en marcha

1. Instala dependencias: `npm install`
2. Copia `.env.example` a `.env.local` y completa la configuración web de Firebase.
3. En Firebase Console → Authentication → Sign-in method, activa **Email/Password**.
4. En Authentication → Users, crea manualmente las cuentas autorizadas. No hay registro público en la interfaz.
5. En Firestore Database, crea una base de datos.
6. Publica las reglas de `firestore.rules` en Firestore → Rules.
7. En Authentication → Users, copia el UID de la cuenta que será administradora. En Firestore crea un documento en la colección `admins` cuyo ID sea exactamente ese UID, con estos campos:
   - `role` (string): `admin`
   - `active` (boolean): `true`
8. Ejecuta `npm run dev`.

La aplicación solo permite acceder al hub a usuarios cuyo documento `admins/{uid}` existe, tiene `role: "admin"` y no tiene `active: false`. Las reglas de Firestore aplican la misma restricción a los datos; ocultar la interfaz no es la única protección.

## Añadir más administradores

Crea el usuario en Firebase Authentication y luego crea manualmente su documento `admins/{uid}` en Firestore. Nunca concedas el rol desde el navegador. Para revocar el acceso, cambia `active` a `false` o elimina el documento.

## Despliegue

Puedes desplegar el frontend en Firebase Hosting o Vercel. Configura las mismas variables de entorno en el proveedor. Antes de publicar, verifica que las reglas de Firestore estén desplegadas y que solo los administradores previstos tengan documentos en `admins`.

## Notas de seguridad

- No se incluye una cuenta de administrador ni una contraseña en el repositorio.
- `.env.local` está excluido de Git.
- Las claves de configuración web de Firebase identifican el proyecto; la autorización real depende de Authentication y de las reglas de Firestore.
- Revisa también los límites de cuota y la configuración de dominios autorizados en Firebase Authentication.
