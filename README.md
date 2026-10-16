# Our Memories - Digital Scrapbook ❤️

> **Álbum de recortes interactivo nativo para iOS y Android**, desarrollado con **React Native**, **Expo SDK 52 (Managed Workflow)** y **TypeScript**. Diseñado con animaciones físicas en 3D, gestos táctiles fluidos, estética vintage y persistencia local de fotografías.

---

## 📑 Tabla de Contenidos

1. [Características Principales](#-características-principales)
2. [Demostración y Experiencia de Usuario](#-experiencia-de-usuario-ux)
3. [Estructura del Proyecto](#-estructura-del-proyecto)
4. [Tecnologías y Librerías](#-tecnologías-y-librerías)
5. [Requisitos Previos](#-requisitos-previos)
6. [Instalación y Modo Desarrollo](#-instalación-y-modo-desarrollo)
7. [Guía de Compilación con EAS Build](#-guía-de-compilación-con-eas-build)
   - [Compilar APK para Android (Instalable directo)](#1-compilar-archivo-apk-para-android-instalable-directo)
   - [Compilar AAB para Google Play Store](#2-compilar-aab-para-google-play-store)
   - [Compilar para iOS (Ad-Hoc, Simulador y App Store)](#3-compilar-para-ios)
8. [Scripts Disponibles](#-scripts-disponibles)
9. [Permisos y Seguridad](#-permisos-y-seguridad)
10. [Licencia](#-licencia)

---

## ✨ Características Principales

- 📖 **Portada 3D Realista**: Tapa dura vintage estilo cuero borgoña con sellado en pan de oro, relieves, textura de papel, lomo cosido y animación fluida de apertura/cierre de libro con perspectiva 3D (`react-native-reanimated`).
- 🪄 **Hojeado volumétrico ("efecto grimorio")**: al abrir el libro y al cambiar de pliego varias hojas con grosor real despegan del lomo en cascada (retraso escalonado), se curvan en el aire como papel de alto gramaje y caen con un ligero rebote. El libro abierto reposa inclinado sobre la mesa, con bloques de hojas escalonados cuyo grosor crece según las páginas de cada lado.
- 🖼️ **Collage & Marcos Fotográficos Retro**:
  - **Página A (Izquierda)**:
    - *Ventana de Navegador Web Retro*: Controles clásicos de ventana (`close`, `minimize`, `zoom`) y barra de título vintage.
    - *Reproductor de Música Vintage*: Carátula de disco, barra de progreso y botones decorativos.
    - *Ticket / Pase de Abordaje*: Formato horizontal con código de barras en vector SVG y detalles postales.
  - **Página B (Derecha)**:
    - *Tira de Negativos de 35mm*: 5 marcos de película vertical con perforaciones auténticas de carrete analógico.
    - *Gran Polaroid Clásica*: Marco fotográfico ancho con textura realista de papel instantáneo.
- 🎨 **Ilustraciones y Stickers Vectoriales SVG**:
  - Ramilletes botánicos y flores secas de azahar.
  - Querubín renacentista en trazo vintage.
  - Sellos de amor y corazones en acuarela.
  - Cintas adhesivas semi-transparentes (*Washi tape*) con textura orgánica.
  - Lomo central con costuras doradas y sombras de pliegue de libro físico.
- 🔍 **Cámara Interactiva y Gestos Multitáctiles**:
  - **Zoom & Pan**: Pellizcar para hacer zoom (*Pinch to zoom*) y desplazamiento libre con amortiguación elástica suave (`react-native-gesture-handler`).
  - **Zonas de Enfoque Rápido**: Botones flotantes para enfocar al instante la **Página A**, la **Página B**, la **Vista Doble Pliego** o el **Modo Panorámico 90°**.
  - **Doble Toque**: Alterna el nivel de ampliación entre vista general y detalle.
- 💾 **Persistencia Local Segura**:
  - Selección de fotos directamente de la galería con `expo-image-picker`.
  - Las fotos elegidas se copian a un directorio aislado y seguro de la app (`FileSystem.documentDirectory/scrapbook_photos/`), garantizando que se conserven aunque se borren de la galería.
  - Estado del álbum persistido de forma permanente con `AsyncStorage`.
- 📚 **Álbum Multi-Pliego Extensible**:
  - Botón para **añadir nuevos pliegos** dinámicamente (`+`), incrementando el total de páginas (ej. Pliego 1 = Páginas 1 y 2, etc.).
  - Navegación bidireccional entre pliegos (`◀ Anterior` / `Siguiente ▶`).
- 📤 **Captura en Alta Resolución y Compartir**:
  - Generación de capturas fotográficas PNG en resolución completa mediante `react-native-view-shot`.
  - Menú de compartir nativo integrado con `expo-sharing` (WhatsApp, Instagram, AirDrop, etc.).
- 🔄 **Restauración de Recuerdos**:
  - Opción en el menú de ajustes para restaurar todas las imágenes al collage romántico original curado de Unsplash.

---

## 📱 Experiencia de Usuario (UX)

```
[ Vista Cerrada ]
      ┌─────────────────────────┐
      │   OUR MEMORIES (3D)     │  ---> Tocar la portada o el botón
      │      [Corazón Oro]      │       abre suavemente el libro
      └─────────────────────────┘
                   │
                   ▼
[ Vista Abierta: Doble Pliego ]
  ┌───────────────────────────┬───────────────────────────┐
  │         PÁGINA A          │         PÁGINA B          │
  │  ┌──────────┐ ┌────────┐  │  ┌──────┐                 │
  │  │ Navegador│ │Música  │  │  │Film 1│  ┌───────────┐  │
  │  │  Retro   │ │ Retro  │  │  ├──────┤  │           │  │
  │  └──────────┘ └────────┘  │  │Film 2│  │  Polaroid │  │
  │  ┌─────────────────────┐  │  ├──────┤  │   Grande  │  │
  │  │   Ticket Vintage    │  │  │Film 3│  │           │  │
  │  └─────────────────────┘  │  └──────┘  └───────────┘  │
  └───────────────────────────┴───────────────────────────┘
               ▲
               │ (Controles inferiores flotantes)
   [ Cerrar ]  [ Foco A ]  [ Vista Pliego ]  [ Foco B ]  [ Rotar 90° ]
```

---

## 📂 Estructura del Proyecto

```text
our-memories-scrapbook/
├── App.tsx                           # Componente raíz: orquestador de estado, navegación y UI global
├── app.json                          # Configuración de Expo (permisos, plugins, nueva arquitectura)
├── eas.json                          # Perfiles de compilación para EAS Build (APK, AAB, IPA)
├── babel.config.js                   # Configuración de Babel con plugin Reanimated
├── package.json                      # Dependencias del proyecto y scripts
├── tsconfig.json                     # Configuración de TypeScript
├── .gitignore                        # Reglas de exclusión para Git (node_modules, binarios, caches)
└── src/
    ├── components/
    │   ├── book3d/
    │   │   ├── engine.ts             # Motor 3D: proyección, hojas segmentadas con grosor y curvatura
    │   │   └── LeafFace.tsx          # Cara proyectada de una hoja (anverso, reverso o canto)
    │   ├── BookCover3D.tsx           # Portada 3D del álbum con perspectiva, lomo y animación
    │   ├── InteractiveBookViewport.tsx # Viewport táctil (Pinch, Pan, botones de cámara y zoom)
    │   ├── PageFlipOverlay.tsx       # Hojeado en cascada entre pliegos (efecto abanico)
    │   ├── ScrapbookSpread.tsx       # Pliego doble con marcos fotográficos y stickers retro
    │   └── StickersAndVectors.tsx    # Gráficos SVG (cintas washi, flores secas, querubín, lomo)
    ├── constants/
    │   └── defaultData.ts            # Imágenes por defecto en Unsplash, etiquetas y dimensiones fijas
    ├── services/
    │   └── storageService.ts         # Servicio de persistencia (AsyncStorage y FileSystem)
    └── types/
        └── scrapbook.ts              # Definición de tipos TypeScript (PhotoSlotKey, Pliegos, etc.)
```

---

## 🛠️ Tecnologías y Librerías

| Herramienta / Librería | Versión | Propósito |
| :--- | :--- | :--- |
| **React Native** | `0.76.3` | Framework móvil base (con **New Architecture** activada) |
| **Expo** | `~52.0.0` | Ecosistema y herramientas de desarrollo móvil |
| **TypeScript** | `^5.3.3` | Tipado estático y mantenibilidad del código |
| **react-native-reanimated** | `~3.16.1` | Animaciones 60/120 FPS basadas en el hilo de UI nativo |
| **react-native-gesture-handler** | `~2.20.2` | Reconocimiento de gestos táctiles continuos (Pinch, Pan, Tap) |
| **react-native-svg** | `15.8.0` | Renderizado de elementos gráficos vectoriales de alta definición |
| **react-native-view-shot** | `4.0.3` | Captura de vistas en imágenes PNG en alta definición |
| **expo-image-picker** | `~16.0.3` | Acceso a la galería de imágenes del teléfono |
| **expo-file-system** | `~18.0.4` | Almacenamiento y copia local permanente de archivos |
| **@react-native-async-storage/async-storage** | `1.23.1` | Persistencia del estado del álbum y de los pliegos |
| **expo-sharing** | `~13.0.0` | Invocación del menú nativo de compartir del sistema |
| **expo-linear-gradient** | `~14.0.1` | Degradados visuales de fondo |

---

## 📋 Requisitos Previos

1. **Node.js**: Versión LTS recomendada (`v18.x` o `v20.x`).
2. **NPM** o **Yarn** para la gestión de dependencias.
3. **Expo Go**: Aplicación instalada en tu teléfono físico ([Android en Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent) o [iOS en App Store](https://apps.apple.com/app/expo-go/id982107779)).
4. **EAS CLI** (opcional, para compilar instalables `.apk` / `.ipa`):
   ```bash
   npm install -g eas-cli
   ```

---

## 🚀 Instalación y Modo Desarrollo

### 1. Instalar Dependencias

Desde la raíz del proyecto (`our-memories-scrapbook`), ejecuta:

```bash
npm install
```

### 2. Iniciar el Servidor de Desarrollo

Inicia Metro Bundler limpiando la caché de Babel (recomendado para inicializar correctamente el plugin de Reanimated):

```bash
npx expo start -c
```

### 3. Ejecutar en tu Dispositivo

- **Android (Físico)**: Abre la aplicación **Expo Go** y escanea el código QR que aparece en la terminal.
- **iOS (Físico)**: Abre la aplicación de **Cámara** nativa de iOS, enfoca el código QR de la terminal y pulsa en la notificación para abrirlo en **Expo Go**.
- **Emulador / Simulador**:
  - Presiona `a` en la terminal para iniciar en el emulador de Android.
  - Presiona `i` en la terminal para iniciar en el simulador de iOS (requiere macOS con Xcode).

---

## 📦 Guía de Compilación con EAS Build

El proyecto cuenta con perfiles preconfigurados en `eas.json` para generar archivos de instalación autónomos que no dependen de Expo Go.

### Paso Inicial: Autenticación en EAS

Si aún no has iniciado sesión en Expo Application Services:

```bash
eas login
```

*(Si es un proyecto nuevo en tu cuenta de Expo, vincula el proyecto ejecutando `eas init`).*

---

### 1. Compilar archivo `.apk` para Android (Instalable directo)

Genera un instalable universal `.apk` listo para distribuir o instalar directamente en cualquier teléfono Android:

```bash
npm run build:apk
```
*O con el comando directo de EAS:*
```bash
eas build -p android --profile preview
```

> **¿Qué sucede al terminar?**  
> EAS mostrará en la terminal un enlace de descarga y un código QR. Puedes abrir el enlace en tu navegador o escanear el QR desde tu móvil para descargar el archivo e instalarlo al instante.

---

### 2. Compilar `.aab` para Google Play Store

Para publicar en la tienda oficial de Google Play:

```bash
eas build -p android --profile production
```

Genera un archivo **Android App Bundle (.aab)** con optimización de recursos y firma de producción.

---

### 3. Compilar para iOS

#### Opción A — Simulador de iOS (Pruebas en Mac sin cuenta de pago Apple Developer)
```bash
eas build -p ios --profile ios-simulator
```
Genera un archivo empaquetado `.tar.gz` que contiene la app compilada para arrastrar directamente al simulador de Xcode.

#### Opción B — Dispositivos físicos iOS (Distribución Ad-Hoc interna)
Requiere registrar previamente el identificador UDID de los dispositivos de prueba:
```bash
eas device:create
npm run build:ipa
```

#### Opción C — Producción para TestFlight / App Store
```bash
eas build -p ios --profile production
```

---

## ⌨️ Scripts Disponibles

| Comando | Acción |
| :--- | :--- |
| `npm start` | Inicia el servidor de desarrollo de Expo |
| `npm run android` | Inicia el servidor y se conecta automáticamente a un dispositivo/emulador Android |
| `npm run ios` | Inicia el servidor y se conecta automáticamente al simulador de iOS |
| `npm run build:apk` | Compila en la nube el archivo `.apk` instalable para Android mediante EAS |
| `npm run build:ipa` | Compila en la nube el archivo `.ipa` para distribución Ad-Hoc en iOS mediante EAS |
| `npm run bake-art` | Regenera los PNG de `assets/baked` (texturas y stickers) a partir de sus SVG. Ejecútalo tras cambiar `src/components/art/TextureSVG.tsx` o `src/components/StickersAndVectors.tsx` |

---

## 🔒 Permisos y Seguridad

En [app.json](app.json) se encuentran configurados los permisos nativos requeridos:

- **Android**:
  - `READ_MEDIA_IMAGES` y `READ_EXTERNAL_STORAGE`: Necesarios para que el usuario pueda seleccionar fotografías desde su biblioteca.
- **iOS**:
  - `NSPhotoLibraryUsageDescription`: Mensaje explicativo mostrado al usuario al solicitar acceso para elegir fotos en los marcos del álbum.
  - `NSPhotoLibraryAddUsageDescription`: Permiso para guardar capturas y exportaciones en el carrete de fotos.

Las fotos personalizadas **se almacenan localmente** en el dispositivo del usuario (`FileSystem.documentDirectory`) y nunca se envían a servidores de terceros sin el consentimiento del usuario.

---

## 📄 Licencia

Este proyecto es de uso privado y personal. Diseñado con ❤️ para la creación de recuerdos memorables.