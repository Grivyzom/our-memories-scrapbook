import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { BLOCK_CATALOG, createBlock } from '../constants/blockCatalog';
import { createEmptyBook } from '../constants/defaultData';
import {
  Book,
  BookPage,
  PageBlock,
  PageSide,
  ScrapbookSpreadData,
  StickerKind,
} from '../types/scrapbook';
import { decryptGift, encryptGift, generateGiftCode, isGiftEnvelope } from './giftCrypto';

const STORAGE_KEY = '@our_memories_book_v2';
const RECEIVED_KEY = '@our_memories_received_book_v2';
const LEGACY_STORAGE_KEY = '@our_memories_scrapbook_v1';
const GIFT_CODE_KEY = '@our_memories_gift_code_v1';
const APP_STATE_KEY = '@our_memories_app_state_v1';
const PHOTOS_DIR = `${FileSystem.documentDirectory}scrapbook_photos/`;
const RECEIVED_DIR = `${FileSystem.documentDirectory}received_book/`;

// Las fotos se guardan reducidas: cargan antes, ocupan menos y se comparten rápido
const STORED_PHOTO_MAX_SIDE = 1600;
const SHARED_PHOTO_MAX_SIDE = 1280;
const PACKAGE_KIND = 'our-memories-book';

async function ensureDirectoryExists(dir: string): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

/* ============================ VALIDACIÓN ============================ */

const STICKERS: StickerKind[] = ['flowers', 'roses', 'cherub', 'hearts'];
const asString = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');

/** Sólo se aceptan fotos que se puedan mostrar en cualquier teléfono. */
const sanitizePhotoUri = (uri: unknown, allowLocal: boolean) => {
  if (typeof uri !== 'string') return '';
  if (uri.startsWith('data:image/') || /^https?:\/\//.test(uri)) return uri;
  if (allowLocal && uri.startsWith('file:')) return uri;
  return '';
};

const sanitizeBlock = (raw: any, allowLocal: boolean): PageBlock | null => {
  if (!raw || typeof raw !== 'object') return null;
  const def = BLOCK_CATALOG[raw.type as keyof typeof BLOCK_CATALOG];
  if (!def) return null;
  const photos = Array.from({ length: def.photoCount }, (_, i) =>
    sanitizePhotoUri(Array.isArray(raw.photos) ? raw.photos[i] : '', allowLocal)
  );
  const block: PageBlock = {
    id: asString(raw.id, 64) || createBlock(def.type).id,
    type: def.type,
    photos,
    text: asString(raw.text),
    subtitle: asString(raw.subtitle),
  };
  if (def.type === 'sticker') {
    block.sticker = STICKERS.includes(raw.sticker) ? raw.sticker : 'flowers';
  }
  return block;
};

const sanitizePage = (raw: any, allowLocal: boolean): BookPage => ({
  blocks: Array.isArray(raw?.blocks)
    ? raw.blocks
        .map((b: unknown) => sanitizeBlock(b, allowLocal))
        .filter((b: PageBlock | null): b is PageBlock => b !== null)
    : [],
});

const sanitizeBook = (raw: any, allowLocal: boolean): Book | null => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.spreads) || raw.spreads.length === 0) {
    return null;
  }
  const spreads: ScrapbookSpreadData[] = raw.spreads.slice(0, 200).map((sp: any, i: number) => ({
    id: asString(sp?.id, 64) || `spread-${i + 1}`,
    title: asString(sp?.title, 80) || `Pliego ${i + 1}`,
    left: sanitizePage(sp?.left, allowLocal),
    right: sanitizePage(sp?.right, allowLocal),
  }));
  return {
    version: 2,
    id: asString(raw.id, 64) || `book-${Date.now().toString(36)}`,
    title: asString(raw.title, 80) || 'Nuestros Recuerdos',
    dedicatedTo: asString(raw.dedicatedTo, 80) || undefined,
    spreads,
  };
};

/* ===================== MIGRACIÓN DEL FORMATO ANTERIOR ===================== */

/**
 * La versión 1 tenía el mismo collage fijo en todos los pliegos y sólo
 * guardaba sus fotos. Se convierte en componentes con la misma composición,
 * así nadie pierde las fotos que ya había elegido.
 */
