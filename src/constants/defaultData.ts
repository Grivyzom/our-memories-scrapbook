import { PhotoSlotKey, ScrapbookSpreadData, SpreadPhotosMap } from '../types/scrapbook';

export const DEFAULT_PHOTOS: SpreadPhotosMap = {
  browserMain:
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=1200&q=90',
  ticketHorizontal:
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=1200&q=90',
  musicPlayer:
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=1000&q=90',
  polaroidBottom:
    'https://images.unsplash.com/photo-1529634597503-139d3726fed5?auto=format&fit=crop&w=1200&q=90',
  film1:
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=800&q=90',
  film2:
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=90',
  film3:
    'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=800&q=90',
  film4:
    'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?auto=format&fit=crop&w=800&q=90',
  film5:
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=90',
};

export const INITIAL_SPREADS: ScrapbookSpreadData[] = [
  {
    id: 'spread-1',
    title: 'Pliego 1',
    photos: { ...DEFAULT_PHOTOS },
  },
  {
    id: 'spread-2',
    title: 'Pliego 2',
    photos: { ...DEFAULT_PHOTOS },
  },
  {
    id: 'spread-3',
    title: 'Pliego 3',
    photos: { ...DEFAULT_PHOTOS },
  },
];

export const PHOTO_SLOT_LABELS: Record<PhotoSlotKey, string> = {
  browserMain: 'Ventana Retro (Página A)',
  musicPlayer: 'Reproductor Musical (Página A)',
  ticketHorizontal: 'Ticket Vintage (Página A)',
  polaroidBottom: 'Polaroid (Página B)',
  film1: 'Negativo 35mm #1 (Página B)',
  film2: 'Negativo 35mm #2 (Página B)',
  film3: 'Negativo 35mm #3 (Página B)',
  film4: 'Negativo 35mm #4 (Página B)',
  film5: 'Negativo 35mm #5 (Página B)',
};

// Dimensiones virtuales fijas del pliego doble para mantener proporciones exactas de collage
export const SPREAD_WIDTH = 920;
export const SPREAD_HEIGHT = 600;

// Tapa exterior del pliego (márgenes de cuero alrededor de las hojas)
export const SPREAD_OUTER_WIDTH = SPREAD_WIDTH + 28;

// Encuadre "Ambas Páginas": escala del pliego y su inclinación sobre la mesa.
// La portada 3D termina su apertura exactamente en este encuadre para que el
// libro abierto sea el mismo objeto que se ve al abrir la tapa.
export const getFullSpreadScale = (screenWidth: number) =>
  (screenWidth * 0.95) / SPREAD_OUTER_WIDTH;
export const OPEN_BOOK_TILT = 16;
