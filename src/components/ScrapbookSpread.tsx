import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PhotoSlotKey, SpreadPhotosMap } from '../types/scrapbook';
import { SPREAD_WIDTH, SPREAD_HEIGHT } from '../constants/defaultData';
import {
  DriedOrangeFlowersSVG,
  VerticalBarcodeSVG,
  VintageCherubSVG,
  WhiteRosesBouquetSVG,
  WatercolorHeartSVG,
  HDSpineBindingSVG,
} from './StickersAndVectors';
import { LeatherTexture, PaperTexture } from './Textures';

interface ScrapbookSpreadProps {
  photos: SpreadPhotosMap;
  onSelectPhotoSlot: (slot: PhotoSlotKey) => void;
  spreadIndex?: number;
}

export const ScrapbookSpread: React.FC<ScrapbookSpreadProps> = ({
  photos,
  onSelectPhotoSlot,
  spreadIndex = 0,
}) => {
  const [isPlayingRetroMusic, setIsPlayingRetroMusic] = useState(false);

  const pageANumber = spreadIndex * 2 + 1;
  const pageBNumber = spreadIndex * 2 + 2;

  return (
    <View style={styles.outerBookCoverBase}>
      {/* Textura de cuero en las tapas burdeos */}
      <View style={styles.leatherClip} pointerEvents="none">
        <LeatherTexture seed={27} intensity={1.15} />
      </View>

      {/* Hojas apiladas debajo en los bordes para dar volumen real de libro */}
      <View style={[styles.stackedSheet, styles.sheetLayer5]} />
      <View style={[styles.stackedSheet, styles.sheetLayer4]} />
      <View style={[styles.stackedSheet, styles.sheetLayer3]} />
      <View style={[styles.stackedSheet, styles.sheetLayer2]} />

      {/* Pliego doble principal */}
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

        {/* ==================================================================== */}
        {/* ======================= PÁGINA A (LADO IZQUIERDO) ================== */}
        {/* ==================================================================== */}
        <View style={styles.leftPage}>
          {/* Header decorativo de Página A */}
          <View style={styles.pageHeaderRow}>
            <View style={styles.washiTapeBadge}>
              <Text style={styles.washiTapeText}>PÁGINA A</Text>
            </View>
            <Text style={styles.pageSubtitle}>Nuestra Historia ❤️</Text>
          </View>

          {/* Fila Superior: Ventana Retro + Reproductor Musical (Completamente en Página A) */}
          <View style={styles.pageATopRow}>
            {/* 1. Marco Estilo Navegador Web Retro */}
            <View style={styles.retroBrowserContainer}>
              <View style={styles.retroBrowserHeader}>
                <View style={styles.browserDotsRow}>
                  <View style={[styles.browserDot, { backgroundColor: '#E05A47' }]} />
                  <View style={[styles.browserDot, { backgroundColor: '#F2C94C' }]} />
                  <View style={[styles.browserDot, { backgroundColor: '#6FCF97' }]} />
                </View>
                <View style={styles.browserAddressBar}>
                  <Text style={styles.browserUrlText} numberOfLines={1}>
                    http://nuestros-recuerdos.love
                  </Text>
                </View>
                <View style={styles.browserControlsRight}>
                  <Text style={styles.browserControlSymbol}>_</Text>
                  <Text style={styles.browserControlSymbol}>□</Text>
                  <Text style={styles.browserControlSymbol}>×</Text>
                </View>
              </View>

              <Pressable
                onPress={() => onSelectPhotoSlot('browserMain')}
                style={styles.browserPhotoWrapper}
              >
                <Image
                  source={{ uri: photos.browserMain }}
                  style={styles.fullImage}
                  resizeMode="cover"
                />
                <View style={styles.photoEditBadge}>
                  <Ionicons name="camera" size={12} color="#FFF" />
                </View>
              </Pressable>

              {/* Etiqueta ovalada troquelada en español */}
              <View style={styles.ovalStickerContainer}>
                <View style={styles.ovalStickerInner}>
                  <Text style={styles.ovalStickerText}>Tú y yo. Por siempre</Text>
                </View>
              </View>
            </View>

            {/* 2. Reproductor Musical Retro (Ubicado ordenadamente en Página A) */}
            <View style={styles.musicWidgetPageA}>
              <View style={styles.musicWidgetTopBar}>
                <Text style={styles.musicWindowDots}>...</Text>
                <View style={styles.musicWindowRightBtns}>
                  <Text style={styles.musicWindowBtnText}>o</Text>
                  <Text style={styles.musicWindowBtnText}>x</Text>
                </View>
              </View>

              <Pressable
                onPress={() => onSelectPhotoSlot('musicPlayer')}
                style={styles.musicSquarePhoto}
              >
                <Image
                  source={{ uri: photos.musicPlayer }}
                  style={styles.fullImage}
                  resizeMode="cover"
                />
                <View style={styles.photoEditBadge}>
                  <Ionicons name="camera" size={11} color="#FFF" />
                </View>
                {/* Sticker en español */}
                <View style={styles.favoritePersonSticker}>
                  <Text style={styles.favoritePersonText}>mi persona favorita</Text>
                </View>
              </Pressable>

              {/* Controles de reproducción interactivos */}
              <View style={styles.musicControlsBar}>
                <Text style={styles.musicControlIcon}>|&lt;&lt;</Text>
                <Pressable
                  onPress={() => setIsPlayingRetroMusic((prev) => !prev)}
                  style={styles.musicPlayButton}
                >
                  <Text style={styles.musicControlIconBold}>
                    {isPlayingRetroMusic ? '▶' : '||'}
                  </Text>
                </Pressable>
                <Text style={styles.musicControlIcon}>&gt;&gt;|</Text>
              </View>
            </View>
          </View>

          {/* Fila Central: Flores Secas + Recorte de Máquina de Escribir en Español */}
          <View style={styles.centerLeftRow}>
            <View style={styles.driedFlowersWrapper}>
              <DriedOrangeFlowersSVG width={80} height={100} />
            </View>

            <View style={styles.typewriterPaperCutout}>
              <View style={styles.maskingTapeTop} />
              <Text style={styles.typewriterText}>Qué suerte tenerte.</Text>
            </View>
          </View>

          {/* Fila Inferior: Ticket Vintage Horizontal con códigos de barras */}
          <View style={styles.vintageTicketFrame}>
            <VerticalBarcodeSVG height={108} />
            <Pressable
              onPress={() => onSelectPhotoSlot('ticketHorizontal')}
              style={styles.ticketPhotoSlot}
            >
              <Image
                source={{ uri: photos.ticketHorizontal }}
                style={styles.fullImage}
                resizeMode="cover"
              />
              <View style={styles.photoEditBadge}>
                <Ionicons name="camera" size={12} color="#FFF" />
              </View>
            </Pressable>
            <VerticalBarcodeSVG height={108} />

            {/* Recorte de papel en esquina inferior */}
            <View style={styles.homePaperCutout}>
              <Text style={styles.homeCutoutText}>mi hogar.</Text>
            </View>
          </View>

          {/* Pie de página con numeración */}
          <View style={styles.pageFooterRowLeft}>
            <Text style={styles.pageNumberText}>pág. {pageANumber}</Text>
          </View>
        </View>

        {/* ==================================================================== */}
        {/* =============== LOMO CENTRAL DEL CUADERNO EN ALTA DEFINICIÓN (HD) == */}
        {/* ==================================================================== */}
        <View style={styles.centerSpineContainer} pointerEvents="none">
          <HDSpineBindingSVG height={SPREAD_HEIGHT} width={36} />
        </View>

        {/* ==================================================================== */}
        {/* ======================= PÁGINA B (LADO DERECHO) ==================== */}
        {/* ==================================================================== */}
        <View style={styles.rightPage}>
          {/* Columna Principal Izquierda de Página B (Spotify + Stickers + Polaroid) */}
          <View style={styles.rightPageMainArea}>
            {/* Header decorativo de Página B */}
            <View style={styles.pageHeaderRowRight}>
              <Text style={styles.pageSubtitle}>Momentos Inolvidables ✨</Text>
              <View style={[styles.washiTapeBadge, styles.washiTapeBadgeRight]}>
                <Text style={styles.washiTapeText}>PÁGINA B</Text>
              </View>
            </View>

            {/* Tarjeta estilo Spotify en Español + 5 Corazones */}
            <View style={styles.spotifyLyricsRow}>
              <View style={styles.spotifyCard}>
                <View style={styles.spotifyHeader}>
                  <Ionicons name="musical-notes" size={13} color="#1DB954" />
                  <Text style={styles.spotifyTrackTitle} numberOfLines={1}>
                    Nuestra Canción - Daylight
                  </Text>
                </View>
                <Text style={styles.spotifyLyricsText}>
                  &ldquo;No quiero mirar nada más ahora que te vi{'\n'}(No puedo apartar la mirada)&rdquo;
                </Text>
                <View style={styles.spotifyFooterBar}>
                  <View style={styles.spotifyProgressFill} />
                </View>
              </View>

              {/* Columna vertical de corazones de acuarela */}
              <View style={styles.fiveHeartsColumn}>
                {[0, 1, 2, 3].map((h) => (
                  <WatercolorHeartSVG
                    key={h}
                    size={15}
                    rotation={h % 2 === 0 ? -8 : 8}
                  />
                ))}
              </View>
            </View>

            {/* Grupo de etiquetas de amor en español + Querubín vintage */}
            <View style={styles.pageBLoveCluster}>
              <View style={styles.threeLabelsStack}>
                <View style={[styles.redWhiteLabel, { transform: [{ rotate: '-2.5deg' }] }]}>
                  <Text style={styles.redWhiteLabelText}>Te amo de verdad</Text>
                </View>
                <View style={[styles.redWhiteLabel, { transform: [{ rotate: '2deg' }] }]}>
                  <Text style={styles.redWhiteLabelText}>con todo mi</Text>
                </View>
                <View style={[styles.redWhiteLabel, { transform: [{ rotate: '-1.5deg' }] }]}>
                  <Text style={styles.redWhiteLabelText}>corazón</Text>
                </View>
              </View>

              <View style={styles.cherubStickerWrapper}>
                <VintageCherubSVG size={68} />
              </View>
            </View>

            {/* Fila Inferior: Polaroid Horizontal + Ramo de Rosas Blancas */}
            <View style={styles.bottomRightPolaroidArea}>
              <View style={styles.polaroidFrame}>
                <View style={styles.polaroidTape} />
                <Pressable
                  onPress={() => onSelectPhotoSlot('polaroidBottom')}
                  style={styles.polaroidPhotoBox}
                >
                  <Image
                    source={{ uri: photos.polaroidBottom }}
                    style={styles.fullImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoEditBadge}>
                    <Ionicons name="camera" size={12} color="#FFF" />
                  </View>
                </Pressable>
                <Text style={styles.polaroidCaption}>por siempre y para siempre ♡</Text>
              </View>

              <View style={styles.rosesStickerWrapper}>
                <WhiteRosesBouquetSVG width={80} height={102} />
              </View>
            </View>

            {/* Pie de página con numeración */}
            <View style={styles.pageFooterRowRight}>
              <Text style={styles.pageNumberText}>pág. {pageBNumber}</Text>
            </View>
          </View>

          {/* Columna Derecha de Página B: Tira vertical de negativo analógico 35mm con 5 fotos */}
          <View style={styles.filmStripContainer}>
            {/* Perforaciones izquierdas */}
            <View style={styles.filmSprocketColumn}>
              {Array.from({ length: 22 }).map((_, i) => (
                <View key={`l-${i}`} style={styles.sprocketHole} />
              ))}
            </View>

            {/* 5 recuadros de fotos interactivos ordenados de 1 a 5 */}
            <View style={styles.filmFramesColumn}>
              {(['film1', 'film2', 'film3', 'film4', 'film5'] as PhotoSlotKey[]).map(
                (slotKey, index) => (
                  <Pressable
                    key={slotKey}
                    onPress={() => onSelectPhotoSlot(slotKey)}
                    style={styles.filmPhotoSlot}
                  >
                    <Image
                      source={{ uri: photos[slotKey] }}
                      style={styles.fullImage}
                      resizeMode="cover"
                    />
                    <Text style={styles.filmFrameNumber}>{`0${index + 1}A`}</Text>
                  </Pressable>
                )
              )}

              {/* Corazones en la base del negativo */}
              <View style={styles.filmBaseHeartsRow}>
                <WatercolorHeartSVG size={12} rotation={-10} />
                <WatercolorHeartSVG size={13} rotation={4} />
                <WatercolorHeartSVG size={12} rotation={12} />
              </View>
            </View>

            {/* Perforaciones derechas */}
            <View style={styles.filmSprocketColumn}>
              {Array.from({ length: 22 }).map((_, i) => (
                <View key={`r-${i}`} style={styles.sprocketHole} />
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const monoFont = Platform.select({
  ios: 'Courier',
  android: 'monospace',
  default: 'monospace',
});

const serifFont = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'serif',
});

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
  pageCurvatureShade: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  stackedSheet: {
    position: 'absolute',
    backgroundColor: '#F3EDE0',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D5CBB8',
  },
  sheetLayer5: {
    width: SPREAD_WIDTH + 14,
    height: SPREAD_HEIGHT + 10,
  },
  sheetLayer4: {
    width: SPREAD_WIDTH + 10,
    height: SPREAD_HEIGHT + 7,
    backgroundColor: '#F6F1E5',
  },
  sheetLayer3: {
    width: SPREAD_WIDTH + 6,
    height: SPREAD_HEIGHT + 4,
    backgroundColor: '#F9F5EB',
  },
  sheetLayer2: {
    width: SPREAD_WIDTH + 3,
    height: SPREAD_HEIGHT + 2,
    backgroundColor: '#FCF9F2',
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

  /* ==================== PÁGINA A ==================== */
  leftPage: {
    width: SPREAD_WIDTH / 2,
    height: '100%',
    paddingTop: 14,
    paddingLeft: 20,
    paddingRight: 24,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  washiTapeBadge: {
    backgroundColor: '#E6D7BD',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#CDBFA3',
    transform: [{ rotate: '-1.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  washiTapeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A4632',
    fontFamily: monoFont,
    letterSpacing: 0.8,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8A7760',
    fontFamily: serifFont,
    fontStyle: 'italic',
  },
  pageATopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },

  /* --- Ventana Retro --- */
  retroBrowserContainer: {
    width: 238,
    height: 198,
    backgroundColor: '#F4EFE6',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2D2A26',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
    position: 'relative',
  },
  retroBrowserHeader: {
    height: 25,
    backgroundColor: '#E5DEC9',
    borderBottomWidth: 1.5,
    borderBottomColor: '#2D2A26',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    justifyContent: 'space-between',
  },
  browserDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  browserDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D2A26',
  },
  browserAddressBar: {
    flex: 1,
    marginHorizontal: 7,
    height: 16,
    backgroundColor: '#FFFDF9',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#8C8275',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  browserUrlText: {
    fontSize: 8,
    fontFamily: monoFont,
    color: '#4A453E',
  },
  browserControlsRight: {
    flexDirection: 'row',
    gap: 5,
  },
  browserControlSymbol: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2D2A26',
  },
  browserPhotoWrapper: {
    flex: 1,
    backgroundColor: '#D8D0C5',
    overflow: 'hidden',
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  ovalStickerContainer: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 5,
  },
  ovalStickerInner: {
    backgroundColor: '#C92A2A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 24,
  },
  ovalStickerText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* --- Reproductor Amarillo en Página A --- */
  musicWidgetPageA: {
    width: 154,
    height: 198,
    backgroundColor: '#F5C242',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2B2623',
    padding: 7,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 5,
    transform: [{ rotate: '1.5deg' }],
  },
  musicWidgetTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  musicWindowDots: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2B2623',
    lineHeight: 12,
  },
  musicWindowRightBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  musicWindowBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2B2623',
    fontFamily: monoFont,
  },
  musicSquarePhoto: {
    width: '100%',
    height: 114,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: '#2B2623',
    overflow: 'hidden',
    backgroundColor: '#E2D9C5',
    position: 'relative',
  },
  favoritePersonSticker: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-2deg' }],
  },
  favoritePersonText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#C92A2A',
  },
  musicControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 6,
    paddingVertical: 3,
    backgroundColor: '#FCE38A',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#2B2623',
  },
  musicControlIcon: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2B2623',
    fontFamily: monoFont,
  },
  musicPlayButton: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  musicControlIconBold: {
    fontSize: 11,
    fontWeight: '900',
    color: '#B92B27',
  },

  /* --- Centro Izquierda: Flores + Máquina de Escribir --- */
  centerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 12,
  },
  driedFlowersWrapper: {
    transform: [{ rotate: '-6deg' }],
  },
  typewriterPaperCutout: {
    backgroundColor: '#F7F2E4',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#D8CEBE',
    transform: [{ rotate: '2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  maskingTapeTop: {
    position: 'absolute',
    top: -6,
    left: '35%',
    width: 42,
    height: 11,
    backgroundColor: 'rgba(238, 224, 189, 0.85)',
    transform: [{ rotate: '-3deg' }],
  },
  typewriterText: {
    fontFamily: monoFont,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2B2623',
    letterSpacing: 0.4,
  },

  /* --- Abajo: Ticket Vintage Horizontal --- */
  vintageTicketFrame: {
    width: '100%',
    height: 120,
    backgroundColor: '#F5EFE0',
    borderWidth: 1.5,
    borderColor: '#3A332C',
    borderRadius: 6,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  ticketPhotoSlot: {
    flex: 1,
    height: '100%',
    marginHorizontal: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#DDD6C7',
  },
  homePaperCutout: {
    position: 'absolute',
    bottom: -8,
    left: 14,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C7BFA8',
    transform: [{ rotate: '-4deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 2,
  },
  homeCutoutText: {
    fontFamily: serifFont,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#231F20',
    fontStyle: 'italic',
  },
  pageFooterRowLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  pageFooterRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 3,
  },
  pageNumberText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#A89984',
    fontFamily: monoFont,
  },

  /* ==================== LOMO CENTRAL HD ==================== */
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

  /* ==================== PÁGINA B ==================== */
  rightPage: {
    width: SPREAD_WIDTH / 2,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    paddingLeft: 24,
    paddingRight: 16,
    paddingBottom: 10,
  },
  rightPageMainArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingRight: 14,
  },
  pageHeaderRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  washiTapeBadgeRight: {
    backgroundColor: '#E6D7BD',
    transform: [{ rotate: '1.5deg' }],
  },

  /* --- Spotify Lyrics en Español --- */
  spotifyLyricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  spotifyCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6E1D6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  spotifyTrackTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#191414',
  },
  spotifyLyricsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 14.5,
    fontStyle: 'italic',
  },
  spotifyFooterBar: {
    marginTop: 6,
    height: 3,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  spotifyProgressFill: {
    width: '68%',
    height: '100%',
    backgroundColor: '#C92A2A',
  },
  fiveHeartsColumn: {
    marginLeft: 8,
    justifyContent: 'space-between',
    height: 80,
    alignItems: 'center',
  },

  /* --- Etiquetas de Amor + Querubín en Página B --- */
  pageBLoveCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 4,
  },
  threeLabelsStack: {
    alignItems: 'center',
    gap: 3,
  },
  redWhiteLabel: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1.3,
    borderColor: '#C92A2A',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
  },
  redWhiteLabelText: {
    color: '#C92A2A',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: monoFont,
  },
  cherubStickerWrapper: {
    marginLeft: 4,
  },

  /* --- Polaroid + Rosas en Página B --- */
  bottomRightPolaroidArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  polaroidFrame: {
    width: 182,
    height: 154,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0D9C8',
    transform: [{ rotate: '-2.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
    alignItems: 'center',
  },
  polaroidTape: {
    position: 'absolute',
    top: -7,
    width: 48,
    height: 13,
    backgroundColor: 'rgba(244, 231, 198, 0.82)',
    transform: [{ rotate: '3deg' }],
    zIndex: 5,
  },
  polaroidPhotoBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D8D2C5',
    overflow: 'hidden',
  },
  polaroidCaption: {
    marginTop: 4,
    fontSize: 10,
    color: '#4A433C',
    fontStyle: 'italic',
    fontFamily: serifFont,
  },
  rosesStickerWrapper: {
    marginLeft: -6,
    marginBottom: 4,
    transform: [{ rotate: '6deg' }],
  },

  /* --- Tira de Película 35mm (Fotos film1 a film5) --- */
  filmStripContainer: {
    width: 108,
    height: '100%',
    backgroundColor: '#161616',
    borderRadius: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  filmSprocketColumn: {
    width: 9,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sprocketHole: {
    width: 5.5,
    height: 8,
    borderRadius: 1.5,
    backgroundColor: '#FDFBF2',
    opacity: 0.85,
  },
  filmFramesColumn: {
    flex: 1,
    marginHorizontal: 3,
    justifyContent: 'space-between',
  },
  filmPhotoSlot: {
    width: '100%',
    height: 88,
    backgroundColor: '#2C2C2C',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3D3D3D',
    position: 'relative',
  },
  filmFrameNumber: {
    position: 'absolute',
    bottom: 2,
    right: 3,
    fontSize: 7,
    color: '#F59F00',
    fontFamily: monoFont,
    fontWeight: '700',
  },
  filmBaseHeartsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },

  /* --- Utilidades --- */
  fullImage: {
    width: '100%',
    height: '100%',
  },
  photoEditBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