const migrateLegacySpread = (sp: any, i: number): ScrapbookSpreadData => {
  const p = (sp?.photos ?? {}) as Record<string, string>;
  const withPhotos = (block: PageBlock, photos: (string | undefined)[]) => ({
    ...block,
    photos: block.photos.map((_, k) => sanitizePhotoUri(photos[k], true)),
  });
  const rightTitle = createBlock('title');
  rightTitle.text = 'Momentos inolvidables ✨';
  rightTitle.subtitle = `PLIEGO ${i + 1}`;
  return {
    id: asString(sp?.id, 64) || `spread-${i + 1}`,
    title: asString(sp?.title, 80) || `Pliego ${i + 1}`,
    left: {
      blocks: [
        withPhotos(createBlock('browser'), [p.browserMain]),
        withPhotos(createBlock('music'), [p.musicPlayer]),
        createBlock('note'),
        withPhotos(createBlock('ticket'), [p.ticketHorizontal]),
      ],
    },
    right: {
      blocks: [
        rightTitle,
        createBlock('song'),
        withPhotos(createBlock('polaroid'), [p.polaroidBottom]),
        createBlock('loveLabels'),
        withPhotos(createBlock('film'), [p.film1, p.film2, p.film3, p.film4]),
      ],
    },
  };
};

/* ==================== LIMPIEZA DEL COLLAGE DE MUESTRA ==================== */

/**
 * La versión 1 arrancaba con un collage de muestra (fotos de Unsplash y textos
 * de ejemplo) que se guardaba como si fuera del usuario, y la migración lo
 * conservaba: el libro "nuevo" nunca empezaba en blanco. Un pliego idéntico a
 * esa plantilla —mismos componentes y textos, sin ninguna foto elegida por el
 * usuario— se vacía. Basta con que haya tocado algo para que se respete.
 * El selector de fotos sólo produce URIs locales (`file:`), así que una URL de
 * Unsplash sólo puede venir de la muestra.
 */
const LEGACY_DEMO_PHOTO = /^https:\/\/images\.unsplash\.com\//;

const isUntouchedLegacyDemo = (sp: ScrapbookSpreadData, i: number) => {
  const template = migrateLegacySpread({}, i);
  return (['left', 'right'] as PageSide[]).every((side) => {
    const blocks = sp[side].blocks;
    const expected = template[side].blocks;
    return (
      blocks.length === expected.length &&
      blocks.every(
        (b, k) =>
          b.type === expected[k].type &&
          b.text === expected[k].text &&
          b.subtitle === expected[k].subtitle &&
          b.photos.every((p) => !p || LEGACY_DEMO_PHOTO.test(p))
      )
    );
  });
};

/** Devuelve el libro sin la muestra (o null si no había nada que limpiar). */
const clearLegacyDemo = (book: Book): Book | null => {
  if (!book.spreads.some(isUntouchedLegacyDemo)) return null;
  const spreads = book.spreads.map((sp, i) =>
    isUntouchedLegacyDemo(sp, i) ? { ...sp, left: { blocks: [] }, right: { blocks: [] } } : sp
  );
  const allEmpty = spreads.every((sp) => sp.left.blocks.length + sp.right.blocks.length === 0);
  // Si todo era muestra queda un único pliego en blanco, como un libro nuevo
  return { ...book, spreads: allEmpty ? spreads.slice(0, 1) : spreads };
};

/* ============================ LIBRO PROPIO ============================ */

export async function loadBook(): Promise<Book> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const book = sanitizeBook(JSON.parse(raw), true);
      if (book) {
        const cleaned = clearLegacyDemo(book);
        if (!cleaned) return book;
        await saveBook(cleaned);
        return cleaned;
      }
    }
    const legacy = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed.spreads) && parsed.spreads.length > 0) {
        const migrated: Book = {
          ...createEmptyBook(),
          spreads: parsed.spreads.map(migrateLegacySpread),
        };
        const book = clearLegacyDemo(migrated) ?? migrated;
        await saveBook(book);
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
        return book;
      }
    }
  } catch (error) {
    console.warn('Error cargando el libro:', error);
  }
  return createEmptyBook();
}

export async function saveBook(book: Book): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...book, updatedAt: Date.now() }));
  } catch (error) {
    console.warn('Error guardando el libro:', error);
  }
}

const getImageSize = (uri: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) =>
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject)
  );

const resizeActions = (width: number, height: number, maxSide: number) => {
  if (Math.max(width, height) <= maxSide) return [];
  return [{ resize: width >= height ? { width: maxSide } : { height: maxSide } }];
};

