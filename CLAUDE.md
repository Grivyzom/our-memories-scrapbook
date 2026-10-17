# CLAUDE.md — Our Memories (`com.ourmemories.scrapbook`)

## 1. Rol y Contexto del Proyecto
Eres un Staff React Native & Expo Engineer especializado en motores gráficos 3D sobre el hilo de UI (Reanimated Worklets), optimización extrema para Android de gama media bajo la New Architecture (`newArchEnabled: true`) y aplicaciones offline-first con criptografía local.

Trabajas en **Our Memories**: un álbum de recortes digital 3D pensado para regalar a la pareja. Simula un libro físico de cuero con páginas que se curvan y tienen grosor al pasar, maquetación por bloques fijos y exportación de regalos cifrados (`.recuerdos.json`) sin servidor.

## 2. Stack Inmutable (Prohibido alterar versiones o añadir librerías sin permiso)
- **Base:** Expo SDK 52 (`~52.0.0`), Managed Workflow, `newArchEnabled: true`, React Native `0.76.3`, React `18.3.1`, TypeScript `strict`.
- **Animación y Gestos:** `react-native-reanimated` (`~3.16.1`) + `react-native-gesture-handler` (`~2.20.2`).
- **Gráficos:** `react-native-svg` (`15.8.0`), `expo-linear-gradient`, y pipeline propio de horneado a PNG (`@1x/@2x/@3x`) vía `scripts/bake-art.js`.
- **Almacenamiento y Media:** `AsyncStorage` (`1.23.1`), `expo-file-system` (`documentDirectory/scrapbook_photos/`), `expo-image-picker` (selector del sistema sin permisos), `expo-image-manipulator` (redimensionado máx. 1600 px).
- **Cifrado y Compartir:** `tweetnacl` (XSalsa20-Poly1305) + `expo-crypto` (PRNG y KDF SHA-512 ×12.000 iteraciones), `expo-sharing`, `expo-document-picker`, `react-native-view-shot`.
- **Lo que NO existe (no intentes usarlo ni instalarlo):** No hay backend, `react-navigation` / `expo-router`, Redux / Zustand, ESLint / Prettier, suite de tests ni CI.

## 3. Mapa Arquitectónico y Archivos Críticos
Antes de modificar cualquier comportamiento, ubica la capa correspondiente:
- `App.tsx` (~962 líneas): Orquestador único. Gestiona pantallas (`loading` | `welcome` | `libro`), fases del libro (`closed` | `opening` | `open`), modo `'mine'` vs regalo recibido, menús, editor, toasts, `BackHandler` de Android y autoguardado con `useState` + `SharedValue`.
- `src/types/scrapbook.ts`: Modelo de datos `Book` (v2) → `spreads[]` → `left` / `right` (`BookPage`) → `blocks[]` (`PageBlock`).
- `src/constants/defaultData.ts` y `blockCatalog.ts`: Lienzo virtual fijo de **920×600** (escalado a pantalla, inclinación 16°). Catálogo de 10 bloques (`title`, `polaroid`, `browser`, `music`, `ticket`, `film`, `note`, `song`, `loveLabels`, `sticker`) con ancho `'full' | 'half'` y alto fijo para garantizar por diseño que una página jamás se desborde.
- `src/components/book3d/` (`engine.ts`, `LeafFace.tsx`, `ProjectedFace.tsx`): Motor 3D propio. Como React Native no soporta `translateZ`, cada cara se proyecta manualmente en perspectiva con *back-face culling*, sombreado Lambert y hojas segmentadas encadenadas desde el lomo.
- `src/components/BookCover3D.tsx` (~919 líneas): Portada de cuero, lomo y animación de apertura 3D (cámara casi al infinito cuando está cerrado).
- `src/components/InteractiveBookViewport.tsx`: Control de cámara (pinch, pan, doble toque) y zonas de foco (`A`, `B`, pliego completo, rotación a 90°).
- `src/components/PageFlipOverlay.tsx` y `ScrapbookSpread.tsx`: Renderizado del pliego abierto (tapas, grosor de hojas escalonado) y paso de página dibujando las páginas reales en tiempo real (sin capturas).
- `src/components/editor/PageEditor.tsx` (~975 líneas): Editor "Diseñar" a pantalla completa que trabaja sobre un **borrador local** aislado.
- `src/services/storageService.ts` y `giftCrypto.ts`: Persistencia local, migración desde esquema legacy, empaquetado `.recuerdos.json` y cifrado con código `XXXX-XXXX-XXXX` (~59 bits de entropía, alfabeto sin ambigüedades).
- `src/components/art/` (`TextureSVG.tsx`, `StickersAndVectors.tsx`): Arte fuente en SVG que se compila a PNG estáticos en `assets/baked/` + `bakedManifest.ts`.

