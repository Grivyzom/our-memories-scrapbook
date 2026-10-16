import React, { useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BLOCK_CATALOG, CONTENT_WIDTH, HALF_WIDTH } from '../../constants/blockCatalog';
import { PageBlock } from '../../types/scrapbook';
import {
  DriedOrangeFlowers,
  VerticalBarcode,
  VintageCherub,
  WatercolorHeart,
  WhiteRosesBouquet,
} from '../Stickers';

export interface BlockViewProps {
  block: PageBlock;
  /** Toca un hueco de foto; sin callback el libro es de sólo lectura. */
  onPressPhoto?: (blockId: string, photoIndex: number) => void;
  onPhotoLoaded?: (blockId: string, photoIndex: number, uri: string) => void;
}

/** Hueco de foto: la imagen elegida o, si está vacío, una invitación a elegirla. */
const PhotoSlot: React.FC<
  BlockViewProps & { index: number; style?: any; iconSize?: number; dark?: boolean }
> = ({ block, index, onPressPhoto, onPhotoLoaded, style, iconSize = 12, dark }) => {
  const uri = block.photos[index];
  const content = uri ? (
    <>
      <Image
        source={{ uri }}
        onLoadEnd={() => onPhotoLoaded?.(block.id, index, uri)}
        style={styles.fullImage}
        resizeMode="cover"
        fadeDuration={0}
      />
      {onPressPhoto && (
        <View style={styles.photoEditBadge}>
          <Ionicons name="camera" size={iconSize} color="#FFF" />
        </View>
      )}
    </>
  ) : (
    <View style={[styles.emptyPhoto, dark && styles.emptyPhotoDark]}>
      <Ionicons
        name={onPressPhoto ? 'add-circle-outline' : 'image-outline'}
        size={iconSize * 2}
        color={dark ? 'rgba(255,255,255,0.45)' : 'rgba(110, 90, 60, 0.45)'}
      />
      {onPressPhoto && iconSize >= 11 && (
        <Text style={[styles.emptyPhotoText, dark && styles.emptyPhotoTextDark]}>Elegir foto</Text>
      )}
    </View>
  );
  if (!onPressPhoto) return <View style={style}>{content}</View>;
  return (
    <Pressable onPress={() => onPressPhoto(block.id, index)} style={style}>
      {content}
    </Pressable>
  );
};

const MusicPlayer: React.FC<BlockViewProps> = (props) => {
  const [playing, setPlaying] = useState(false);
  const { block } = props;
  return (
    <View style={styles.music}>
      <View style={styles.musicTopBar}>
        <Text style={styles.musicDots}>...</Text>
        <View style={styles.musicRightBtns}>
          <Text style={styles.musicBtnText}>o</Text>
          <Text style={styles.musicBtnText}>x</Text>
        </View>
      </View>
      <PhotoSlot {...props} index={0} style={styles.musicPhoto} iconSize={11} />
      {!!block.text && (
        <View style={styles.favoriteSticker} pointerEvents="none">
          <Text style={styles.favoriteText} numberOfLines={1}>
            {block.text}
          </Text>
        </View>
      )}
      <View style={styles.musicControls}>
        <Text style={styles.musicControlIcon}>|&lt;&lt;</Text>
        <Pressable onPress={() => setPlaying((p) => !p)} style={styles.musicPlayButton} hitSlop={6}>
          <Text style={styles.musicControlIconBold}>{playing ? '||' : '▶'}</Text>
        </Pressable>
        <Text style={styles.musicControlIcon}>&gt;&gt;|</Text>
      </View>
    </View>
  );
};

const StickerArt: React.FC<{ block: PageBlock }> = ({ block }) => {
  switch (block.sticker) {
    case 'roses':
      return (
        <View style={{ transform: [{ rotate: '6deg' }] }}>
          <WhiteRosesBouquet width={74} height={94} />
        </View>
      );
    case 'cherub':
      return <VintageCherub size={80} />;
    case 'hearts':
      return (
        <View style={styles.heartsCluster}>
          <WatercolorHeart size={30} rotation={-12} />
          <WatercolorHeart size={22} rotation={10} />
          <WatercolorHeart size={26} rotation={-4} />
          <WatercolorHeart size={18} rotation={14} />
        </View>
      );
    case 'flowers':
    default:
      return (
        <View style={{ transform: [{ rotate: '-6deg' }] }}>
          <DriedOrangeFlowers width={72} height={90} />
        </View>
      );
  }
};

