import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PhotoSlotKey, SpreadPhotosMap } from '../types/scrapbook';
import { SPREAD_WIDTH, SPREAD_HEIGHT } from '../constants/defaultData';
import {
  DriedOrangeFlowersSVG,
  VerticalBarcodeSVG,
  VintageCherubSVG,
  WhiteRosesBouquetSVG,
  WatercolorHeartSVG,
} from './StickersAndVectors';

interface ScrapbookSpreadProps {
  photos: SpreadPhotosMap;
  onSelectPhotoSlot: (slot: PhotoSlotKey) => void;
}

export const ScrapbookSpread: React.FC<ScrapbookSpreadProps> = ({
  photos,
  onSelectPhotoSlot,
}) => {
  const [isPlayingRetroMusic, setIsPlayingRetroMusic] = useState(false);

  return (
    <View style={styles.outerBookCoverBase}>
      {/* Hojas apiladas debajo en los bordes (dando volumen de 5 páginas) */}
      <View style={[styles.stackedSheet, styles.sheetLayer5]} />
      <View style={[styles.stackedSheet, styles.sheetLayer4]} />
      <View style={[styles.stackedSheet, styles.sheetLayer3]} />
      <View style={[styles.stackedSheet, styles.sheetLayer2]} />

      {/* Pliego doble principal */}
      <View style={styles.mainSpreadPaper}>
        {/* Textura de papel rasgado decorativa en esquinas */}
        <View style={styles.tornPaperTopLeft} />
        <View style={styles.tornPaperBottomRight} />

        {/* ==================== SECCIÓN IZQUIERDA DEL PLIEGO ==================== */}
        <View style={styles.leftPage}>
          {/* 1. Arriba: Marco estilo ventana de navegador web retro */}
          <View style={styles.retroBrowserContainer}>
            <View style={styles.retroBrowserHeader}>
              <View style={styles.browserDotsRow}>
                <View style={[styles.browserDot, { backgroundColor: '#E05A47' }]} />
                <View style={[styles.browserDot, { backgroundColor: '#F2C94C' }]} />
                <View style={[styles.browserDot, { backgroundColor: '#6FCF97' }]} />
              </View>
              <View style={styles.browserAddressBar}>
                <Text style={styles.browserUrlText}>http://our-memories.love</Text>
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

            {/* Etiqueta ovalada roja y blanca superpuesta en esquina inferior derecha */}
            <View style={styles.ovalStickerContainer}>
              <View style={styles.ovalStickerInner}>
                <Text style={styles.ovalStickerText}>
                  It&apos;s me and you. Always
                </Text>
              </View>
            </View>
          </View>

          {/* 2. Centro-Izquierda: Sticker de flores naranjas secas + recorte máquina de escribir */}
          <View style={styles.centerLeftRow}>
            <View style={styles.driedFlowersWrapper}>
              <DriedOrangeFlowersSVG width={84} height={110} />
            </View>

            <View style={styles.typewriterPaperCutout}>
              <View style={styles.maskingTapeTop} />
              <Text style={styles.typewriterText}>Lucky is to have you.</Text>
            </View>
          </View>

          {/* 3. Abajo: Marco de foto horizontal flanqueado por códigos de barras + recorte "home." */}
          <View style={styles.vintageTicketFrame}>
            <VerticalBarcodeSVG height={116} />
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
            <VerticalBarcodeSVG height={116} />

            {/* Recorte de papel en la esquina inferior izquierda que dice "home." */}
            <View style={styles.homePaperCutout}>
              <Text style={styles.homeCutoutText}>home.</Text>
            </View>
          </View>
        </View>

        {/* ==================== UNIÓN CENTRAL / PLIEGUE DEL CUADERNO ==================== */}
        <LinearGradient
          colors={[
            'rgba(60, 48, 38, 0.02)',
            'rgba(60, 48, 38, 0.18)',
            'rgba(35, 25, 18, 0.34)',
            'rgba(60, 48, 38, 0.18)',
            'rgba(60, 48, 38, 0.02)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.centerFoldShadow}
          pointerEvents="none"
        />

        {/* ==================== SECCIÓN DERECHA DEL PLIEGO ==================== */}
        <View style={styles.rightPage}>
          {/* Columna izquierda/central de la página derecha */}
          <View style={styles.rightPageMainArea}>
            {/* Centro-Izquierda: Tarjeta blanca estilo letras de Spotify "Daylight - Taylor Swift" */}
            <View style={styles.spotifyLyricsRow}>
              <View style={styles.spotifyCard}>
                <View style={styles.spotifyHeader}>
                  <Ionicons name="musical-notes" size={13} color="#1DB954" />
                  <Text style={styles.spotifyTrackTitle}>
                    Daylight - Taylor Swift
                  </Text>
                </View>
                <Text style={styles.spotifyLyricsText}>
                  &ldquo;I don&apos;t wanna look at anything else now that I saw you
                  {'\n'}(I can never look away)&rdquo;
                </Text>
                <View style={styles.spotifyFooterBar}>
                  <View style={styles.spotifyProgressFill} />
                </View>
              </View>

              {/* Columna vertical de 5 pequeños corazones rojos a su derecha */}
              <View style={styles.fiveHeartsColumn}>
                {[0, 1, 2, 3, 4].map((h) => (
                  <WatercolorHeartSVG
                    key={h}
                    size={16}
                    rotation={h % 2 === 0 ? -8 : 8}
                  />
                ))}
              </View>
            </View>

            {/* Abajo: Marco tipo Polaroid horizontal junto al ramo de rosas blancas */}
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
                <Text style={styles.polaroidCaption}>forever &amp; ever ♡</Text>
              </View>

              <View style={styles.rosesStickerWrapper}>
                <WhiteRosesBouquetSVG width={84} height={112} />
              </View>
            </View>
          </View>

          {/* Extremo Derecho (de arriba a abajo): Tira vertical de negativo 35mm con 5 fotos */}
          <View style={styles.filmStripContainer}>
            {/* Perforaciones izquierdas del negativo */}
            <View style={styles.filmSprocketColumn}>
              {Array.from({ length: 24 }).map((_, i) => (
                <View key={`l-${i}`} style={styles.sprocketHole} />
              ))}
            </View>

            {/* 5 recuadros verticales interactivos */}
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

              {/* Pequeños corazones rojos decorativos en la base de la tira 35mm */}
              <View style={styles.filmBaseHeartsRow}>
                <WatercolorHeartSVG size={13} rotation={-12} />
                <WatercolorHeartSVG size={15} rotation={5} />
                <WatercolorHeartSVG size={13} rotation={14} />
              </View>
            </View>

            {/* Perforaciones derechas del negativo */}
            <View style={styles.filmSprocketColumn}>
              {Array.from({ length: 24 }).map((_, i) => (
                <View key={`r-${i}`} style={styles.sprocketHole} />
              ))}
            </View>
          </View>
        </View>

        {/* ==================== SECCIÓN CENTRAL (CRUZANDO EL PLIEGUE) ==================== */}
        {/* 1. Arriba en el centro: Widget flotante amarillo (#F5C242) estilo reproductor retro */}
        <View style={styles.centerTopMusicWidget}>
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
            {/* Sticker "my favorite person" */}
            <View style={styles.favoritePersonSticker}>
              <Text style={styles.favoritePersonText}>my favorite person</Text>
            </View>
          </Pressable>

          {/* Controles de reproducción (|<<, ||, >>|) */}
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

        {/* 2. Abajo en el centro: Tres etiquetas rojo/blanco + sticker vintage de querubín */}
        <View style={styles.centerBottomCherubCluster}>
          <View style={styles.threeLabelsStack}>
            <View style={[styles.redWhiteLabel, { transform: [{ rotate: '-3deg' }] }]}>
              <Text style={styles.redWhiteLabelText}>I truly love you</Text>
            </View>
            <View style={[styles.redWhiteLabel, { transform: [{ rotate: '2deg' }] }]}>
              <Text style={styles.redWhiteLabelText}>with all my</Text>
            </View>
            <View style={[styles.redWhiteLabel, { transform: [{ rotate: '-2deg' }] }]}>
              <Text style={styles.redWhiteLabelText}>heart</Text>
            </View>
          </View>

          <View style={styles.cherubStickerWrapper}>
            <VintageCherubSVG size={78} />
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
  leftPage: {
    width: SPREAD_WIDTH / 2,
    height: '100%',
    paddingTop: 22,
    paddingLeft: 24,
    paddingRight: 52,
    paddingBottom: 20,
    justifyContent: 'space-between',
  },
  rightPage: {
    width: SPREAD_WIDTH / 2,
    height: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 56,
    paddingRight: 14,
    paddingVertical: 16,
  },
  centerFoldShadow: {
    position: 'absolute',
    left: SPREAD_WIDTH / 2 - 22,
    top: 0,
    bottom: 0,
    width: 44,
    zIndex: 5,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  photoEditBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(20, 20, 20, 0.55)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* --- Sección Izquierda: Ventana Retro --- */
  retroBrowserContainer: {
    width: 340,
    height: 228,
    backgroundColor: '#F4EFE6',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#2D2A26',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
    position: 'relative',
  },
  retroBrowserHeader: {
    height: 28,
    backgroundColor: '#E5DEC9',
    borderBottomWidth: 2,
    borderBottomColor: '#2D2A26',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  browserDotsRow: {
    flexDirection: 'row',
    gap: 5,
  },
  browserDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1,
    borderColor: '#2D2A26',
  },
  browserAddressBar: {
    flex: 1,
    marginHorizontal: 10,
    height: 17,
    backgroundColor: '#FFFDF9',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#8C8275',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  browserUrlText: {
    fontSize: 9,
    fontFamily: monoFont,
    color: '#4A453E',
  },
  browserControlsRight: {
    flexDirection: 'row',
    gap: 6,
  },
  browserControlSymbol: {
    fontSize: 11,
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
    bottom: -14,
    right: -18,
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-6deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  ovalStickerInner: {
    backgroundColor: '#C92A2A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 32,
  },
  ovalStickerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /* --- Sección Izquierda: Centro (Flores + Máquina de escribir) --- */
  centerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 12,
  },
  driedFlowersWrapper: {
    transform: [{ rotate: '-8deg' }],
  },
  typewriterPaperCutout: {
    backgroundColor: '#F7F2E4',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#D8CEBE',
    transform: [{ rotate: '2.5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 3,
    elevation: 3,
  },
  maskingTapeTop: {
    position: 'absolute',
    top: -7,
    left: '38%',
    width: 46,
    height: 13,
    backgroundColor: 'rgba(238, 224, 189, 0.85)',
    transform: [{ rotate: '-4deg' }],
  },
  typewriterText: {
    fontFamily: monoFont,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2B2623',
    letterSpacing: 0.4,
  },
  /* --- Sección Izquierda: Abajo (Ticket Vintage con Códigos de Barras) --- */
  vintageTicketFrame: {
    width: 348,
    height: 132,
    backgroundColor: '#F5EFE0',
    borderWidth: 1.5,
    borderColor: '#3A332C',
    borderRadius: 6,
    padding: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 4,
    position: 'relative',
  },
  ticketPhotoSlot: {
    flex: 1,
    height: '100%',
    marginHorizontal: 7,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#DDD6C7',
  },
  homePaperCutout: {
    position: 'absolute',
    bottom: -10,
    left: 16,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#C7BFA8',
    transform: [{ rotate: '-5deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
  },
  homeCutoutText: {
    fontFamily: serifFont,
    fontSize: 15,
    fontWeight: '700',
    color: '#231F20',
    fontStyle: 'italic',
  },
  /* --- Sección Central: Reproductor Amarillo (#F5C242) --- */
  centerTopMusicWidget: {
    position: 'absolute',
    top: 28,
    left: SPREAD_WIDTH / 2 - 88,
    width: 176,
    backgroundColor: '#F5C242',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2B2623',
    padding: 8,
    zIndex: 20,
    transform: [{ rotate: '2deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  musicWidgetTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  musicWindowDots: {
    fontSize: 13,
    fontWeight: '900',
    color: '#2B2623',
    lineHeight: 14,
  },
  musicWindowRightBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  musicWindowBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2B2623',
    fontFamily: monoFont,
  },
  musicSquarePhoto: {
    width: '100%',
    height: 134,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#2B2623',
    overflow: 'hidden',
    backgroundColor: '#E2D9C5',
    position: 'relative',
  },
  favoritePersonSticker: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-3deg' }],
  },
  favoritePersonText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C92A2A',
  },
  musicControlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 3,
    backgroundColor: '#FCE38A',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2B2623',
  },
  musicControlIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2B2623',
    fontFamily: monoFont,
  },
  musicPlayButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  musicControlIconBold: {
    fontSize: 12,
    fontWeight: '900',
    color: '#B92B27',
  },
  /* --- Sección Central Abajo: 3 etiquetas rojas/blancas + Querubín --- */
  centerBottomCherubCluster: {
    position: 'absolute',
    bottom: 24,
    left: SPREAD_WIDTH / 2 - 84,
    width: 170,
    alignItems: 'center',
    zIndex: 20,
  },
  threeLabelsStack: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  redWhiteLabel: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#C92A2A',
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  redWhiteLabelText: {
    color: '#C92A2A',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: monoFont,
  },
  cherubStickerWrapper: {
    marginTop: 2,
  },
  /* --- Sección Derecha: Spotify Lyrics + Polaroid + Tira 35mm --- */
  rightPageMainArea: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: 14,
    paddingBottom: 8,
  },
  spotifyLyricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 155,
  },
  spotifyCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6E1D6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  spotifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  spotifyTrackTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#191414',
  },
  spotifyLyricsText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 16,
    fontStyle: 'italic',
  },
  spotifyFooterBar: {
    marginTop: 8,
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
    height: 104,
    alignItems: 'center',
  },
  bottomRightPolaroidArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  polaroidFrame: {
    width: 196,
    height: 162,
    backgroundColor: '#FFFFFF',
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 26,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0D9C8',
    transform: [{ rotate: '-3deg' }],
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    alignItems: 'center',
  },
  polaroidTape: {
    position: 'absolute',
    top: -8,
    width: 54,
    height: 15,
    backgroundColor: 'rgba(244, 231, 198, 0.82)',
    transform: [{ rotate: '4deg' }],
    zIndex: 5,
  },
  polaroidPhotoBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#D8D2C5',
    overflow: 'hidden',
  },
  polaroidCaption: {
    marginTop: 5,
    fontSize: 11,
    color: '#4A433C',
    fontStyle: 'italic',
    fontFamily: serifFont,
  },
  rosesStickerWrapper: {
    marginLeft: -8,
    marginBottom: 4,
    transform: [{ rotate: '7deg' }],
  },
  /* --- Extremo Derecho: Tira de Película 35mm --- */
  filmStripContainer: {
    width: 108,
    height: '100%',
    backgroundColor: '#161616',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 6,
    elevation: 7,
  },
  filmSprocketColumn: {
    width: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sprocketHole: {
    width: 6,
    height: 9,
    borderRadius: 1.5,
    backgroundColor: '#FDFBF2',
    opacity: 0.9,
  },
  filmFramesColumn: {
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'space-between',
  },
  filmPhotoSlot: {
    width: '100%',
    height: 94,
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
    right: 4,
    fontSize: 7.5,
    color: '#F59F00',
    fontFamily: monoFont,
    fontWeight: '700',
  },
  filmBaseHeartsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingTop: 2,
  },
});
