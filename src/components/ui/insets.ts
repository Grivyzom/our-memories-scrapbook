import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * Márgenes del sistema (barra de estado, muesca, barra de gestos). Se leen una
 * vez de la ventana en vez de usar un SafeAreaProvider dentro de los Modal: en
 * Android (nueva arquitectura) ese proveedor nunca recibía las medidas y no
 * pintaba nada, así que sólo se veía la pantalla oscurecida del Modal.
 */
export const getInsets = () => {
  const insets = initialWindowMetrics?.insets;
  const statusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;
  return {
    top: Math.max(insets?.top ?? 0, statusBar),
    bottom: insets?.bottom ?? 0,
  };
};

/** Relleno inferior de una hoja: nunca queda pegada a la barra de gestos. */
export const sheetBottomPadding = () => Math.max(getInsets().bottom, 12) + 14;
