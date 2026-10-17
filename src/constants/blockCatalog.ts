import { Ionicons } from '@expo/vector-icons';
import { SPREAD_HEIGHT, SPREAD_WIDTH } from './defaultData';
import { Book, BlockType, PageBlock, PageSide, StickerKind } from '../types/scrapbook';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ---- Geometría de una página (unidades del pliego virtual) ----
 * Los componentes se apilan en filas: uno de ancho completo o dos de medio
 * ancho. Cada componente tiene un alto fijo, así se puede saber de antemano
 * si cabe en la página y el diseño nunca se desborda. */
export const PAGE_WIDTH = SPREAD_WIDTH / 2;
export const PAGE_PADDING_OUTER = 20;
// Lado del lomo: deja sitio a la costura central
export const PAGE_PADDING_SPINE = 26;
export const PAGE_PADDING_TOP = 16;
export const PAGE_FOOTER_HEIGHT = 24;
export const CONTENT_WIDTH = PAGE_WIDTH - PAGE_PADDING_OUTER - PAGE_PADDING_SPINE;
export const CONTENT_HEIGHT = SPREAD_HEIGHT - PAGE_PADDING_TOP - PAGE_FOOTER_HEIGHT;
export const BLOCK_GAP = 10;
export const HALF_WIDTH = (CONTENT_WIDTH - BLOCK_GAP) / 2;

export type BlockSize = 'full' | 'half';

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  icon: IconName;
  size: BlockSize;
  height: number;
  photoCount: number;
  /** Etiquetas de los campos de texto editables (sin etiqueta = no editable). */
  textLabel?: string;
  subtitleLabel?: string;
  defaults: { text: string; subtitle: string };
}

export const BLOCK_CATALOG: Record<BlockType, BlockDefinition> = {
  title: {
    type: 'title',
    label: 'Título',
    description: 'Encabezado con cinta washi',
    icon: 'text',
    size: 'full',
    height: 52,
    photoCount: 0,
    textLabel: 'Título',
    subtitleLabel: 'Etiqueta',
    defaults: { text: 'Nuestra historia ❤️', subtitle: 'CAPÍTULO 1' },
  },
  polaroid: {
    type: 'polaroid',
    label: 'Polaroid',
    description: 'Foto instantánea con pie',
    icon: 'image-outline',
    size: 'half',
    height: 226,
    photoCount: 1,
    textLabel: 'Pie de foto',
    defaults: { text: 'por siempre ♡', subtitle: '' },
  },
  browser: {
    type: 'browser',
    label: 'Ventana retro',
    description: 'Foto grande en una ventana vintage',
    icon: 'browsers-outline',
    size: 'full',
    height: 200,
    photoCount: 1,
    textLabel: 'Pegatina',
    subtitleLabel: 'Dirección',
    defaults: { text: 'Tú y yo. Por siempre', subtitle: 'http://nuestros-recuerdos.love' },
  },
  music: {
    type: 'music',
    label: 'Reproductor',
    description: 'Carátula de disco con controles',
    icon: 'musical-note-outline',
    size: 'half',
    height: 200,
    photoCount: 1,
    textLabel: 'Pegatina',
    defaults: { text: 'mi persona favorita', subtitle: '' },
  },
  ticket: {
    type: 'ticket',
    label: 'Ticket vintage',
    description: 'Pase con códigos de barras',
    icon: 'ticket-outline',
    size: 'full',
    height: 120,
    photoCount: 1,
    textLabel: 'Recorte',
    defaults: { text: 'mi hogar.', subtitle: '' },
  },
  film: {
    type: 'film',
    label: 'Tira de negativos',
    description: '4 fotos en película de 35 mm',
    icon: 'film-outline',
    size: 'full',
    height: 112,
    photoCount: 4,
    defaults: { text: '', subtitle: '' },
  },
  note: {
    type: 'note',
    label: 'Nota',
    description: 'Recorte de máquina de escribir',
    icon: 'create-outline',
    size: 'half',
    height: 96,
    photoCount: 0,
    textLabel: 'Texto',
    defaults: { text: 'Qué suerte tenerte.', subtitle: '' },
  },
  song: {
    type: 'song',
    label: 'Nuestra canción',
    description: 'Tarjeta con título y letra',
    icon: 'musical-notes-outline',
    size: 'full',
    height: 100,
    photoCount: 0,
    textLabel: 'Canción',
    subtitleLabel: 'Letra',
    defaults: {
      text: 'Nuestra canción - Daylight',
      subtitle: 'No quiero mirar nada más ahora que te vi',
    },
  },
  loveLabels: {
    type: 'loveLabels',
    label: 'Etiquetas de amor',
    description: 'Hasta 3 etiquetas (una por línea)',
    icon: 'pricetags-outline',
    size: 'half',
    height: 96,
    photoCount: 0,
    textLabel: 'Etiquetas (una por línea)',
    defaults: { text: 'Te amo de verdad\ncon todo mi\ncorazón', subtitle: '' },
  },
  sticker: {
    type: 'sticker',
    label: 'Sticker',
    description: 'Ilustración decorativa',
    icon: 'happy-outline',
    size: 'half',
    height: 96,
    photoCount: 0,
    defaults: { text: '', subtitle: '' },
  },
};