/** Dibuja un componente del catálogo con su tamaño fijo. */
export const PageBlockView: React.FC<BlockViewProps> = React.memo((props) => {
  const { block } = props;
  const def = BLOCK_CATALOG[block.type];
  const size = {
    width: def.size === 'full' ? CONTENT_WIDTH : HALF_WIDTH,
    height: def.height,
  };

  switch (block.type) {
    case 'title':
      return (
        <View style={[size, styles.titleRow]}>
          {!!block.subtitle && (
            <View style={styles.washiTapeBadge}>
              <Text style={styles.washiTapeText} numberOfLines={1}>
                {block.subtitle}
              </Text>
            </View>
          )}
          <Text style={styles.titleText} numberOfLines={1}>
            {block.text}
          </Text>
        </View>
      );

    case 'browser':
      return (
        <View style={size}>
          <View style={styles.browser}>
            <View style={styles.browserHeader}>
              <View style={styles.browserDotsRow}>
                <View style={[styles.browserDot, { backgroundColor: '#E05A47' }]} />
                <View style={[styles.browserDot, { backgroundColor: '#F2C94C' }]} />
                <View style={[styles.browserDot, { backgroundColor: '#6FCF97' }]} />
              </View>
              <View style={styles.browserAddressBar}>
                <Text style={styles.browserUrlText} numberOfLines={1}>
                  {block.subtitle || 'http://nuestros-recuerdos.love'}
                </Text>
              </View>
              <View style={styles.browserControlsRight}>
                <Text style={styles.browserControlSymbol}>_</Text>
                <Text style={styles.browserControlSymbol}>□</Text>
                <Text style={styles.browserControlSymbol}>×</Text>
              </View>
            </View>
            <PhotoSlot {...props} index={0} style={styles.browserPhoto} />
          </View>
          {!!block.text && (
            <View style={styles.ovalSticker} pointerEvents="none">
              <View style={styles.ovalStickerInner}>
                <Text style={styles.ovalStickerText} numberOfLines={1}>
                  {block.text}
                </Text>
              </View>
            </View>
          )}
        </View>
      );

    case 'music':
      return (
        <View style={[size, styles.center]}>
          <MusicPlayer {...props} />
        </View>
      );

    case 'polaroid':
      return (
        <View style={[size, styles.center]}>
          <View style={styles.polaroid}>
            <View style={styles.polaroidTape} />
            <PhotoSlot {...props} index={0} style={styles.polaroidPhoto} />
            <Text style={styles.polaroidCaption} numberOfLines={1}>
              {block.text}
            </Text>
          </View>
        </View>
      );

    case 'ticket':
      return (
        <View style={size}>
          <View style={styles.ticket}>
            <VerticalBarcode height={size.height - 16} />
            <PhotoSlot {...props} index={0} style={styles.ticketPhoto} />
            <VerticalBarcode height={size.height - 16} />
          </View>
          {!!block.text && (
            <View style={styles.homeCutout} pointerEvents="none">
              <Text style={styles.homeCutoutText} numberOfLines={1}>
                {block.text}
              </Text>
            </View>
          )}
        </View>
      );

    case 'film':
      return (
        <View style={[size, styles.film]}>
          <View style={styles.sprocketRow}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={`t${i}`} style={styles.sprocketHole} />
            ))}
          </View>
          <View style={styles.filmFrames}>
            {block.photos.map((_, i) => (
              <View key={i} style={styles.filmFrame}>
                <PhotoSlot {...props} index={i} style={styles.fullImage} iconSize={9} dark />
                <Text style={styles.filmFrameNumber}>{`0${i + 1}A`}</Text>
              </View>
            ))}
          </View>
          <View style={styles.sprocketRow}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View key={`b${i}`} style={styles.sprocketHole} />
            ))}
          </View>
        </View>
      );

    case 'note':
      return (
        <View style={[size, styles.center]}>
          <View style={styles.typewriter}>
            <View style={styles.maskingTape} />
            <Text style={styles.typewriterText} numberOfLines={4}>
              {block.text}
            </Text>
          </View>
        </View>
      );

    case 'song':
      return (
        <View style={[size, styles.songRow]}>
          <View style={styles.songCard}>
            <View style={styles.songHeader}>
              <Ionicons name="musical-notes" size={13} color="#1DB954" />
              <Text style={styles.songTitle} numberOfLines={1}>
                {block.text}
              </Text>
            </View>
            {!!block.subtitle && (
              <Text style={styles.songLyrics} numberOfLines={2}>
                &ldquo;{block.subtitle}&rdquo;
              </Text>
            )}
            <View style={styles.songProgress}>
              <View style={styles.songProgressFill} />
            </View>
          </View>
          <View style={styles.heartsColumn}>
            {[0, 1, 2, 3].map((h) => (
              <WatercolorHeart key={h} size={15} rotation={h % 2 === 0 ? -8 : 8} />
            ))}
          </View>
        </View>
      );

    case 'loveLabels': {
      const lines = block.text
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 3);
      return (
        <View style={[size, styles.labelsStack]}>
          {lines.map((line, i) => (
            <View
              key={i}
              style={[styles.redWhiteLabel, { transform: [{ rotate: `${[-2.5, 2, -1.5][i]}deg` }] }]}
            >
              <Text style={styles.redWhiteLabelText} numberOfLines={1}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      );
    }

    case 'sticker':
      return (
        <View style={[size, styles.center]}>
          <StickerArt block={block} />
        </View>
      );

    default:
      return null;
  }
});

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  emptyPhoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#E9E1D1',
  },
  emptyPhotoDark: {
    backgroundColor: '#2C2C2C',
  },
  emptyPhotoText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(110, 90, 60, 0.6)',
  },
  emptyPhotoTextDark: {
    color: 'rgba(255,255,255,0.5)',
  },

  /* --- Título --- */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  washiTapeBadge: {
    backgroundColor: '#E6D7BD',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#CDBFA3',
    transform: [{ rotate: '-1.5deg' }],
    maxWidth: 150,
  },
  washiTapeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#5A4632',
    fontFamily: monoFont,
    letterSpacing: 0.8,
  },
  titleText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#8A7760',
    fontFamily: serifFont,
    fontStyle: 'italic',
  },

  /* --- Ventana retro --- */
  browser: {
    flex: 1,
    backgroundColor: '#F4EFE6',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2D2A26',
    overflow: 'hidden',
  },
  browserHeader: {
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
  browserPhoto: {
    flex: 1,
    backgroundColor: '#D8D0C5',
    overflow: 'hidden',
  },
  ovalSticker: {
    position: 'absolute',
    bottom: -6,
    right: -4,
    backgroundColor: '#FFFFFF',
    padding: 3,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-4deg' }],
    maxWidth: 220,
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

  /* --- Reproductor --- */
  music: {
    width: 170,
    height: '100%',
    backgroundColor: '#F5C242',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#2B2623',
    padding: 7,
    transform: [{ rotate: '1.5deg' }],
  },
  musicTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    paddingHorizontal: 2,
  },
  musicDots: {
    fontSize: 12,
    fontWeight: '900',
    color: '#2B2623',
    lineHeight: 12,
  },
  musicRightBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  musicBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2B2623',
    fontFamily: monoFont,
  },
  musicPhoto: {
    flex: 1,
    borderRadius: 5,
    borderWidth: 1.2,
    borderColor: '#2B2623',
    overflow: 'hidden',
    backgroundColor: '#E2D9C5',
  },
  favoriteSticker: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C92A2A',
    transform: [{ rotate: '-2deg' }],
    maxWidth: 150,
  },
  favoriteText: {
    fontSize: 8.5,
    fontWeight: '800',
    color: '#C92A2A',
  },
  musicControls: {
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

  /* --- Polaroid --- */
  polaroid: {
    width: 184,
    height: '96%',
    backgroundColor: '#FFFFFF',
    paddingTop: 9,
    paddingHorizontal: 9,
    paddingBottom: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0D9C8',
    transform: [{ rotate: '-2.5deg' }],
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
  polaroidPhoto: {
    width: '100%',
    flex: 1,
    backgroundColor: '#D8D2C5',
    overflow: 'hidden',
  },
  polaroidCaption: {
    marginTop: 6,
    marginBottom: 2,
    fontSize: 11,
    color: '#4A433C',
    fontStyle: 'italic',
    fontFamily: serifFont,
  },

  /* --- Ticket --- */
  ticket: {
    flex: 1,
    backgroundColor: '#F5EFE0',
    borderWidth: 1.5,
    borderColor: '#3A332C',
    borderRadius: 6,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ticketPhoto: {
    flex: 1,
    height: '100%',
    marginHorizontal: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#DDD6C7',
  },
  homeCutout: {
    position: 'absolute',
    bottom: -8,
    left: 14,
    backgroundColor: '#FFFDF8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#C7BFA8',
    transform: [{ rotate: '-4deg' }],
    maxWidth: 240,
  },
  homeCutoutText: {
    fontFamily: serifFont,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#231F20',
    fontStyle: 'italic',
  },

  /* --- Tira de negativos (horizontal) --- */
  film: {
    backgroundColor: '#161616',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    justifyContent: 'space-between',
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  sprocketHole: {
    width: 8,
    height: 5.5,
    borderRadius: 1.5,
    backgroundColor: '#FDFBF2',
    opacity: 0.85,
  },
  filmFrames: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    marginVertical: 4,
  },
  filmFrame: {
    flex: 1,
    backgroundColor: '#2C2C2C',
    borderRadius: 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3D3D3D',
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

  /* --- Nota --- */
  typewriter: {
    backgroundColor: '#F7F2E4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D8CEBE',
    transform: [{ rotate: '2deg' }],
    maxWidth: '100%',
  },
  maskingTape: {
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

  /* --- Canción --- */
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6E1D6',
  },
  songHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  songTitle: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#191414',
  },
  songLyrics: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2E2A27',
    lineHeight: 14.5,
    fontStyle: 'italic',
  },
  songProgress: {
    marginTop: 6,
    height: 3,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    overflow: 'hidden',
  },
  songProgressFill: {
    width: '68%',
    height: '100%',
    backgroundColor: '#C92A2A',
  },
  heartsColumn: {
    marginLeft: 8,
    justifyContent: 'space-between',
    height: 80,
    alignItems: 'center',
  },

  /* --- Etiquetas --- */
  labelsStack: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  redWhiteLabel: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1.3,
    borderColor: '#C92A2A',
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 4,
    maxWidth: '100%',
  },
  redWhiteLabelText: {
    color: '#C92A2A',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: monoFont,
  },

  /* --- Stickers --- */
  heartsCluster: {
    width: 80,
    height: 80,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
