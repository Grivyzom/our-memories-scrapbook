import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PageSide, ScrapbookSpreadData } from '../types/scrapbook';
import { SPREAD_WIDTH, SPREAD_HEIGHT } from '../constants/defaultData';
import { PAGE_WIDTH } from '../constants/blockCatalog';
import { HDSpineBinding } from './Stickers';
import { LeatherTexture, PaperTexture } from './Textures';
import { BookPageView } from './blocks/BookPageView';

interface ScrapbookSpreadProps {
  spread: ScrapbookSpreadData;
  /** Toca un hueco de foto; sin callback el pliego es de sólo lectura. */
  onPressPhoto?: (side: PageSide, blockId: string, photoIndex: number) => void;
  /** Página vacía tocada (abre el editor). */
  onPressEmptyPage?: (side: PageSide) => void;
  spreadIndex?: number;
  /** Número de capas visibles en el bloque de hojas izquierdo / derecho. */
  leftStackLayers?: number;
  rightStackLayers?: number;
}

/** Fotos de las páginas dibujadas como "bloque:índice" -> uri (los huecos vacíos no cuentan). */
const spreadPhotoMap = (spread: ScrapbookSpreadData, only?: PageSide) => {
  const map: Record<string, string> = {};
  const pages = only ? [spread[only]] : [spread.left, spread.right];
  for (const page of pages) {
    for (const block of page.blocks) {
      block.photos.forEach((uri, i) => {
        if (uri) map[`${block.id}:${i}`] = uri;
      });
    }
  }
  return map;
};

// Escalonado de cada hoja del bloque: hacia fuera y hacia abajo (el libro está inclinado)
const BLOCK_STEP_X = 1.5;
const BLOCK_STEP_Y = 1.7;
const MAX_BLOCK_LAYERS = 8;

/**
 * Bloque de hojas bajo una de las páginas: capas escalonadas con sombra
 * propia, para que el pliego se lea como un bloque denso de papel grueso y
 * no como un plano sin cuerpo.
 */
const PageBlock: React.FC<{ side: 'left' | 'right'; layers: number }> = ({ side, layers }) => {
  const count = Math.max(1, Math.min(MAX_BLOCK_LAYERS, Math.round(layers)));
  const pageLeft = 14;
  const pageTop = 12;
  const half = SPREAD_WIDTH / 2;

  const rect = (k: number) => ({
    left: side === 'left' ? pageLeft - k * BLOCK_STEP_X : pageLeft + half,
    top: pageTop + k * 0.4,
    width: half + k * BLOCK_STEP_X,
    height: SPREAD_HEIGHT + k * (BLOCK_STEP_Y - 0.4),
  });

  return (
    <>
      {/* Sombra de contacto del bloque sobre la tapa */}
      <View
        style={[
          styles.blockShadow,
          rect(count + 1.6),
          side === 'left' ? styles.blockLeftRadius : styles.blockRightRadius,
        ]}
      />
      {Array.from({ length: count }, (_, i) => {
        const k = count - i; // de la capa más baja a la más alta
        return (
          <View
            key={k}
            style={[
              styles.blockSheet,
              rect(k),
              side === 'left' ? styles.blockLeftRadius : styles.blockRightRadius,
              { backgroundColor: k % 2 === 0 ? '#EFE7D6' : '#F7F1E4' },
            ]}
          />
        );
      })}
    </>
  );
};

interface SpreadPaperProps {
  spread: ScrapbookSpreadData;
  spreadIndex: number;
  onPressPhoto?: (side: PageSide, blockId: string, photoIndex: number) => void;
  onPressEmptyPage?: (side: PageSide) => void;
  /** Dibuja sólo los componentes de esta página (la otra queda en blanco). */
  only?: PageSide;
  /** Se llama cada vez que todas las fotos dibujadas terminan de cargar. */
  onImagesLoaded?: () => void;
}

/**
 * El papel del pliego (920×600): texturas, curvatura, lomo y las dos páginas.
 * El paso de página dibuja con él las caras de la hoja que gira, así se ven
 * exactamente igual que el pliego de debajo sin tener que capturarlo.
 */