export const STICKER_OPTIONS: { kind: StickerKind; label: string }[] = [
  { kind: 'flowers', label: 'Flores secas' },
  { kind: 'roses', label: 'Ramo de rosas' },
  { kind: 'cherub', label: 'Querubín' },
  { kind: 'hearts', label: 'Corazones' },
];

/** Orden en el que se ofrecen los componentes en el catálogo. */
export const CATALOG_ORDER: BlockType[] = [
  'title',
  'polaroid',
  'browser',
  'music',
  'ticket',
  'film',
  'song',
  'note',
  'loveLabels',
  'sticker',
];

/** Atajos para empezar una página en blanco con un solo toque. */
export const QUICK_START: BlockType[] = ['title', 'polaroid', 'note'];

let blockCounter = 0;
export const newBlockId = () => {
  blockCounter += 1;
  return `b${Date.now().toString(36)}${blockCounter.toString(36)}`;
};

export const createBlock = (type: BlockType, sticker?: StickerKind): PageBlock => {
  const def = BLOCK_CATALOG[type];
  return {
    id: newBlockId(),
    type,
    photos: Array.from({ length: def.photoCount }, () => ''),
    text: def.defaults.text,
    subtitle: def.defaults.subtitle,
    ...(type === 'sticker' ? { sticker: sticker ?? 'flowers' } : null),
  };
};

/**
 * Altura total que ocupan los componentes, empaquetados igual que lo hace
 * flexWrap: dos de medio ancho seguidos comparten fila.
 */
export const measureBlocks = (blocks: PageBlock[]) => {
  let height = 0;
  let rows = 0;
  let pendingHalf: number | null = null;
  const closeRow = (h: number) => {
    height += (rows > 0 ? BLOCK_GAP : 0) + h;
    rows += 1;
  };
  for (const block of blocks) {
    const def = BLOCK_CATALOG[block.type];
    if (!def) continue;
    if (def.size === 'half') {
      if (pendingHalf === null) {
        pendingHalf = def.height;
      } else {
        closeRow(Math.max(pendingHalf, def.height));
        pendingHalf = null;
      }
    } else {
      if (pendingHalf !== null) {
        closeRow(pendingHalf);
        pendingHalf = null;
      }
      closeRow(def.height);
    }
  }
  if (pendingHalf !== null) closeRow(pendingHalf);
  return height;
};

export const fitsInPage = (blocks: PageBlock[]) => measureBlocks(blocks) <= CONTENT_HEIGHT;

/** Fracción de la página ocupada (0..1+). */
export const pageFill = (blocks: PageBlock[]) => measureBlocks(blocks) / CONTENT_HEIGHT;

/* ---- Estado del libro antes de regalarlo ---- */

export interface BookSummary {
  pages: number;
  /** Páginas con al menos un componente. */
  filledPages: number;
  photos: number;
  /** Marcos de foto que siguen vacíos. */
  emptyPhotoSlots: number;
}

export const summarizeBook = (book: Book): BookSummary => {
  const summary: BookSummary = { pages: book.spreads.length * 2, filledPages: 0, photos: 0, emptyPhotoSlots: 0 };
  for (const spread of book.spreads) {
    for (const page of [spread.left, spread.right]) {
      if (page.blocks.length > 0) summary.filledPages += 1;
      for (const block of page.blocks) {
        for (const uri of block.photos) {
          if (uri) summary.photos += 1;
          else summary.emptyPhotoSlots += 1;
        }
      }
    }
  }
  return summary;
};

/** Primera página que falta completar (en blanco o con marcos sin foto). */
export const findIncompletePage = (book: Book): { spreadIndex: number; side: PageSide } | null => {
  for (const [spreadIndex, spread] of book.spreads.entries()) {
    for (const side of ['left', 'right'] as PageSide[]) {
      const blocks = spread[side].blocks;
      if (blocks.length === 0 || blocks.some((b) => b.photos.some((uri) => !uri))) {
        return { spreadIndex, side };
      }
    }
  }
  return null;
};