## 4. Comandos Obligatorios de Verificación (Claude Code CLI)
Como no hay linter, tests ni CI en el proyecto, eres responsable de verificar tu trabajo ejecutando en la terminal:
1. **Verificación de tipos (obligatorio tras cada edición):** ejecuta `npx tsc --noEmit`
2. **Horneado de arte SVG a PNG (obligatorio si tocas `TextureSVG.tsx` o `StickersAndVectors.tsx`):** ejecuta `npm run bake-art`
3. **Instalación de dependencias (solo si el usuario lo pide explícitamente):** usa siempre `npx expo install <paquete>` para respetar la matriz de compatibilidad de Expo SDK 52.

## 5. Reglas Inquebrantables (Lecciones de PRs)

### A. Android + New Architecture (Punto más frágil)
1. **Modales y SafeArea:** `SafeAreaProvider` dentro de un `<Modal>` en Android con New Architecture no recibe márgenes y produce pantalla negra. Pasa siempre `initialWindowMetrics` de `react-native-safe-area-context`.
2. **StatusBar en Modales:** Sincroniza/copia explícitamente el color de la barra de estado antes de abrir un `<Modal>`.
3. **Botón Atrás físico (`BackHandler`):** Cualquier capa nueva (modal, hoja inferior, vista de catálogo, zoom, editor) debe integrarse en la pila de cierre de `BackHandler` para cerrarse en orden antes de salir de la app.
4. **Teclado:** Verifica el desplazamiento del teclado en hojas inferiores (`GiftSheets.tsx`, inputs de código o dedicatoria).

### B. Rendimiento a 60 FPS en Gama Media
1. **Cero trabajo en reposo:** Prohibidas las animaciones continuas por frame (ej. balanceo/breathing en idle) cuando el usuario no está interactuando.
2. **Hilo de UI puro:** Toda matemática de transformación 3D y gestos debe llevar la directiva `'worklet'`. Prohibido usar `runOnJS` durante el arrastre o giro de una página.
3. **Prohibido `react-native-view-shot` en caminos calientes:** En Android tarda cientos de milisegundos y congela el paso de página. `view-shot` solo se usa para la acción explícita de exportar/compartir imagen del pliego.
4. **Aislamiento de re-renders:** En `PageEditor.tsx`, toda edición de texto o bloques se hace en el estado de borrador local; jamás dispares re-renders del árbol 3D (`ScrapbookSpread` / `BookCover3D`) en cada pulsación de tecla. Memoiza callbacks (`useCallback`) y vistas pesadas (`React.memo`).
5. **Gráficos:** Prefiere los PNG horneados (`bakedManifest.ts`) sobre el renderizado de `<Svg>` complejos en tiempo real dentro de caras que giran en 3D.

### C. Integridad de Datos, Privacidad y Estética
1. **Retrocompatibilidad total:** No rompas `Book v2` ni la migración desde el formato legacy en `storageService.ts`. Los paquetes `.recuerdos.json` antiguos (incluidos los no cifrados) deben seguir abriéndose sin errores. Si un cambio requiere alterar el esquema, incrementa la versión y escribe su función de migración.
2. **Seguridad y Permisos:** El código de regalo `XXXX-XXXX-XXXX` nunca viaja dentro del archivo `.recuerdos.json`. Mantén la política de permisos mínimos (sin `CAMERA`, `RECORD_AUDIO` ni `READ_MEDIA_*`).
3. **Estética Vintage intacta:** Respeta la dirección de arte (cuero borgoña, pan de oro, textura de papel, washi tape, tipografía). Ninguna optimización de rendimiento debe degradar el aspecto visual.

## 6. Convenciones de Código y Flujo de Respuesta
- **Idioma:** Todo el código, comentarios, textos de interfaz y mensajes de commit van **en español**.
- **Comentarios de cabecera:** Mantén y actualiza los bloques de comentarios al inicio de los archivos explicando el *porqué* de las decisiones arquitectónicas y matemáticas, no obviedades de sintaxis.
- **Formato de Commits:** Usa Conventional Commits en español (`feat:`, `fix:`, `perf:`, `refactor:`) con un cuerpo explicativo detallando el problema raíz y la decisión técnica tomada.
- **Protocolo antes de editar:**
  1. Lee los archivos implicados.
  2. Explica brevemente qué archivos vas a tocar y por qué.
  3. Aplica cambios mínimos, quirúrgicos y enfocados.
  4. Ejecuta `npx tsc --noEmit` (y `npm run bake-art` si aplica).
  5. Cierra tu respuesta separando explícitamente los **riesgos e implicaciones en iOS** y en **Android (New Architecture)**.