export const SpreadPaper: React.FC<SpreadPaperProps> = ({
  spread,
  spreadIndex,
  onPressPhoto,
  onPressEmptyPage,
  only,
  onImagesLoaded,
}) => {
  // URI ya cargada en cada hueco: al cambiar una sola foto basta con esperar a esa
  const loadedUris = useRef<Record<string, string>>({});
  const expectedRef = useRef<Record<string, string>>({});
  expectedRef.current = spreadPhotoMap(spread, only);
  const onImagesLoadedRef = useRef(onImagesLoaded);
  onImagesLoadedRef.current = onImagesLoaded;

  const checkAllLoaded = useCallback(() => {
    const expected = expectedRef.current;
    if (Object.keys(expected).every((k) => loadedUris.current[k] === expected[k])) {
      onImagesLoadedRef.current?.();
    }
  }, []);
  const handlePhotoLoaded = useCallback(
    (blockId: string, index: number, uri: string) => {
      loadedUris.current[`${blockId}:${index}`] = uri;
      checkAllLoaded();
    },
    [checkAllLoaded]
  );
  // Las fotos que no cambian no vuelven a avisar: se revisa al recibir el pliego nuevo
  useEffect(checkAllLoaded, [spread, checkAllLoaded]);

  const renderPage = (side: PageSide) =>
    only && only !== side ? (
      <View key={side} style={styles.blankPage} />
    ) : (
      <BookPageView
        key={side}
        page={spread[side]}
        side={side}
        pageNumber={spreadIndex * 2 + (side === 'left' ? 1 : 2)}
        onPressPhoto={onPressPhoto}
        onPhotoLoaded={handlePhotoLoaded}
        onPressEmpty={onPressEmptyPage}
      />
    );

  return (
    <View style={styles.mainSpreadPaper}>
      {/* Textura de papel rasgado decorativo en esquinas */}
      <View style={styles.tornPaperTopLeft} />
      <View style={styles.tornPaperBottomRight} />

      {/* Textura de papel (fibras y motas) sobre ambas hojas */}
      <PaperTexture seed={17} />

      {/* Curvatura 3D de las hojas: sombra en el pliegue central y luz en los bordes */}
      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(120, 90, 50, 0.10)',
          'rgba(255, 255, 255, 0)',
          'rgba(255, 255, 255, 0.10)',
          'rgba(70, 45, 20, 0.22)',
          'rgba(255, 255, 255, 0.10)',
          'rgba(255, 255, 255, 0)',
          'rgba(120, 90, 50, 0.10)',
        ]}
        locations={[0, 0.08, 0.42, 0.5, 0.58, 0.92, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.pageCurvatureShade}
      />

      {/* Páginas con los componentes que eligió el usuario */}
      {renderPage('left')}
      {renderPage('right')}

      {/* Lomo central con costuras */}
      <View style={styles.centerSpineContainer} pointerEvents="none">
        <HDSpineBinding height={SPREAD_HEIGHT} width={36} />
      </View>
    </View>
  );
};

export const ScrapbookSpread: React.FC<ScrapbookSpreadProps> = ({
  spread,
  onPressPhoto,
  onPressEmptyPage,
  spreadIndex = 0,
  leftStackLayers = 4,
  rightStackLayers = 4,
}) => (
  <View style={styles.outerBookCoverBase}>
    {/* Textura de cuero en las tapas burdeos */}
    <View style={styles.leatherClip} pointerEvents="none">
      <LeatherTexture seed={27} intensity={1.15} />
    </View>

    {/* Bloques de hojas escalonados: su grosor crece con las páginas de cada lado */}
    <PageBlock side="left" layers={leftStackLayers} />
    <PageBlock side="right" layers={rightStackLayers} />

    {/* Pliego doble principal */}
    <SpreadPaper
      spread={spread}
      spreadIndex={spreadIndex}
      onPressPhoto={onPressPhoto}
      onPressEmptyPage={onPressEmptyPage}
    />
  </View>
);

const styles = StyleSheet.create({
  outerBookCoverBase: {
    width: SPREAD_WIDTH + 28,
    height: SPREAD_HEIGHT + 24,
    backgroundColor: '#8B1E24',
    borderRadius: 18,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 20,
  },
  leatherClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    overflow: 'hidden',
  },
  blankPage: {
    width: PAGE_WIDTH,
    height: SPREAD_HEIGHT,
  },
  pageCurvatureShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  blockSheet: {
    position: 'absolute',
    borderWidth: 0.8,
    borderColor: '#CDBFA4',
  },
  blockShadow: {
    position: 'absolute',
    backgroundColor: 'rgba(40, 8, 10, 0.28)',
  },
  blockLeftRadius: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  blockRightRadius: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  mainSpreadPaper: {
    width: SPREAD_WIDTH,
    height: SPREAD_HEIGHT,
    backgroundColor: '#FDFBF2',
    borderRadius: 9,
    flexDirection: 'row',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E2D9C8',
  },
  tornPaperTopLeft: {
    position: 'absolute',
    top: -18,
    left: -18,
    width: 95,
    height: 65,
    backgroundColor: '#EFE6D4',
    transform: [{ rotate: '-18deg' }],
    borderBottomRightRadius: 22,
    borderWidth: 1,
    borderColor: '#DDD0B8',
  },
  tornPaperBottomRight: {
    position: 'absolute',
    bottom: -16,
    right: 115,
    width: 120,
    height: 48,
    backgroundColor: '#EFE6D4',
    transform: [{ rotate: '12deg' }],
    borderTopLeftRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD0B8',
  },
  centerSpineContainer: {
    position: 'absolute',
    left: SPREAD_WIDTH / 2 - 18,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
