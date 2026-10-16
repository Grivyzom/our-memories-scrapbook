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
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { captureRef as captureViewRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

import { DEFAULT_PHOTOS, INITIAL_SPREADS, PHOTO_SLOT_LABELS } from './src/constants/defaultData';
import { PhotoSlotKey, ScrapbookSpreadData } from './src/types/scrapbook';
import {
  clearAllSavedPhotos,
  loadScrapbookState,
  pickAndPersistPhoto,
  saveScrapbookState,
} from './src/services/storageService';
import { BookCover3D } from './src/components/BookCover3D';
import {
  InteractiveBookViewport,
  SpreadNavRequest,
} from './src/components/InteractiveBookViewport';
import { ActionSheet, ActionSheetItem } from './src/components/ui/ActionSheet';
import { Toast, ToastMessage } from './src/components/ui/Toast';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export default function App() {
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [spreads, setSpreads] = useState<ScrapbookSpreadData[]>(INITIAL_SPREADS);
  const [activeSpreadIndex, setActiveSpreadIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(INITIAL_SPREADS.length * 2);

  // Peticiones de navegación al visor: siempre pasan por la animación de página
  const [navRequest, setNavRequest] = useState<SpreadNavRequest | null>(null);
  const navCounter = useRef(0);
  const requestSpread = (index: number) => {
    navCounter.current += 1;
    setNavRequest({ id: navCounter.current, index });
  };

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastCounter = useRef(0);
  const showToast = (text: string, icon?: IconName) => {
    toastCounter.current += 1;
    setToast({ id: toastCounter.current, text, icon });
  };

  const openProgress = useSharedValue(0);
  // La portada abierta queda encima del visor y se funde con él: un único libro
  const [isCoverMounted, setIsCoverMounted] = useState(true);
  const coverOpacity = useSharedValue(1);
  const coverOverlayStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.value }));
  const scrapbookCaptureRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadScrapbookState();
      setSpreads(saved.spreads);
      setTotalPages(Math.max(saved.totalPages, saved.spreads.length * 2));
    })();
  }, []);

  const currentSpread = spreads[activeSpreadIndex] || spreads[0];

  // Progreso lineal: la portada y cada hoja del abanico aplican su propia curva
  // (despegue, vuelo y rebote) dentro de su ventana de tiempo escalonada
  const handleBookOpened = () => {
    // El visor se monta debajo en el mismo encuadre y la portada se desvanece encima
    setIsBookOpen(true);
    coverOpacity.value = withTiming(0, { duration: 380 }, (finished) => {
      if (finished) runOnJS(setIsCoverMounted)(false);
    });
  };

  const handleOpenBook = () => {
    openProgress.value = withTiming(
      1,
      { duration: 1550, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(handleBookOpened)();
      }
    );
  };

  const handleCloseBook = () => {
    cancelAnimation(coverOpacity);
    coverOpacity.value = 1;
    setIsCoverMounted(true);
    setIsBookOpen(false);
    setNavRequest(null);
    openProgress.value = withTiming(0, {
      duration: 1100,
      easing: Easing.inOut(Easing.quad),
    });
  };

  // El visor llama aquí cuando la hoja ya tapa el pliego que se abandona
  const handleGoToSpread = (index: number) => {
    if (index >= 0 && index < spreads.length) {
      setActiveSpreadIndex(index);
    }
  };

  // Subir y persistir foto localmente al tocar cualquier marco
  const handleSelectPhotoSlot = async (slot: PhotoSlotKey) => {
    try {
      const localUri = await pickAndPersistPhoto(currentSpread.id, slot);
      if (!localUri) return;

      const updatedSpreads = spreads.map((sp, idx) =>
        idx === activeSpreadIndex
          ? {
              ...sp,
              photos: {
                ...sp.photos,
                [slot]: localUri,
              },
            }
          : sp
      );

      setSpreads(updatedSpreads);
      await saveScrapbookState(updatedSpreads, totalPages);
      showToast('Foto actualizada', 'image');
    } catch (error: any) {
      if (error?.message === 'PERMISSION_DENIED') {
        Alert.alert(
          'Permiso requerido',
          'Activa el permiso de galería en los ajustes de tu teléfono para personalizar las fotos del álbum.'
        );
      } else {
        Alert.alert('Error', `No se pudo actualizar el marco: ${PHOTO_SLOT_LABELS[slot]}`);
      }
    }
  };

  // Compartir / Exportar captura de alta resolución
  const handleShareScrapbook = async () => {
    try {
      if (!isBookOpen) {
        showToast('Abre el cuaderno para compartir un pliego', 'book-outline');
        return;
      }
      if (!scrapbookCaptureRef.current) return;

      const uri = await captureViewRef(scrapbookCaptureRef, {
        format: 'png',
        quality: 1,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          dialogTitle: 'Compartir Nuestros Recuerdos',
        });
      } else {
        showToast('Captura guardada en el dispositivo', 'download-outline');
      }
    } catch (error) {
      Alert.alert('Error al compartir', 'No fue posible generar la captura del pliego.');
    }
  };

  // Restaurar fotos a las imágenes por defecto (acción destructiva: se confirma)
  const handleResetPhotos = () => {
    Alert.alert(
      'Restaurar fotos',
      '¿Deseas restaurar todas las fotografías a las imágenes románticas por defecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            await clearAllSavedPhotos();
            setSpreads(INITIAL_SPREADS);
            setActiveSpreadIndex(0);
            setTotalPages(INITIAL_SPREADS.length * 2);
            showToast('Fotos restauradas', 'refresh');
          },
        },
      ]
    );
  };

  // Añadir un pliego nuevo al final del álbum
  const handleAddPage = async () => {
    const nextSpreadNumber = spreads.length + 1;
    const newSpread: ScrapbookSpreadData = {
      id: `spread-${Date.now()}`,
      title: `Pliego ${nextSpreadNumber}`,
      photos: { ...DEFAULT_PHOTOS },
    };
    const updatedSpreads = [...spreads, newSpread];
    const newIndex = updatedSpreads.length - 1;
    const newTotalPages = updatedSpreads.length * 2;

    setTotalPages(newTotalPages);
    setSpreads(updatedSpreads);

    if (isBookOpen) {
      // Con el libro abierto se pasa de página hasta el pliego nuevo
      requestSpread(newIndex);
    } else {
      setActiveSpreadIndex(newIndex);
      handleOpenBook();
    }
    showToast(`Pliego ${nextSpreadNumber} añadido · págs. ${newTotalPages - 1}–${newTotalPages}`);
    await saveScrapbookState(updatedSpreads, newTotalPages);
  };

  const menuItems: ActionSheetItem[] = isBookOpen
    ? [
        {
          key: 'prev',
          label: 'Pliego anterior',
          icon: 'chevron-back',
          disabled: activeSpreadIndex === 0,
          onPress: () => requestSpread(activeSpreadIndex - 1),
        },
        {
          key: 'next',
          label: 'Pliego siguiente',
          icon: 'chevron-forward',
          disabled: activeSpreadIndex >= spreads.length - 1,
          onPress: () => requestSpread(activeSpreadIndex + 1),
        },
        {
          key: 'first',
          label: 'Ir al primer pliego',
          icon: 'play-back-outline',
          disabled: activeSpreadIndex === 0,
          onPress: () => requestSpread(0),
        },
        { key: 'add', label: 'Añadir pliego nuevo', icon: 'add-circle-outline', onPress: handleAddPage },
        { key: 'close', label: 'Cerrar el cuaderno', icon: 'book-outline', onPress: handleCloseBook },
        {
          key: 'reset',
          label: 'Restaurar fotos por defecto',
          icon: 'refresh',
          destructive: true,
          onPress: handleResetPhotos,
        },
      ]
    : [
        { key: 'open', label: 'Abrir el cuaderno', icon: 'book-outline', onPress: handleOpenBook },
        { key: 'add', label: 'Añadir pliego nuevo', icon: 'add-circle-outline', onPress: handleAddPage },
        {
          key: 'reset',
          label: 'Restaurar fotos por defecto',
          icon: 'refresh',
          destructive: true,
          onPress: handleResetPhotos,
        },
      ];

  const dockActions: { key: string; label: string; icon: IconName; onPress: () => void }[] = [
    { key: 'menu', label: 'Opciones', icon: 'ellipsis-horizontal', onPress: () => setIsMenuOpen(true) },
    { key: 'share', label: 'Compartir', icon: 'share-outline', onPress: handleShareScrapbook },
    { key: 'reset', label: 'Restaurar', icon: 'refresh', onPress: handleResetPhotos },
  ];

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
            <Text style={styles.headerTitle}>Nuestros Recuerdos</Text>
            <View style={styles.headerSubtitleRow}>
              <Ionicons
                name={isBookOpen ? 'images-outline' : 'heart'}
                size={13}
                color={isBookOpen ? 'rgba(255, 255, 255, 0.75)' : '#F2A7AE'}
              />
              <Text style={styles.headerSubtitleText}>
                {isBookOpen
                  ? 'Toca un marco para cambiar su foto'
                  : `${spreads.length} pliegos · ${totalPages} páginas`}
              </Text>
            </View>
          </View>

          {/* ==================== ÁREA CENTRAL: PORTADA 3D O INTERIOR ==================== */}
          <View style={styles.stageArea}>
            {isBookOpen && (
              <InteractiveBookViewport
                spreads={spreads}
                activeSpreadIndex={activeSpreadIndex}
                onSelectPhotoSlot={handleSelectPhotoSlot}
                onCloseBook={handleCloseBook}
                captureRef={scrapbookCaptureRef}
                onGoToSpread={handleGoToSpread}
                navRequest={navRequest}
              />
            )}
            {isCoverMounted && (
              <Animated.View
                style={[styles.coverOverlay, coverOverlayStyle]}
                pointerEvents={isBookOpen ? 'none' : 'auto'}
              >
                <BookCover3D
                  openProgress={openProgress}
                  onOpenBook={handleOpenBook}
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

              {/* Acción principal: añadir pliego */}
              <Pressable
                onPress={handleAddPage}
                style={({ pressed }) => [styles.dockPrimary, pressed && styles.dockItemPressed]}
                accessibilityLabel="Añadir nuevo pliego"
              >
                <Ionicons name="add" size={22} color="#2B3654" />
                <Text style={styles.dockPrimaryLabel}>Pliego</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>

        <Toast message={toast} onHidden={() => setToast(null)} />

        <ActionSheet
          visible={isMenuOpen}
          title="Nuestros Recuerdos ❤️"
          subtitle={
            isBookOpen
              ? `Pliego ${activeSpreadIndex + 1} de ${spreads.length} · Págs. ${activeSpreadIndex * 2 + 1}–${activeSpreadIndex * 2 + 2}`
              : `${spreads.length} pliegos · ${totalPages} páginas`
          }
          items={menuItems}
          onClose={() => setIsMenuOpen(false)}
        />
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