/**
 * Elige una foto de la galería y guarda una copia reducida dentro de la app.
 *
 * Se usa el selector de fotos del sistema (iOS 14+ y Android), que no necesita
 * permiso de galería: antes se pedía y en Android 13/14 salía un diálogo de
 * permisos extra (y si se negaba, ya no se podía elegir ninguna foto). Tampoco
 * se recorta: en iOS el recorte era siempre cuadrado y en Android abría otra
 * pantalla distinta; cada marco ya encuadra la foto a su forma.
 */
export async function pickAndPersistPhoto(blockId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizeActions(asset.width, asset.height, STORED_PHOTO_MAX_SIDE),
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );

  await ensureDirectoryExists(PHOTOS_DIR);
  const destinationUri = `${PHOTOS_DIR}${blockId}_${Date.now()}.jpg`;
  await FileSystem.moveAsync({ from: resized.uri, to: destinationUri });
  return destinationUri;
}

/** Borra el libro propio y sus fotos: se empieza con un libro en blanco. */
export async function resetBook(): Promise<Book> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
    }
    // El libro nuevo es otro regalo: tendrá su propio código
    await AsyncStorage.multiRemove([STORAGE_KEY, LEGACY_STORAGE_KEY, GIFT_CODE_KEY]);
  } catch (error) {
    console.warn('Error limpiando el libro:', error);
  }
  const book = createEmptyBook();
  await saveBook(book);
  return book;
}

/* ============================ ESTADO DE LA APP ============================ */

export interface AppState {
  /** Ya pasó por la pantalla de bienvenida. */
  onboarded: boolean;
  /** Libro que se veía al cerrar la app. */
  lastView: 'mine' | 'received';
}

export async function loadAppState(): Promise<AppState> {
  try {
    const raw = await AsyncStorage.getItem(APP_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      onboarded: parsed?.onboarded === true,
      lastView: parsed?.lastView === 'received' ? 'received' : 'mine',
    };
  } catch {
    return { onboarded: false, lastView: 'mine' };
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('Error guardando el estado:', error);
  }
}

/* ============================ CÓDIGO DEL REGALO ============================ */

/**
 * Código secreto del libro propio. Se genera una vez y se conserva: si el
 * libro cambia y se vuelve a enviar, quien lo recibe usa el mismo código.
 * Nunca viaja dentro del archivo.
 */
export async function getGiftCode(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(GIFT_CODE_KEY);
    if (saved) return saved;
  } catch {}
  const code = generateGiftCode();
  await AsyncStorage.setItem(GIFT_CODE_KEY, code);
  return code;
}

/* ============================ COMPARTIR ============================ */

