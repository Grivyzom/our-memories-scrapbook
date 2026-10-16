/** Componentes que el usuario puede colocar en una página del libro. */
export type BlockType =
  | 'title'
  | 'polaroid'
  | 'browser'
  | 'music'
  | 'ticket'
  | 'film'
  | 'note'
  | 'song'
  | 'loveLabels'
  | 'sticker';

export type StickerKind = 'flowers' | 'roses' | 'cherub' | 'hearts';

export interface PageBlock {
  id: string;
  type: BlockType;
  /** URIs de las fotos del componente ('' = marco vacío). */
  photos: string[];
  /** Texto principal (título, nota, pie de foto, canción...). */
  text: string;
  /** Texto secundario (subtítulo, letra de la canción...). */
  subtitle: string;
  sticker?: StickerKind;
}

export interface BookPage {
  blocks: PageBlock[];
}

export type PageSide = 'left' | 'right';

export interface ScrapbookSpreadData {
  id: string;
  title: string;
  left: BookPage;
  right: BookPage;
}

/** Libro completo: lo que se guarda y lo que se comparte. */
export interface Book {
  version: 2;
  id: string;
  title: string;
  /** Persona a la que se dedica el libro (opcional). */
  dedicatedTo?: string;
  spreads: ScrapbookSpreadData[];
}

/** Hueco de foto concreto dentro de un pliego. */
export interface PhotoSlotRef {
  side: PageSide;
  blockId: string;
  photoIndex: number;
}

export type CameraFocusZone = 'left' | 'center' | 'right' | 'full' | 'landscape90';
