import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPREAD_HEIGHT } from '../../constants/defaultData';
import {
  BLOCK_GAP,
  PAGE_FOOTER_HEIGHT,
  PAGE_PADDING_OUTER,
  PAGE_PADDING_SPINE,
  PAGE_PADDING_TOP,
  PAGE_WIDTH,
} from '../../constants/blockCatalog';
import { BookPage, PageSide } from '../../types/scrapbook';
import { PageBlockView } from './PageBlockView';

interface BookPageViewProps {
  page: BookPage;
  side: PageSide;
  pageNumber: number;
  onPressPhoto?: (side: PageSide, blockId: string, photoIndex: number) => void;
  onPhotoLoaded?: (blockId: string, photoIndex: number, uri: string) => void;
  /** Página vacía: invita a abrir el editor (sólo en el libro propio). */
  onPressEmpty?: (side: PageSide) => void;
}

/**
 * Una página del libro: los componentes elegidos por el usuario, en su orden,
 * apilados en filas de ancho completo o de dos medios.
 */
export const BookPageView: React.FC<BookPageViewProps> = React.memo(
  ({ page, side, pageNumber, onPressPhoto, onPhotoLoaded, onPressEmpty }) => {
    const isLeft = side === 'left';
    const handlePhoto = onPressPhoto
      ? (blockId: string, index: number) => onPressPhoto(side, blockId, index)
      : undefined;

    return (
      <View
        style={[
          styles.page,
          {
            paddingLeft: isLeft ? PAGE_PADDING_OUTER : PAGE_PADDING_SPINE,
            paddingRight: isLeft ? PAGE_PADDING_SPINE : PAGE_PADDING_OUTER,
          },
        ]}
      >
        {page.blocks.length === 0 ? (
          <Pressable
            disabled={!onPressEmpty}
            onPress={() => onPressEmpty?.(side)}
            style={styles.emptyPage}
          >
            {onPressEmpty ? (
              <>
                <Ionicons name="add-circle-outline" size={42} color="rgba(138, 119, 96, 0.55)" />
                <Text style={styles.emptyTitle}>Página en blanco</Text>
                <Text style={styles.emptyText}>
                  Toca aquí para añadir fotos, notas{'\n'}y stickers a tu gusto
                </Text>
              </>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.blocks}>
            {page.blocks.map((block) => (
              <PageBlockView
                key={block.id}
                block={block}
                onPressPhoto={handlePhoto}
                onPhotoLoaded={onPhotoLoaded}
              />
            ))}
          </View>
        )}

        <View style={[styles.footer, { justifyContent: isLeft ? 'flex-start' : 'flex-end' }]}>
          <Text style={styles.pageNumberText}>pág. {pageNumber}</Text>
        </View>
      </View>
    );
  }
);

const monoFont = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: SPREAD_HEIGHT,
    paddingTop: PAGE_PADDING_TOP,
  },
  blocks: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignContent: 'flex-start',
    columnGap: BLOCK_GAP,
    rowGap: BLOCK_GAP,
  },
  emptyPage: {
    flex: 1,
    margin: 6,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(138, 119, 96, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: serifFont,
    color: 'rgba(138, 119, 96, 0.8)',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    color: 'rgba(138, 119, 96, 0.7)',
  },
  footer: {
    height: PAGE_FOOTER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageNumberText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#A89984',
    fontFamily: monoFont,
  },
});
