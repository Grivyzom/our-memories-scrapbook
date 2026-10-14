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
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons, Feather } from '@expo/vector-icons';
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
import { InteractiveBookViewport } from './src/components/InteractiveBookViewport';

export default function App() {
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [spreads, setSpreads] = useState<ScrapbookSpreadData[]>(INITIAL_SPREADS);
  const [activeSpreadIndex, setActiveSpreadIndex] = useState(0);
  const [totalPages, setTotalPages] = useState(5);

  const openProgress = useSharedValue(0);
  const scrapbookCaptureRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      const saved = await loadScrapbookState();
      setSpreads(saved.spreads);
      setTotalPages(saved.totalPages);
    })();
  }, []);

  const currentSpread = spreads[activeSpreadIndex] || spreads[0];

  const handleOpenBook = () => {
    openProgress.value = withTiming(1, {
      duration: 620,
      easing: Easing.out(Easing.cubic),
    });
    setTimeout(() => {
      setIsBookOpen(true);
    }, 460);
  };

  const handleCloseBook = () => {
    setIsBookOpen(false);
    openProgress.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
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

  // Botón 1 (...): Más opciones
  const handleMoreOptions = () => {
    Alert.alert(
      'Our Memories ❤️',
      isBookOpen
        ? 'Toca cualquier marco fotográfico para elegir una foto de tu galería. Desliza con un dedo o usa dos dedos para hacer zoom.'
        : 'Toca la portada para abrir tu cuaderno interactivo.',
      [
        {
          text: isBookOpen ? 'Cerrar Cuaderno' : 'Abrir Cuaderno',
          onPress: () => (isBookOpen ? handleCloseBook() : handleOpenBook()),
        },
        ...(spreads.length > 1
          ? [
              {
                text: `Cambiar Pliego (${activeSpreadIndex + 1}/${spreads.length})`,
                onPress: () =>
                  setActiveSpreadIndex((prev) => (prev + 1) % spreads.length),
              },
            ]
          : []),
        { text: 'Cancelar', style: 'cancel' as const },
      ]
    );
  };

  // Botón 2 (share): Compartir / Exportar captura de alta resolución
  const handleShareScrapbook = async () => {
    try {
      if (!isBookOpen) {
        Alert.alert(
          'Abre el cuaderno primero',
          'Abre el cuaderno para capturar y compartir tu collage de recuerdos.'
        );
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
          dialogTitle: 'Compartir Our Memories Scrapbook',
        });
      } else {
        Alert.alert('Captura lista', `Imagen guardada en: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Error al compartir', 'No fue posible generar la captura del pliego.');
    }
  };

  // Botón 3 (trash): Borrar / Resetear fotos a las imágenes por defecto
  const handleResetPhotos = () => {
    Alert.alert(
      'Resetear fotos',
      '¿Deseas restaurar todas las fotografías a las imágenes románticas por defecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: async () => {
            await clearAllSavedPhotos();
            const resetData: ScrapbookSpreadData[] = [
              {
                id: 'spread-1',
                title: 'Spread 1',
                photos: { ...DEFAULT_PHOTOS },
              },
            ];
            setSpreads(resetData);
            setActiveSpreadIndex(0);
            setTotalPages(5);
          },
        },
      ]
    );
  };

  // Botón 4 (+): Añadir página / nuevo pliego al álbum
  const handleAddPage = async () => {
    const nextPageCount = totalPages + 1;
    const newSpread: ScrapbookSpreadData = {
      id: `spread-${Date.now()}`,
      title: `Spread ${spreads.length + 1}`,
      photos: { ...DEFAULT_PHOTOS },
    };
    const updatedSpreads = [...spreads, newSpread];
    setTotalPages(nextPageCount);
    setSpreads(updatedSpreads);
    setActiveSpreadIndex(updatedSpreads.length - 1);
    await saveScrapbookState(updatedSpreads, nextPageCount);

    if (!isBookOpen) {
      handleOpenBook();
    } else {
      Alert.alert(
        'Nueva página añadida ✨',
        `Ahora tu cuaderno tiene ${nextPageCount} Pages. Estás viendo el pliego #${updatedSpreads.length}.`
      );
    }
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#5B6E96', '#7B88B5']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradientBackground}
      >
        <SafeAreaView style={styles.safeArea}>
          {/* ==================== ENCABEZADO SUPERIOR CENTRADO ==================== */}
          <View style={styles.headerContainer}>
            <Text style={styles.headerTitle}>Our Memories ❤️</Text>
            <View style={styles.headerSubtitleRow}>
              <Ionicons
                name="documents-outline"
                size={14}
                color="rgba(255, 255, 255, 0.78)"
              />
              <Text style={styles.headerSubtitleText}>{`${totalPages} Pages`}</Text>
            </View>
          </View>

          {/* ==================== ÁREA CENTRAL: PORTADA 3D O INTERIOR ==================== */}
          <View style={styles.stageArea}>
            {!isBookOpen ? (
              <BookCover3D
                openProgress={openProgress}
                onOpenBook={handleOpenBook}
              />
            ) : (
              <InteractiveBookViewport
                photos={currentSpread.photos}
                onSelectPhotoSlot={handleSelectPhotoSlot}
                onCloseBook={handleCloseBook}
                captureRef={scrapbookCaptureRef}
              />
            )}
          </View>

          {/* ==================== BARRA DE HERRAMIENTAS INFERIOR FLOTANTE ==================== */}
          <View style={styles.bottomToolbarContainer}>
            {/* 1. Más opciones (...) */}
            <Pressable
              onPress={handleMoreOptions}
              style={({ pressed }) => [
                styles.circleToolButton,
                pressed && styles.circleToolButtonPressed,
              ]}
            >
              <Feather name="more-horizontal" size={22} color="#1A1A1A" />
            </Pressable>

            {/* 2. Compartir / Exportar captura (share) */}
            <Pressable
              onPress={handleShareScrapbook}
              style={({ pressed }) => [
                styles.circleToolButton,
                pressed && styles.circleToolButtonPressed,
              ]}
            >
              <Feather name="share" size={20} color="#1A1A1A" />
            </Pressable>

            {/* 3. Borrar / Resetear fotos (trash) */}
            <Pressable
              onPress={handleResetPhotos}
              style={({ pressed }) => [
                styles.circleToolButton,
                pressed && styles.circleToolButtonPressed,
              ]}
            >
              <Feather name="trash-2" size={20} color="#1A1A1A" />
            </Pressable>

            {/* 4. Añadir página (+) */}
            <Pressable
              onPress={handleAddPage}
              style={({ pressed }) => [
                styles.circleToolButton,
                pressed && styles.circleToolButtonPressed,
              ]}
            >
              <Feather name="plus" size={23} color="#1A1A1A" />
            </Pressable>
          </View>
        </SafeAreaView>
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
    paddingVertical: 8,
    zIndex: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  headerSubtitleText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.78)',
  },
  stageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomToolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingBottom: Platform.OS === 'ios' ? 12 : 22,
    paddingTop: 8,
    zIndex: 30,
  },
  circleToolButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 8,
  },
  circleToolButtonPressed: {
    transform: [{ scale: 0.93 }],
    backgroundColor: '#F1F5F9',
  },
});
