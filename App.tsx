import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  SafeAreaView,
  StatusBar as RNStatusBar,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  cancelAnimation,
  withDelay,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { captureRef as captureViewRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import { createEmptyBook, createEmptySpread } from './src/constants/defaultData';
import { Book, PageSide, ScrapbookSpreadData } from './src/types/scrapbook';
import {
  exportBookPackage,
  importBookPackage,
  loadBook,
  loadReceivedBook,
  pickAndPersistPhoto,
  resetBook,
  saveBook,
} from './src/services/storageService';
import { BookCover3D } from './src/components/BookCover3D';
import {
  InteractiveBookViewport,
  SpreadNavRequest,
} from './src/components/InteractiveBookViewport';
import { PageEditor } from './src/components/editor/PageEditor';
import { ActionSheet, ActionSheetItem } from './src/components/ui/ActionSheet';
import { Toast, ToastMessage } from './src/components/ui/Toast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Fases del libro. El visor y la portada conviven durante la apertura y el
 * cierre para que el relevo entre ambos sea un fundido en pleno movimiento y
 * no un cambio brusco al final.
 */
type BookPhase = 'closed' | 'opening' | 'open' | 'closing';
type ViewMode = 'mine' | 'received';

// Coreografía de la apertura (ms). La portada avanza de forma lineal y cada
// hoja aplica su propia curva; el visor aparece mientras caen las últimas.
const OPEN_MS = 1550;
const VIEWPORT_FADE_IN_START = OPEN_MS * 0.62;
const VIEWPORT_FADE_IN_MS = OPEN_MS * 0.22;
const COVER_FADE_OUT_START = OPEN_MS * 0.84;
const COVER_FADE_OUT_MS = 300;
// Cierre: la portada aparece sobre el visor (ya en su encuadre) y baja la tapa
const COVER_FADE_IN_MS = 260;
const VIEWPORT_FADE_OUT_MS = 220;
const CLOSE_MS = 1100;
const SAVE_DEBOUNCE_MS = 400;

export default function App() {
  const [book, setBook] = useState<Book>(createEmptyBook);
  const [receivedBook, setReceivedBook] = useState<Book | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [activeSpreadIndex, setActiveSpreadIndex] = useState(0);
  const [phase, setPhase] = useState<BookPhase>('closed');
  const phaseRef = useRef<BookPhase>('closed');
  phaseRef.current = phase;
  const loaded = useRef(false);

  const isReadOnly = viewMode === 'received' && receivedBook !== null;
  const displayedBook = isReadOnly ? receivedBook! : book;
  const spreads = displayedBook.spreads;
  const isBookOpen = phase === 'open';

  // Peticiones de navegación al visor: siempre pasan por la animación de página
  const [navRequest, setNavRequest] = useState<SpreadNavRequest | null>(null);
  const navCounter = useRef(0);
  const requestSpread = (index: number) => {
    navCounter.current += 1;
    setNavRequest({ id: navCounter.current, index });
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [editor, setEditor] = useState<{ visible: boolean; side: PageSide }>({
    visible: false,
    side: 'left',
  });
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastCounter = useRef(0);
  const showToast = (text: string, icon?: IconName) => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, text, icon });
  };

  const openProgress = useSharedValue(0);
  const [isCoverMounted, setIsCoverMounted] = useState(true);
  const coverOpacity = useSharedValue(1);
  const viewportOpacity = useSharedValue(0);
  const coverOverlayStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.value }));
  const viewportStyle = useAnimatedStyle(() => ({ opacity: viewportOpacity.value }));
  const scrapbookCaptureRef = useRef<View>(null);
  // Acciones que esperan a que termine una animación del libro
  const openEditorWhenOpen = useRef(false);
  const pendingViewMode = useRef<ViewMode | null>(null);

  useEffect(() => {
    (async () => {
      const [saved, received] = await Promise.all([loadBook(), loadReceivedBook()]);
      setBook(saved);
      setReceivedBook(received);
      loaded.current = true;
    })();
  }, []);

  // Guardado automático (agrupa las ediciones seguidas, p. ej. al escribir)
  useEffect(() => {
    if (!loaded.current) return;
    const timer = setTimeout(() => saveBook(book), SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [book]);

  const safeIndex = Math.min(activeSpreadIndex, spreads.length - 1);
  const currentSpread = spreads[safeIndex];

  const updateSpread = (index: number, spread: ScrapbookSpreadData) =>
    setBook((prev) => ({
      ...prev,
      spreads: prev.spreads.map((sp, i) => (i === index ? spread : sp)),
    }));

  /* ==================== ABRIR Y CERRAR ==================== */

  const handleBookOpened = () => {
    setPhase('open');
    phaseRef.current = 'open';
    setIsCoverMounted(false);
    if (pendingViewMode.current) {
      // Se pidió cambiar de libro durante la apertura: se cierra y se cambia
      openEditorWhenOpen.current = false;
      handleCloseBook();
      return;
    }
    if (openEditorWhenOpen.current) {
      openEditorWhenOpen.current = false;
      setEditor({ visible: true, side: 'left' });
    }
  };

  const handleOpenBook = () => {
    if (phaseRef.current !== 'closed') return;
    setPhase('opening');
    phaseRef.current = 'opening';
    // El visor se monta ya, invisible bajo la portada, y aparece mientras caen las hojas
    viewportOpacity.value = 0;
    viewportOpacity.value = withDelay(
      VIEWPORT_FADE_IN_START,
      withTiming(1, { duration: VIEWPORT_FADE_IN_MS, easing: Easing.out(Easing.quad) })
    );
    coverOpacity.value = 1;
    coverOpacity.value = withDelay(
      COVER_FADE_OUT_START,
      withTiming(0, { duration: COVER_FADE_OUT_MS, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) runOnJS(handleBookOpened)();
      })
    );
    openProgress.value = withTiming(1, { duration: OPEN_MS, easing: Easing.linear });
  };

  const handleBookClosed = () => {
    setPhase('closed');
    phaseRef.current = 'closed';
    setNavRequest(null);
    const pending = pendingViewMode.current;
    if (pending) {
      pendingViewMode.current = null;
      setViewMode(pending);
      setActiveSpreadIndex(0);
    }
  };

  const lowerCover = () => {
    viewportOpacity.value = withTiming(0, { duration: VIEWPORT_FADE_OUT_MS });
    openProgress.value = withTiming(
      0,
      { duration: CLOSE_MS, easing: Easing.inOut(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(handleBookClosed)();
      }
    );
  };

  // 1) El visor recoloca la cámara; 2) la portada abierta aparece encima con las
  // mismas páginas; 3) la tapa baja. El libro nunca "desaparece".
  const handleReadyToClose = () => {
    cancelAnimation(coverOpacity);
    coverOpacity.value = withTiming(1, { duration: COVER_FADE_IN_MS }, (finished) => {
      if (finished) runOnJS(lowerCover)();
    });
  };

  const handleCloseBook = () => {
    if (phaseRef.current !== 'open') return;
    setPhase('closing');
    phaseRef.current = 'closing';
    setEditor((e) => ({ ...e, visible: false }));
    // Se monta ya (invisible) para que sus fotos carguen mientras la cámara se recoloca
    coverOpacity.value = 0;
    openProgress.value = 1;
    setIsCoverMounted(true);
  };

  /* ==================== NAVEGACIÓN Y EDICIÓN ==================== */

  // El visor llama aquí cuando la hoja ya tapa el pliego que se abandona
  const handleGoToSpread = (index: number) => {
    if (index >= 0 && index < spreads.length) {
      setActiveSpreadIndex(index);
    }
  };

  const openEditor = (side: PageSide = 'left') => {
    if (isReadOnly) return;
    if (phaseRef.current === 'open') {
      setEditor({ visible: true, side });
    } else if (phaseRef.current === 'closed') {
      openEditorWhenOpen.current = true;
      handleOpenBook();
    }
  };

  // Elegir y guardar una foto para un hueco concreto de un componente
  const handlePickPhoto = async (side: PageSide, blockId: string, photoIndex: number) => {
    if (isReadOnly) return;
    const spreadIndex = safeIndex;
    try {
      const localUri = await pickAndPersistPhoto(blockId);
      if (!localUri) return;
      setBook((prev) => ({
        ...prev,
        spreads: prev.spreads.map((sp, i) =>
          i !== spreadIndex
            ? sp
            : {
                ...sp,
                [side]: {
                  blocks: sp[side].blocks.map((b) =>
                    b.id === blockId
                      ? { ...b, photos: b.photos.map((p, k) => (k === photoIndex ? localUri : p)) }
                      : b
                  ),
                },
              }
        ),
      }));
      showToast('Foto actualizada', 'image');
    } catch (error: any) {
      if (error?.message === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permiso requerido',
          'Activa el permiso de galería en los ajustes de tu teléfono para poner tus fotos en el libro.'
        );
      } else {
        Alert.alert('Error', 'No se pudo guardar la foto.');
      }
    }
  };

  // Añadir un pliego en blanco al final del libro
  const handleAddSpread = () => {
    if (isReadOnly) return;
    const newIndex = book.spreads.length;
    const updated = { ...book, spreads: [...book.spreads, createEmptySpread(newIndex + 1)] };
    setBook(updated);

    if (phaseRef.current === 'open') {
      // Con el libro abierto se pasa de página hasta el pliego nuevo
      requestSpread(newIndex);
    } else if (phaseRef.current === 'closed') {
      setActiveSpreadIndex(newIndex);
      handleOpenBook();
    }
    const pages = updated.spreads.length * 2;
    showToast(`Pliego ${newIndex + 1} añadido · págs. ${pages - 1}–${pages}`, 'add-circle-outline');
  };

  const handleDeleteSpread = () => {
    if (isReadOnly || book.spreads.length <= 1) return;
    const index = safeIndex;
    Alert.alert('Eliminar pliego', `¿Eliminar el pliego ${index + 1} y todo su contenido?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setBook((prev) => ({ ...prev, spreads: prev.spreads.filter((_, i) => i !== index) }));
          setActiveSpreadIndex(Math.max(0, index - 1));
          showToast('Pliego eliminado', 'trash-outline');
        },
      },
    ]);
  };

  // Empezar de cero (acción destructiva: se confirma)
  const handleResetBook = () => {
    Alert.alert(
      'Empezar un libro nuevo',
      'Se borrarán todas las páginas y fotos de tu libro. ¿Quieres continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            const fresh = await resetBook();
            setBook(fresh);
            setActiveSpreadIndex(0);
            showToast('Libro nuevo listo para llenar', 'sparkles-outline');
          },
        },
      ]
    );
  };

  /* ==================== COMPARTIR ==================== */

  const isExporting = useRef(false);

  // El libro entero en un archivo: se envía por cualquier app y se abre en Our Memories
  const handleShareBook = async () => {
    if (isExporting.current) return;
    isExporting.current = true;
    try {
      showToast('Preparando el libro…', 'hourglass-outline');
      const uri = await exportBookPackage(displayedBook);
      if (!(await Sharing.isAvailableAsync())) {
        showToast('Compartir no está disponible en este dispositivo', 'alert-circle-outline');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: 'Enviar nuestro libro de recuerdos',
      });
    } catch {
      Alert.alert('Error al compartir', 'No fue posible preparar el libro para enviarlo.');
    } finally {
      isExporting.current = false;
    }
  };

  // Captura en imagen del pliego visible
  const handleSharePicture = async () => {
    try {
      if (phaseRef.current !== 'open' || !scrapbookCaptureRef.current) {
        showToast('Abre el cuaderno para compartir un pliego', 'book-outline');
        return;
      }
      const uri = await captureViewRef(scrapbookCaptureRef, { format: 'png', quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Compartir Nuestros Recuerdos' });
      } else {
        showToast('Compartir no está disponible en este dispositivo', 'alert-circle-outline');
      }
    } catch {
      Alert.alert('Error al compartir', 'No fue posible generar la captura del pliego.');
    }
  };

  const switchViewMode = (mode: ViewMode, force = false) => {
    if (mode === viewMode && !force && !pendingViewMode.current) return;
    if (phaseRef.current === 'closed') {
      setViewMode(mode);
      setActiveSpreadIndex(0);
    } else {
      // Se cierra el libro actual y, ya con la tapa bajada, se cambia de libro
      // (si se está abriendo o cerrando, se aplica al terminar esa animación)
      pendingViewMode.current = mode;
      handleCloseBook();
    }
  };

  const handleImportBook = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      showToast('Abriendo el libro…', 'hourglass-outline');
      const imported = await importBookPackage(result.assets[0].uri);
      setReceivedBook(imported);
      switchViewMode('received', true);
      showToast('Libro recibido · toca la portada para abrirlo', 'gift-outline');
    } catch (error: any) {
      Alert.alert(
        'No se pudo abrir',
        error?.message === 'INVALID_PACKAGE'
          ? 'Ese archivo no es un libro de Our Memories.'
          : 'Ocurrió un error al leer el libro recibido.'
      );
    }
  };

  /* ==================== MENÚS ==================== */

  const menuItems: ActionSheetItem[] = [
    ...(isBookOpen
      ? [
          {
            key: 'prev',
            label: 'Pliego anterior',
            icon: 'chevron-back' as IconName,
            disabled: safeIndex === 0,
            onPress: () => requestSpread(safeIndex - 1),
          },
          {
            key: 'next',
            label: 'Pliego siguiente',
            icon: 'chevron-forward' as IconName,
            disabled: safeIndex >= spreads.length - 1,
            onPress: () => requestSpread(safeIndex + 1),
          },
        ]
      : [{ key: 'open', label: 'Abrir el cuaderno', icon: 'book-outline' as IconName, onPress: handleOpenBook }]),
    ...(!isReadOnly
      ? [
          {
            key: 'edit',
            label: 'Diseñar este pliego',
            icon: 'color-palette-outline' as IconName,
            onPress: () => openEditor('left'),
          },
          {
            key: 'add',
            label: 'Añadir pliego en blanco',
            icon: 'add-circle-outline' as IconName,
            onPress: handleAddSpread,
          },
          {
            key: 'delete',
            label: 'Eliminar este pliego',
            icon: 'trash-outline' as IconName,
            destructive: true,
            disabled: !isBookOpen || book.spreads.length <= 1,
            onPress: handleDeleteSpread,
          },
        ]
      : []),
    ...(receivedBook
      ? [
          isReadOnly
            ? {
                key: 'mine',
                label: 'Volver a mi libro',
                icon: 'person-outline' as IconName,
                onPress: () => switchViewMode('mine'),
              }
            : {
                key: 'received',
                label: 'Ver el libro que me enviaron',
                icon: 'gift-outline' as IconName,
                onPress: () => switchViewMode('received'),
              },
        ]
      : []),
    ...(isBookOpen
      ? [{ key: 'close', label: 'Cerrar el cuaderno', icon: 'book-outline' as IconName, onPress: handleCloseBook }]
      : []),
    ...(!isReadOnly
      ? [
          {
            key: 'reset',
            label: 'Empezar un libro nuevo',
            icon: 'refresh' as IconName,
            destructive: true,
            onPress: handleResetBook,
          },
        ]
      : []),
  ];

  const shareItems: ActionSheetItem[] = [
    {
      key: 'book',
      label: isReadOnly ? 'Reenviar este libro' : 'Enviar el libro completo',
      icon: 'paper-plane-outline',
      onPress: handleShareBook,
    },
    {
      key: 'picture',
      label: 'Compartir imagen de este pliego',
      icon: 'image-outline',
      disabled: !isBookOpen,
      onPress: handleSharePicture,
    },
    {
      key: 'import',
      label: 'Abrir un libro que me enviaron',
      icon: 'download-outline',
      onPress: handleImportBook,
    },
  ];

  const dockActions: { key: string; label: string; icon: IconName; onPress: () => void }[] = [
    { key: 'menu', label: 'Opciones', icon: 'ellipsis-horizontal', onPress: () => setIsMenuOpen(true) },
    ...(!isReadOnly
      ? [{ key: 'edit', label: 'Diseñar', icon: 'color-palette-outline' as IconName, onPress: () => openEditor('left') }]
      : []),
    { key: 'share', label: 'Compartir', icon: 'share-outline', onPress: () => setIsShareMenuOpen(true) },
  ];

  const pagesLabel = `${spreads.length} ${spreads.length === 1 ? 'pliego' : 'pliegos'} · ${spreads.length * 2} páginas`;
  const showViewport = phase !== 'closed';

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#3D4B6E', '#56688F', '#7383AD']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientBackground}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* ==================== ENCABEZADO ==================== */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>
              {isReadOnly ? 'Un libro para ti' : 'Nuestros Recuerdos'}
            </Text>
            <View style={styles.headerSubtitleRow}>
              <Ionicons
                name={isReadOnly ? 'gift-outline' : isBookOpen ? 'images-outline' : 'heart'}
                size={13}
                color={isBookOpen || isReadOnly ? 'rgba(255, 255, 255, 0.75)' : '#F2A7AE'}
              />
              <Text style={styles.headerSubtitleText}>
                {isReadOnly
                  ? `Libro recibido · ${pagesLabel}`
                  : isBookOpen
                    ? 'Toca un marco para poner tu foto'
                    : pagesLabel}
              </Text>
            </View>
          </View>

          {/* ==================== ÁREA CENTRAL: PORTADA 3D E INTERIOR ==================== */}
          <View style={styles.stageArea}>
            {showViewport && (
              <Animated.View style={[styles.viewportLayer, viewportStyle]}>
                <InteractiveBookViewport
                  spreads={spreads}
                  activeSpreadIndex={safeIndex}
                  onPressPhoto={isReadOnly ? undefined : handlePickPhoto}
                  onPressEmptyPage={isReadOnly ? undefined : openEditor}
                  onCloseBook={handleCloseBook}
                  captureRef={scrapbookCaptureRef}
                  onGoToSpread={handleGoToSpread}
                  navRequest={navRequest}
                  interactive={phase === 'open'}
                  closing={phase === 'closing'}
                  onReadyToClose={handleReadyToClose}
                />
              </Animated.View>
            )}
            {isCoverMounted && (
              <Animated.View
                style={[styles.coverOverlay, coverOverlayStyle]}
                pointerEvents={phase === 'closed' ? 'auto' : 'none'}
              >
                <BookCover3D
                  openProgress={openProgress}
                  onOpenBook={handleOpenBook}
                  revealSpread={currentSpread}
                  revealIndex={safeIndex}
                  editable={!isReadOnly}
                />
              </Animated.View>
            )}
          </View>

          {/* ==================== DOCK INFERIOR ==================== */}
          <View style={styles.dockWrapper}>
            <View style={styles.dock}>
              {dockActions.map((action) => (
                <Pressable
                  key={action.key}
                  onPress={action.onPress}
                  style={({ pressed }) => [styles.dockItem, pressed && styles.dockItemPressed]}
                  accessibilityLabel={action.label}
                >
                  <Ionicons name={action.icon} size={21} color="#FFFFFF" />
                  <Text style={styles.dockLabel}>{action.label}</Text>
                </Pressable>
              ))}

              {/* Acción principal: añadir pliego (o volver al libro propio) */}
              <Pressable
                onPress={isReadOnly ? () => switchViewMode('mine') : handleAddSpread}
                style={({ pressed }) => [styles.dockPrimary, pressed && styles.dockItemPressed]}
                accessibilityLabel={isReadOnly ? 'Volver a mi libro' : 'Añadir pliego en blanco'}
              >
                <Ionicons name={isReadOnly ? 'person-outline' : 'add'} size={22} color="#2B3654" />
                <Text style={styles.dockPrimaryLabel}>{isReadOnly ? 'Mi libro' : 'Pliego'}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        <Toast message={toast} onHidden={() => setToast(null)} />

        <ActionSheet
          visible={isMenuOpen}
          title={isReadOnly ? 'Libro recibido 🎁' : 'Nuestros Recuerdos ❤️'}
          subtitle={
            isBookOpen
              ? `Pliego ${safeIndex + 1} de ${spreads.length} · Págs. ${safeIndex * 2 + 1}–${safeIndex * 2 + 2}`
              : pagesLabel
          }
          items={menuItems}
          onClose={() => setIsMenuOpen(false)}
        />

        <ActionSheet
          visible={isShareMenuOpen}
          title="Compartir"
          subtitle="Envía el libro a quien se lo dedicas: lo abrirá en Our Memories"
          items={shareItems}
          onClose={() => setIsShareMenuOpen(false)}
        />

        {!isReadOnly && book.spreads[safeIndex] && (
          <PageEditor
            visible={editor.visible}
            spread={book.spreads[safeIndex]}
            spreadIndex={safeIndex}
            initialSide={editor.side}
            onChange={(spread) => updateSpread(safeIndex, spread)}
            onPickPhoto={handlePickPhoto}
            onClose={() => setEditor((e) => ({ ...e, visible: false }))}
          />
        )}
      </LinearGradient>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  gradientBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) + 6 : 8,
    justifyContent: 'space-between',
  },
  headerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 10,
    zIndex: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  headerSubtitleText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.78)',
  },
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewportLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockWrapper: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 16,
    zIndex: 30,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 28,
    backgroundColor: 'rgba(20, 27, 46, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 10,
  },
  dockItem: {
    width: 70,
    paddingVertical: 7,
    borderRadius: 22,
    alignItems: 'center',
    gap: 3,
  },
  dockItemPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.95 }],
  },
  dockLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
  },
  dockPrimary: {
    width: 74,
    paddingVertical: 7,
    borderRadius: 22,
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFFFFF',
    marginLeft: 4,
  },
  dockPrimaryLabel: {
    color: '#2B3654',
    fontSize: 11,
    fontWeight: '700',
  },
});
