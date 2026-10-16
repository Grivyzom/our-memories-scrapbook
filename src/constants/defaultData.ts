import { Book, ScrapbookSpreadData } from '../types/scrapbook';

/** Pliego en blanco: el usuario elige qué componentes poner en cada página. */
export const createEmptySpread = (number: number): ScrapbookSpreadData => ({
  id: `spread-${Date.now().toString(36)}-${number}`,
  title: `Pliego ${number}`,
  left: { blocks: [] },
  right: { blocks: [] },
});

/** Libro nuevo: un único pliego vacío listo para llenar. */
export const createEmptyBook = (): Book => ({
  version: 2,
  id: `book-${Date.now().toString(36)}`,
  title: 'Nuestros Recuerdos',
  spreads: [createEmptySpread(1)],
});

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
