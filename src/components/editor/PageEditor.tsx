import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BLOCK_CATALOG,
  CATALOG_ORDER,
  STICKER_OPTIONS,
  createBlock,
  fitsInPage,
  pageFill,
} from '../../constants/blockCatalog';
import { BlockType, PageBlock, PageSide, ScrapbookSpreadData } from '../../types/scrapbook';

interface PageEditorProps {
  visible: boolean;
  spread: ScrapbookSpreadData;
  spreadIndex: number;
  initialSide: PageSide;
  onChange: (spread: ScrapbookSpreadData) => void;
  onPickPhoto: (side: PageSide, blockId: string, photoIndex: number) => void;
  onClose: () => void;
}

const SIDE_LABEL: Record<PageSide, string> = { left: 'Izquierda', right: 'Derecha' };
const otherSide = (side: PageSide): PageSide => (side === 'left' ? 'right' : 'left');

/**
 * Editor de un pliego: el usuario elige qué componentes van en cada página,
 * en qué orden, con qué textos y fotos. Sólo se ofrecen los que caben.
 */
export const PageEditor: React.FC<PageEditorProps> = ({
  visible,
  spread,
  spreadIndex,
  initialSide,
  onChange,
  onPickPhoto,
  onClose,
}) => {
  const [side, setSide] = useState<PageSide>(initialSide);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSide(initialSide);
      setExpandedId(null);
    }
  }, [visible, initialSide]);

  const blocks = spread[side].blocks;
  const fill = pageFill(blocks);
  const pageNumber = spreadIndex * 2 + (side === 'left' ? 1 : 2);

  const setBlocks = (target: PageSide, next: PageBlock[]) =>
    onChange({ ...spread, [target]: { blocks: next } });

  const updateBlock = (id: string, patch: Partial<PageBlock>) =>
    setBlocks(
      side,
      blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    // Reordenar puede juntar dos medios en una fila (o separarlos): sólo si sigue cabiendo
    if (fitsInPage(next)) setBlocks(side, next);
  };

  const remove = (id: string) => setBlocks(side, blocks.filter((b) => b.id !== id));

  const moveToOtherPage = (block: PageBlock) => {
    const other = otherSide(side);
    onChange({
      ...spread,
      [side]: { blocks: blocks.filter((b) => b.id !== block.id) },
      [other]: { blocks: [...spread[other].blocks, block] },
    });
    setExpandedId(null);
  };

  const add = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks(side, [...blocks, block]);
    setExpandedId(block.id);
  };

  const canSwap = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return false;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    return fitsInPage(next);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar editor" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrapper}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* ---------- Encabezado ---------- */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Diseña tu pliego {spreadIndex + 1}</Text>
              <Text style={styles.subtitle}>Elige los componentes y su orden</Text>
            </View>
            <Pressable onPress={onClose} style={styles.doneButton} hitSlop={6}>
              <Text style={styles.doneText}>Listo</Text>
            </Pressable>
          </View>

          {/* ---------- Página izquierda / derecha ---------- */}
          <View style={styles.segmented}>
            {(['left', 'right'] as PageSide[]).map((s) => {
              const active = s === side;
              return (
                <Pressable
                  key={s}
                  onPress={() => {
                    setSide(s);
                    setExpandedId(null);
                  }}
                  style={[styles.segment, active && styles.segmentActive]}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {SIDE_LABEL[s]} · pág. {spreadIndex * 2 + (s === 'left' ? 1 : 2)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* ---------- Espacio usado ---------- */}
          <View style={styles.capacityRow}>
            <Text style={styles.capacityLabel}>Espacio usado en la pág. {pageNumber}</Text>
            <Text style={styles.capacityValue}>{Math.round(Math.min(1, fill) * 100)}%</Text>
          </View>
          <View style={styles.capacityTrack}>
            <View
              style={[
                styles.capacityFill,
                { width: `${Math.min(100, fill * 100)}%` },
                fill > 0.9 && styles.capacityFillFull,
              ]}
            />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* ---------- Componentes de la página ---------- */}
            <Text style={styles.sectionTitle}>En esta página</Text>
            {blocks.length === 0 && (
              <Text style={styles.emptyHint}>
                La página está en blanco. Añade componentes desde el catálogo de abajo.
              </Text>
            )}
            {blocks.map((block, index) => {
              const def = BLOCK_CATALOG[block.type];
              const expanded = expandedId === block.id;
              const fitsOther = fitsInPage([...spread[otherSide(side)].blocks, block]);
              const preview =
                block.type === 'sticker'
                  ? STICKER_OPTIONS.find((o) => o.kind === block.sticker)?.label
                  : block.text.split('\n')[0];
              return (
                <View key={block.id} style={[styles.blockCard, expanded && styles.blockCardExpanded]}>
                  <Pressable
                    onPress={() => setExpandedId(expanded ? null : block.id)}
                    style={styles.blockRow}
                  >
                    <View style={styles.blockIcon}>
                      <Ionicons name={def.icon} size={18} color="#2B3654" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockLabel}>{def.label}</Text>
                      {!!preview && (
                        <Text style={styles.blockPreview} numberOfLines={1}>
                          {preview}
                        </Text>
                      )}
                    </View>
                    <IconButton
                      icon="chevron-up"
                      label="Subir"
                      disabled={!canSwap(index, -1)}
                      onPress={() => move(index, -1)}
                    />
                    <IconButton
                      icon="chevron-down"
                      label="Bajar"
                      disabled={!canSwap(index, 1)}
                      onPress={() => move(index, 1)}
                    />
                    <IconButton
                      icon="trash-outline"
                      label="Quitar"
                      destructive
                      onPress={() => remove(block.id)}
                    />
                  </Pressable>

                  {expanded && (
                    <View style={styles.blockEditor}>
                      {def.photoCount > 0 && (
                        <View style={styles.photoRow}>
                          {block.photos.map((uri, i) => (
                            <Pressable
                              key={i}
                              onPress={() => onPickPhoto(side, block.id, i)}
                              style={styles.photoThumb}
                              accessibilityLabel={`Elegir foto ${i + 1}`}
                            >
                              {uri ? (
                                <Image source={{ uri }} style={styles.photoThumbImage} />
                              ) : (
                                <Ionicons name="add" size={22} color="#7383AD" />
                              )}
                            </Pressable>
                          ))}
                          <Text style={styles.photoHint}>
                            Toca {def.photoCount > 1 ? 'un recuadro' : 'el recuadro'} para elegir la foto
                          </Text>
                        </View>
                      )}

                      {def.textLabel && (
                        <Field
                          label={def.textLabel}
                          value={block.text}
                          multiline={block.type === 'loveLabels' || block.type === 'note'}
                          onChangeText={(text) => updateBlock(block.id, { text })}
                        />
                      )}
                      {def.subtitleLabel && (
                        <Field
                          label={def.subtitleLabel}
                          value={block.subtitle}
                          multiline={block.type === 'song'}
                          onChangeText={(subtitle) => updateBlock(block.id, { subtitle })}
                        />
                      )}

                      {block.type === 'sticker' && (
                        <View style={styles.chipsRow}>
                          {STICKER_OPTIONS.map((opt) => {
                            const active = block.sticker === opt.kind;
                            return (
                              <Pressable
                                key={opt.kind}
                                onPress={() => updateBlock(block.id, { sticker: opt.kind })}
                                style={[styles.chip, active && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                  {opt.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}

                      <Pressable
                        disabled={!fitsOther}
                        onPress={() => moveToOtherPage(block)}
                        style={[styles.moveButton, !fitsOther && styles.disabled]}
                      >
                        <Ionicons
                          name={side === 'left' ? 'arrow-forward' : 'arrow-back'}
                          size={15}
                          color="#2B3654"
                        />
                        <Text style={styles.moveButtonText}>
                          {fitsOther
                            ? `Mover a la página ${SIDE_LABEL[otherSide(side)].toLowerCase()}`
                            : 'No cabe en la otra página'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}

            {/* ---------- Catálogo ---------- */}
            <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Añadir componente</Text>
            <View style={styles.catalogGrid}>
              {CATALOG_ORDER.map((type) => {
                const def = BLOCK_CATALOG[type];
                const fits = fitsInPage([...blocks, createBlock(type)]);
                return (
                  <Pressable
                    key={type}
                    disabled={!fits}
                    onPress={() => add(type)}
                    style={({ pressed }) => [
                      styles.catalogCard,
                      pressed && styles.pressed,
                      !fits && styles.disabled,
                    ]}
                    accessibilityLabel={`Añadir ${def.label}`}
                  >
                    <View style={styles.catalogIcon}>
                      <Ionicons name={def.icon} size={20} color="#8B1E24" />
                    </View>
                    <Text style={styles.catalogLabel}>{def.label}</Text>
                    <Text style={styles.catalogDescription} numberOfLines={2}>
                      {fits ? def.description : 'No cabe en esta página'}
                    </Text>
                    <Text style={styles.catalogSize}>
                      {def.size === 'full' ? 'Ancho completo' : 'Medio ancho'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const IconButton: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}> = ({ icon, label, onPress, disabled, destructive }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={4}
    accessibilityLabel={label}
    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
  >
    <Ionicons name={icon} size={18} color={destructive ? '#C0392B' : '#2B3654'} />
  </Pressable>
);

const Field: React.FC<{
  label: string;
  value: string;
  multiline?: boolean;
  onChangeText: (text: string) => void;
}> = ({ label, value, multiline, onChangeText }) => (
  <View style={styles.field}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      multiline={multiline}
      maxLength={multiline ? 160 : 60}
      style={[styles.input, multiline && styles.inputMultiline]}
      placeholderTextColor="#A0A6B8"
    />
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 28, 0.45)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: '#F7F5F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(43, 54, 84, 0.2)',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
    color: '#2B3654',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7390',
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: '#2B3654',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
  },
  doneText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(43, 54, 84, 0.08)',
    borderRadius: 14,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 11,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7390',
  },
  segmentTextActive: {
    color: '#2B3654',
    fontWeight: '700',
  },
  capacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  capacityLabel: {
    fontSize: 12,
    color: '#6B7390',
    fontWeight: '600',
  },
  capacityValue: {
    fontSize: 12,
    color: '#2B3654',
    fontWeight: '700',
  },
  capacityTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(43, 54, 84, 0.1)',
    overflow: 'hidden',
  },
  capacityFill: {
    height: '100%',
    backgroundColor: '#7383AD',
  },
  capacityFillFull: {
    backgroundColor: '#8B1E24',
  },
  scroll: {
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2B3654',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 13,
    color: '#6B7390',
    lineHeight: 18,
  },
  blockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.08)',
  },
  blockCardExpanded: {
    borderColor: 'rgba(115, 131, 173, 0.6)',
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 6,
  },
  blockIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(115, 131, 173, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  blockLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2B3654',
  },
  blockPreview: {
    fontSize: 12,
    color: '#6B7390',
    marginTop: 1,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
  },
  blockEditor: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  photoThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: 'rgba(115, 131, 173, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(115, 131, 173, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoThumbImage: {
    width: '100%',
    height: '100%',
  },
  photoHint: {
    flexBasis: '100%',
    fontSize: 12,
    color: '#6B7390',
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7390',
  },
  input: {
    backgroundColor: '#F7F5F0',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    fontSize: 15,
    color: '#2B3654',
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
  },
  chipActive: {
    backgroundColor: '#2B3654',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B3654',
  },
  chipTextActive: {
    color: '#FFF',
  },
  moveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
  },
  moveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2B3654',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogCard: {
    width: '48.8%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.08)',
  },
  catalogIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(139, 30, 36, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catalogLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2B3654',
  },
  catalogDescription: {
    fontSize: 12,
    color: '#6B7390',
    marginTop: 2,
    minHeight: 32,
  },
  catalogSize: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#7383AD',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
});
