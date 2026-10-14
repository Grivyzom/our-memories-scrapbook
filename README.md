# Our Memories - Digital Scrapbook ❤️

Aplicación móvil nativa para iOS y Android desarrollada con **React Native + Expo (Managed Workflow)** y **TypeScript**. Diseñada como un álbum de recortes interactivo en 3D con persistencia local de fotografías.

---

## 1. Requisitos Previos

- **Node.js** (v18 LTS o v20 LTS recomendado)
- **Expo CLI / EAS CLI** instalado globalmente:
  ```bash
  npm install -g eas-cli
  ```

- Aplicación **Expo Go** instalada en tu teléfono iOS o Android para pruebas rápidas en tiempo real.

---

## 2. Instalación y Prueba en Expo Go

1. Crea la carpeta del proyecto, copia los archivos de acuerdo con la estructura indicada e instala las dependencias:
```bash
npm install
```

2. Inicia el servidor de desarrollo de Expo limpiando la caché de Babel (necesario para el plugin de `react-native-reanimated`):
```bash
npx expo start -c
```

3. Escanea el código QR desde la cámara (iOS) o desde la app **Expo Go** (Android).

---

## 3. Compilación de Instalables `.apk` (Android) e `.ipa` (iOS) con EAS

### Paso 1: Iniciar sesión y vincular el proyecto con EAS

```bash
eas login
eas init
```

*(Este comando actualizará automáticamente el campo `extra.eas.projectId` dentro de tu `app.json`).*

### Paso 2: Generar archivo `.apk` instalable directo para Android

El perfil `preview` en `eas.json` ya incluye `"buildType": "apk"`. Ejecuta:

```bash
eas build -p android --profile preview
```

Al finalizar la compilación en los servidores de Expo, recibirás un enlace directo y un código QR para descargar e instalar el archivo `.apk` en cualquier smartphone Android.

### Paso 3: Generar archivo `.ipa` para iOS

- **Opción A — Dispositivos físicos iOS (Distribución interna Ad-Hoc `.ipa`):**
Requiere cuenta de Apple Developer para registrar el UDID de tus dispositivos:
```bash
eas device:create
eas build -p ios --profile preview
```

- **Opción B — Compilación para Simulador de iOS (sin cuenta de pago de Apple):**
```bash
eas build -p ios --profile ios-simulator
```

- **Opción C — Compilación `.ipa` para TestFlight / App Store:**
```bash
eas build -p ios --profile production
```
