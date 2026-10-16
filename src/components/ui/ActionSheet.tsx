import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Overlay } from './Overlay';

const CLOSE_DELAY_MS = 320;

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  items: ActionSheetItem[];
  onClose: () => void;
}

/**
 * Hoja de acciones inferior. Sustituye a Alert.alert para el menú: en Android
 * Alert muestra como máximo 3 botones y se perdían opciones.
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  title,
  subtitle,
  items,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  return (
    <Overlay visible={visible} onClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* Con muchas opciones la lista se desplaza en vez de salirse de la pantalla */}
        <ScrollView style={[styles.list, { maxHeight: height * 0.6 }]} bounces={false}>
          {items.map((item) => (
            <Pressable
              key={item.key}
              disabled={item.disabled}
              onPress={() => {
                onClose();
                // Tras cerrar la hoja: en iOS un Alert lanzado mientras el modal se cierra no se muestra
                setTimeout(item.onPress, CLOSE_DELAY_MS);
              }}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                item.disabled && styles.rowDisabled,
              ]}
            >
              <View style={[styles.iconWrap, item.destructive && styles.iconWrapDestructive]}>
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={item.destructive ? '#C0392B' : '#2B3654'}
                />
              </View>
              <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 30,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6CFC2',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2623',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#7A7167',
    textAlign: 'center',
    marginTop: 3,
  },
  list: {
    marginTop: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECE6DB',
  },
  rowPressed: {
    backgroundColor: '#F3EEE5',
  },
  rowDisabled: {
    opacity: 0.4,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapDestructive: {
    backgroundColor: '#FBECEA',
  },
  rowLabel: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2B2623',
  },
  rowLabelDestructive: {
    color: '#C0392B',
  },
  cancel: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#2B3654',
  },
});
