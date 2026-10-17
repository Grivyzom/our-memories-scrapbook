import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sheetBottomPadding } from './insets';

const CLOSE_DELAY_MS = 320;

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** Línea secundaria bajo la etiqueta. */
  hint?: string;
  destructive?: boolean;
  disabled?: boolean;
}

/** Grupo de acciones relacionadas, con un título opcional encima. */
export interface ActionSheetSection {
  key: string;
  title?: string;
  items: ActionSheetItem[];
}

interface ActionSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  sections: ActionSheetSection[];
  onClose: () => void;
}

/**
 * Hoja de acciones inferior. Sustituye a Alert.alert para el menú: en Android
 * Alert muestra como máximo 3 botones y se perdían opciones. Las acciones van
 * agrupadas y la lista se desplaza: en un móvil pequeño ya no se sale de la
 * pantalla.
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({
  visible,
  title,
  subtitle,
  sections,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const visibleSections = sections.filter((s) => s.items.length > 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      // En Android el oscurecido también cubre la barra de estado, como en iOS
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar menú" />
      <View style={[styles.sheet, { maxHeight: height * 0.88, paddingBottom: sheetBottomPadding() }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {visibleSections.map((section) => (
            <View key={section.key}>
              {section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null}
              <View style={styles.list}>
                {section.items.map((item, index) => (
                  <Pressable
                    key={item.key}
                    disabled={item.disabled}
                    onPress={() => {
                      onClose();
                      // Tras cerrar la hoja: en iOS un Alert lanzado mientras el modal se cierra no se muestra
                      setTimeout(item.onPress, CLOSE_DELAY_MS);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !!item.disabled }}
                    style={({ pressed }) => [
                      styles.row,
                      index < section.items.length - 1 && styles.rowDivider,
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
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>
                        {item.label}
                      </Text>
                      {item.hint ? <Text style={styles.rowHint}>{item.hint}</Text> : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 26, 0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FBF8F2',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
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
  scroll: {
    flexGrow: 0,
    marginTop: 6,
  },
  scrollContent: {
    paddingBottom: 4,
  },
  sectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#8F877B',
    marginTop: 12,
    marginLeft: 6,
  },
  list: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 56,
    paddingVertical: 10,
  },
  rowDivider: {
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
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2B2623',
  },
  rowHint: {
    fontSize: 12.5,
    color: '#8F877B',
    marginTop: 1,
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
