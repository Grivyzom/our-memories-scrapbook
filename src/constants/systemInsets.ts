import { Platform, StatusBar } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

/**
 * Márgenes del sistema (barra de estado, notch / Dynamic Island, indicador de
 * inicio). Se leen una vez de la ventana en vez de usar un SafeAreaProvider:
 * dentro de un Modal en Android (nueva arquitectura) ese proveedor nunca
 * recibía las medidas y no pintaba nada. La orientación es fija (vertical),
 * así que no cambian mientras la app está abierta.
 *
 * En Android la barra de estado es translúcida y el contenido empieza bajo
 * ella: se toma su altura real si la ventana no la informa.
 */
export const getSystemInsets = () => {
  const insets = initialWindowMetrics?.insets;
  const statusBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0;
  return {
    top: Math.max(insets?.top ?? 0, statusBar),
    bottom: insets?.bottom ?? 0,
  };
};

export const SYSTEM_INSETS = getSystemInsets();
