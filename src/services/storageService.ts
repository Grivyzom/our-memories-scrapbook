import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { INITIAL_SPREADS } from '../constants/defaultData';
import { PhotoSlotKey, ScrapbookSpreadData } from '../types/scrapbook';

const STORAGE_KEY = '@our_memories_scrapbook_v1';
const PHOTOS_DIR = `${FileSystem.documentDirectory}scrapbook_photos/`;

async function ensureDirectoryExists(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

export async function loadScrapbookState(): Promise<{
  spreads: ScrapbookSpreadData[];
  totalPages: number;
}> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { spreads: INITIAL_SPREADS, totalPages: INITIAL_SPREADS.length * 2 };
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.spreads) && parsed.spreads.length > 0) {
      return {
        spreads: parsed.spreads,
        totalPages: Math.max(parsed.totalPages ?? 0, parsed.spreads.length * 2),
      };
    }
    return { spreads: INITIAL_SPREADS, totalPages: INITIAL_SPREADS.length * 2 };
  } catch (error) {
    console.warn('Error cargando estado del scrapbook:', error);
    return { spreads: INITIAL_SPREADS, totalPages: INITIAL_SPREADS.length * 2 };
  }
}

export async function saveScrapbookState(
  spreads: ScrapbookSpreadData[],
  totalPages: number
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ spreads, totalPages, updatedAt: Date.now() })
    );
  } catch (error) {
    console.warn('Error guardando estado del scrapbook:', error);
  }
}

export async function pickAndPersistPhoto(
  spreadId: string,
  slotKey: PhotoSlotKey
): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('PERMISSION_DENIED');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.9,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const sourceUri = result.assets[0].uri;
  await ensureDirectoryExists();

  const fileExtension = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
  const fileName = `${spreadId}_${slotKey}_${Date.now()}.${fileExtension}`;
  const destinationUri = `${PHOTOS_DIR}${fileName}`;

  await FileSystem.copyAsync({
    from: sourceUri,
    to: destinationUri,
  });

  return destinationUri;
}

export async function clearAllSavedPhotos(): Promise<void> {
  try {
    const dirInfo = await FileSystem.getInfoAsync(PHOTOS_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(PHOTOS_DIR, { idempotent: true });
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Error limpiando fotos locales:', error);
  }
}