/** Foto local -> data URI reducida (las remotas y las ya incrustadas se dejan igual). */
const embedPhoto = async (uri: string, cache: Map<string, string>) => {
  if (!uri || !uri.startsWith('file:')) return uri;
  const hit = cache.get(uri);
  if (hit) return hit;
  try {
    const { width, height } = await getImageSize(uri);
    const out = await ImageManipulator.manipulateAsync(
      uri,
      resizeActions(width, height, SHARED_PHOTO_MAX_SIDE),
      { compress: 0.72, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    FileSystem.deleteAsync(out.uri, { idempotent: true }).catch(() => {});
    const dataUri = `data:image/jpeg;base64,${out.base64}`;
    cache.set(uri, dataUri);
    return dataUri;
  } catch {
    return '';
  }
};

/**
 * Empaqueta el libro en un único archivo autocontenido (las fotos van
 * incrustadas) que se puede enviar por WhatsApp, correo, AirDrop...
 * Con `giftCode` el contenido va cifrado: sólo se abre con ese código.
 */
export async function exportBookPackage(book: Book, giftCode?: string): Promise<string> {
  const cache = new Map<string, string>();
  const spreads: ScrapbookSpreadData[] = [];
  for (const sp of book.spreads) {
    const embedPage = async (page: BookPage): Promise<BookPage> => {
      const blocks: PageBlock[] = [];
      for (const block of page.blocks) {
        const photos: string[] = [];
        for (const uri of block.photos) photos.push(await embedPhoto(uri, cache));
        blocks.push({ ...block, photos });
      }
      return { blocks };
    };
    spreads.push({ ...sp, left: await embedPage(sp.left), right: await embedPage(sp.right) });
  }

  const payload = {
    kind: PACKAGE_KIND,
    version: 2,
    exportedAt: new Date().toISOString(),
    book: { ...book, spreads },
  };
  const json = JSON.stringify(payload);
  // El nombre del archivo no delata a quién va dedicado: también lo verían otros
  const fileName = giftCode ? 'Un-regalo-para-ti' : 'Nuestros-Recuerdos';
  const fileUri = `${FileSystem.cacheDirectory}${fileName}.recuerdos.json`;
  // Cifrar bloquea el hilo de JS un momento: antes se deja pintar el aviso
  if (giftCode) await new Promise((resolve) => setTimeout(resolve, 60));
  const contents = giftCode ? JSON.stringify(encryptGift(json, giftCode)) : json;
  await FileSystem.writeAsStringAsync(fileUri, contents);
  return fileUri;
}

/** Fotos incrustadas -> archivos locales: Image no tiene que decodificar base64 enormes. */
const extractPhotos = async (book: Book): Promise<Book> => {
  await FileSystem.deleteAsync(RECEIVED_DIR, { idempotent: true });
  await ensureDirectoryExists(RECEIVED_DIR);
  let n = 0;
  const written = new Map<string, string>();
  const extract = async (uri: string) => {
    const match = /^data:image\/[a-z+]+;base64,(.+)$/i.exec(uri);
    if (!match) return uri;
    const hit = written.get(uri);
    if (hit) return hit;
    n += 1;
    const fileUri = `${RECEIVED_DIR}${n}.jpg`;
    await FileSystem.writeAsStringAsync(fileUri, match[1], {
      encoding: FileSystem.EncodingType.Base64,
    });
    written.set(uri, fileUri);
    return fileUri;
  };
  const spreads: ScrapbookSpreadData[] = [];
  for (const sp of book.spreads) {
    const page = async (p: BookPage): Promise<BookPage> => {
      const blocks: PageBlock[] = [];
      for (const block of p.blocks) {
        const photos: string[] = [];
        for (const uri of block.photos) photos.push(await extract(uri));
        blocks.push({ ...block, photos });
      }
      return { blocks };
    };
    spreads.push({ ...sp, left: await page(sp.left), right: await page(sp.right) });
  }
  return { ...book, spreads };
};

export interface ReceivedFile {
  parsed: any;
  /** El libro va cifrado: hace falta el código para abrirlo. */
  locked: boolean;
}

/** Lee un archivo recibido sin abrirlo todavía. */
export async function readReceivedFile(fileUri: string): Promise<ReceivedFile> {
  const raw = await FileSystem.readAsStringAsync(fileUri);
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_PACKAGE');
  }
  if (isGiftEnvelope(parsed)) return { parsed, locked: true };
  if (parsed?.kind !== PACKAGE_KIND) throw new Error('INVALID_PACKAGE');
  return { parsed, locked: false };
}

/**
 * Abre un archivo recibido (con su código si va cifrado), lo valida y lo
 * guarda para verlo. Errores: INVALID_PACKAGE, CODE_REQUIRED, WRONG_CODE.
 */
export async function importBookPackage(file: ReceivedFile, giftCode?: string): Promise<Book> {
  let parsed = file.parsed;
  if (file.locked) {
    if (!giftCode) throw new Error('CODE_REQUIRED');
    // Derivar la clave bloquea el hilo de JS un momento: antes se deja pintar la espera
    await new Promise((resolve) => setTimeout(resolve, 60));
    const opened = decryptGift(parsed, giftCode);
    if (opened === null) throw new Error('WRONG_CODE');
    try {
      parsed = JSON.parse(opened);
    } catch {
      throw new Error('INVALID_PACKAGE');
    }
  }
  if (parsed?.kind !== PACKAGE_KIND) throw new Error('INVALID_PACKAGE');
  // Un libro recibido nunca puede apuntar a archivos del teléfono de quien lo abre
  const book = sanitizeBook(parsed.book, false);
  if (!book) throw new Error('INVALID_PACKAGE');
  const local = await extractPhotos(book);
  await AsyncStorage.setItem(RECEIVED_KEY, JSON.stringify(local));
  return local;
}

export async function loadReceivedBook(): Promise<Book | null> {
  try {
    const raw = await AsyncStorage.getItem(RECEIVED_KEY);
    return raw ? sanitizeBook(JSON.parse(raw), true) : null;
  } catch {
    return null;
  }
}
