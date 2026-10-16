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
- 🪄 **Hojeado volumétrico ("efecto grimorio")**: al abrir el libro y al cambiar de pliego varias hojas con grosor real despegan del lomo en cascada (retraso escalonado) y caen con un ligero rebote. Cada hoja es una sola pieza con sombreado de curvatura continuo (sin juntas), y durante la apertura ya muestran las páginas reales del pliego para que el relevo al libro abierto sea un fundido suave. El libro abierto reposa inclinado sobre la mesa, con bloques de hojas escalonados cuyo grosor crece según las páginas de cada lado.
- 🧩 **Libro a tu medida (componentes)**: ningún pliego trae contenido fijo. Desde **Diseñar** eliges qué poner en cada página, en el orden que quieras, a partir de un catálogo:
  - *Título*, *Polaroid*, *Ventana retro*, *Reproductor*, *Ticket vintage*, *Tira de negativos*, *Nuestra canción*, *Nota* de máquina de escribir, *Etiquetas de amor* y *Stickers* (flores secas, rosas, querubín, corazones).
  - Cada componente tiene un tamaño fijo (ancho completo o medio ancho): el editor muestra el espacio usado y sólo ofrece lo que cabe, así la página nunca se desborda.
  - Textos editables, subir/bajar, mover a la otra página, quitar, y fotos por hueco.
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
  - Las fotos de la galería se guardan reducidas (máx. 1600 px) en `FileSystem.documentDirectory/scrapbook_photos/`: cargan más rápido y se conservan aunque se borren de la galería.
  - El libro se guarda automáticamente con `AsyncStorage`. Los álbumes del formato anterior se convierten a componentes sin perder sus fotos.
- 📚 **Pliegos ilimitados**: botón **+ Pliego** para añadir pliegos en blanco, eliminar pliegos y navegar entre ellos con el paso de página.
- 🎁 **Pensado para regalar**:
  - Al abrir la app por primera vez se elige qué hacer: *Crear un regalo* (se pregunta para quién es y su nombre aparece en la portada) o *Abrir un regalo*. Quien ya tiene un libro empezado puede seguir con él, y quien recibió uno vuelve directo a verlo.
  - Los pliegos se añaden con el libro abierto: en el último pliego el botón *siguiente* se convierte en **+**.
  - *Regalar* envuelve el libro: genera un **código secreto** (`XXXX-XXXX-XXXX`) y un único archivo `.recuerdos.json` **cifrado** con él (XSalsa20-Poly1305 con `tweetnacl`; la clave sale del código con SHA-512 iterado). El archivo se envía por WhatsApp, correo, AirDrop… y el código se le da a la pareja aparte, mejor en persona.
  - Sin el código el archivo no deja ver nada, aunque se reenvíe o quede en un chat. El código no viaja dentro del archivo y no hace falta ningún servidor. Si el libro cambia se vuelve a enviar con el mismo código.
  - Quien lo recibe toca *Abrir un regalo*, elige el archivo y escribe el código: lo ve en modo sólo lectura, con su portada y paso de página. Los libros sin cifrar de versiones anteriores se siguen abriendo.
  - *Compartir imagen de este pliego*: captura PNG en alta resolución (`react-native-view-shot`).

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
    │   ├── PageFlipOverlay.tsx       # Paso de página con una hoja continua (sin juntas)
    │   ├── ScrapbookSpread.tsx       # Pliego doble: tapas, bloques de hojas y las dos páginas
    │   ├── blocks/                   # Componentes que el usuario coloca en las páginas
    │   └── editor/PageEditor.tsx     # Editor de pliego: catálogo, orden, textos y fotos
    │   └── StickersAndVectors.tsx    # Gráficos SVG (cintas washi, flores secas, querubín, lomo)
    ├── constants/
    │   ├── blockCatalog.ts           # Catálogo de componentes, tamaños y cálculo de espacio
    │   └── defaultData.ts            # Libro/pliego en blanco y dimensiones del pliego
    ├── services/
    │   └── storageService.ts         # Servicio de persistencia (AsyncStorage y FileSystem)
    └── types/
        └── scrapbook.ts              # Tipos: libro, pliegos, páginas y componentes
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