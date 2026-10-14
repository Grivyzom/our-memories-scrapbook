export type PhotoSlotKey =
  | 'browserMain'
  | 'ticketHorizontal'
  | 'musicPlayer'
  | 'polaroidBottom'
  | 'film1'
  | 'film2'
  | 'film3'
  | 'film4'
  | 'film5';

export type SpreadPhotosMap = Record<PhotoSlotKey, string>;

export interface ScrapbookSpreadData {
  id: string;
  title: string;
  photos: SpreadPhotosMap;
}

export type CameraFocusZone = 'left' | 'center' | 'right' | 'full' | 'landscape90';
