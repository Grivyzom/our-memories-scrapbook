import { PhotoSlotKey, ScrapbookSpreadData, SpreadPhotosMap } from '../types/scrapbook';

export const DEFAULT_PHOTOS: SpreadPhotosMap = {
  browserMain:
    'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=900&q=80',
  ticketHorizontal:
    'https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=800&q=80',
  musicPlayer:
    'https://images.unsplash.com/photo-1518199266791-5375a83190b7?auto=format&fit=crop&w=600&q=80',
  polaroidBottom:
    'https://images.unsplash.com/photo-1529634597503-139d3726fed5?auto=format&fit=crop&w=800&q=80',
  film1:
    'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?auto=format&fit=crop&w=500&q=80',
  film2:
    'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=500&q=80',
  film3:
    'https://images.unsplash.com/photo-1507504031003-b417219a0fde?auto=format&fit=crop&w=500&q=80',
  film4:
    'https://images.unsplash.com/photo-1544078751-58fee2d8a03b?auto=format&fit=crop&w=500&q=80',
  film5:
    'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=500&q=80',
};

export const INITIAL_SPREADS: ScrapbookSpreadData[] = [
  {
    id: 'spread-1',
    title: 'Spread 1',
    photos: { ...DEFAULT_PHOTOS },
  },
];

export const PHOTO_SLOT_LABELS: Record<PhotoSlotKey, string> = {
  browserMain: 'Ventana Retro Principal',
  ticketHorizontal: 'Ticket Vintage Inferior',
  musicPlayer: 'Reproductor Musical',
  polaroidBottom: 'Polaroid Horizontal',
  film1: 'Negativo 35mm #1',
  film2: 'Negativo 35mm #2',
  film3: 'Negativo 35mm #3',
  film4: 'Negativo 35mm #4',
  film5: 'Negativo 35mm #5',
};

// Dimensiones virtuales fijas del pliego doble para mantener proporciones exactas de collage
export const SPREAD_WIDTH = 920;
export const SPREAD_HEIGHT = 600;
