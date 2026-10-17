import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BLOCK_CATALOG,
  CATALOG_ORDER,
  PAGE_WIDTH,
  QUICK_START,
  STICKER_OPTIONS,
  createBlock,
  fitsInPage,
  pageFill,
} from '../../constants/blockCatalog';
import { SPREAD_HEIGHT } from '../../constants/defaultData';
import { SYSTEM_INSETS } from '../../constants/systemInsets';
import { BlockType, PageBlock, PageSide, ScrapbookSpreadData } from '../../types/scrapbook';
import { BookPageView } from '../blocks/BookPageView';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface PageEditorProps {
  visible: boolean;
  spread: ScrapbookSpreadData;
  spreadIndex: number;
  /** Pliegos del libro: se puede pasar de uno a otro sin salir del editor. */
  spreadCount: number;
  initialSide: PageSide;
  onChange: (spread: ScrapbookSpreadData) => void;
  /**
   * Elige fotos para un componente: la primera va a `photoIndex` y, si
   * `count` > 1, las demás llenan los marcos vacíos siguientes.
   */
  onPickPhoto: (side: PageSide, blockId: string, photoIndex: number, count?: number) => void;
  onGoToSpread: (index: number) => void;
  /** Añade un pliego en blanco al final y pasa a él. */
  onAddSpread: () => void;
  onClose: () => void;
}

const SIDE_LABEL: Record<PageSide, string> = { left: 'izquierda', right: 'derecha' };
const otherSide = (side: PageSide): PageSide => (side === 'left' ? 'right' : 'left');
const pageNumberOf = (spreadIndex: number, side: PageSide) => spreadIndex * 2 + (side === 'left' ? 1 : 2);

// Tiempo que se agrupan las ediciones antes de subirlas al libro
const COMMIT_DELAY_MS = 250;
// Al añadir un componente con fotos se abre la galería cuando ya se cerró el catálogo
const PICK_AFTER_ADD_MS = 380;

/**
 * Editor de un pliego a pantalla completa. Antes era una hoja flotante con
 * altura en porcentaje dentro de un Modal transparente, y en Android se
 * quedaba como una franja estrecha a la izquierda en la que no se podía
 * tocar nada. Ahora ocupa toda la pantalla: arriba se ve la página tal como
 * quedará, en medio sus componentes y abajo un botón fijo para añadir más.
 */
export const PageEditor: React.FC<PageEditorProps> = (props) => {
  // "Atrás" en Android: primero cierra el catálogo y sólo después el editor
  const backRef = useRef<(() => void) | null>(null);
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => (backRef.current ? backRef.current() : props.onClose())}
    >
      <EditorScreen {...props} backRef={backRef} />
    </Modal>
  );
};

const EditorScreen: React.FC<
  PageEditorProps & { backRef: React.MutableRefObject<(() => void) | null> }
> = ({
  visible,
  spread,
  spreadIndex,
  spreadCount,
  initialSide,
  onChange,
  onPickPhoto,
  onGoToSpread,
  onAddSpread,
  onClose,
  backRef,
}) => {
  // Márgenes leídos de la ventana: un SafeAreaProvider dentro del Modal no
  // recibe medidas en Android (nueva arquitectura) y deja la pantalla en negro
  const insets = SYSTEM_INSETS;
  const { width, height } = useWindowDimensions();
  const [side, setSide] = useState<PageSide>(initialSide);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  /*
   * Borrador local: cada tecla sólo re-renderiza el editor, no toda la app con
   * el libro 3D debajo. Los cambios se suben agrupados y siempre antes de
   * cerrar o de elegir una foto.
   */
  const [draft, setDraft] = useState(spread);
  const draftRef = useRef(spread);
  const emittedRef = useRef(spread);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (draftRef.current !== emittedRef.current) {
      emittedRef.current = draftRef.current;
      onChangeRef.current(draftRef.current);
    }
  }, []);

  const commit = (next: ScrapbookSpreadData) => {
    draftRef.current = next;
    setDraft(next);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, COMMIT_DELAY_MS);
  };

  // Cambios que llegan de fuera (una foto ya guardada, otro pliego) reemplazan el
  // borrador antes de pintar: al cambiar de pliego no se ve el anterior ni un instante
  useLayoutEffect(() => {
    if (spread !== emittedRef.current) {
      emittedRef.current = spread;
      draftRef.current = spread;
      setDraft(spread);
    }
  }, [spread]);

  // Lo pendiente no se pierde aunque el editor se cierre desde fuera
  useEffect(() => flush, [flush]);

  const onPickPhotoRef = useRef(onPickPhoto);
  onPickPhotoRef.current = onPickPhoto;
  const pickPhoto = useCallback(
    (s: PageSide, blockId: string, photoIndex: number, count?: number) => {
      flush();
      onPickPhotoRef.current(s, blockId, photoIndex, count);
    },
    [flush]
  );
  const openCatalog = useCallback(() => setCatalogOpen(true), []);
  const close = () => {
    flush();
    onClose();
  };
  backRef.current = () => (catalogOpen ? setCatalogOpen(false) : close());

  useEffect(() => {
    if (visible) {
      setSide(initialSide);
      setExpandedId(null);
      setCatalogOpen(false);
    }
  }, [visible, initialSide]);

  const blocks = draft[side].blocks;
  const fill = pageFill(blocks);
  // Qué tipos caben aún: sólo se recalcula cuando cambian los componentes
  const fitsByType = useMemo(() => {
    const result = {} as Record<BlockType, boolean>;
    for (const type of CATALOG_ORDER) result[type] = fitsInPage([...blocks, createBlock(type)]);
    return result;
  }, [blocks]);
  const nothingFits = CATALOG_ORDER.every((type) => !fitsByType[type]);
  const topInset = insets.top;

  const setBlocks = (target: PageSide, next: PageBlock[]) =>
    commit({ ...draft, [target]: { blocks: next } });

  const updateBlock = (id: string, patch: Partial<PageBlock>) =>
    setBlocks(side, blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const swapped = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= blocks.length) return null;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    // Reordenar puede juntar dos medios en una fila (o separarlos): sólo si sigue cabiendo
    return fitsInPage(next) ? next : null;
  };

  const move = (index: number, delta: number) => {
    const next = swapped(index, delta);
    if (next) setBlocks(side, next);
  };

  const remove = (id: string) => {
    setBlocks(side, blocks.filter((b) => b.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const moveToOtherPage = (block: PageBlock) => {
    const other = otherSide(side);
    commit({
      ...draft,
      [side]: { blocks: blocks.filter((b) => b.id !== block.id) },
      [other]: { blocks: [...draft[other].blocks, block] },
    });
    setExpandedId(null);
  };

  const add = (type: BlockType) => {
    const block = createBlock(type);
    setBlocks(side, [...blocks, block]);
    setExpandedId(block.id);
    setCatalogOpen(false);
    // El nuevo queda al final de la lista: se lleva a la vista
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
    // Un componente de fotos se llena directamente: la galería se abre sola
    const photoCount = BLOCK_CATALOG[type].photoCount;
    if (photoCount > 0) {
      setTimeout(() => pickPhoto(side, block.id, 0, photoCount), PICK_AFTER_ADD_MS);
    }
  };

  // Un marco vacío de un componente con varios deja elegir de una vez los que faltan
  const pickForSlot = (block: PageBlock, index: number) => {
    const emptyFromHere = block.photos.slice(index).filter((uri) => !uri).length;
    pickPhoto(side, block.id, index, block.photos[index] ? 1 : emptyFromHere);
  };

  const changeSide = (s: PageSide) => {
    setSide(s);
    setExpandedId(null);
  };

  /* ---------- Pasar de pliego sin salir del editor ---------- */
  const isLastSpread = spreadIndex >= spreadCount - 1;
  const resetForNewSpread = () => {
    setSide('left');
    setExpandedId(null);
    setCatalogOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const goToSpread = (index: number) => {
    if (index < 0 || index >= spreadCount || index === spreadIndex) return;
    // Lo pendiente se guarda en su pliego antes de cambiar
    flush();
    resetForNewSpread();
    onGoToSpread(index);
  };
  const addSpread = () => {
    flush();
    resetForNewSpread();
    onAddSpread();
  };
  const goForward = () => (isLastSpread ? addSpread() : goToSpread(spreadIndex + 1));

  // Página llena: el botón inferior lleva a donde seguir
  const continueLabel =
    side === 'left'
      ? `Seguir en la pág. ${pageNumberOf(spreadIndex, 'right')}`
      : isLastSpread
        ? 'Añadir pliego y seguir'
        : 'Seguir en el pliego siguiente';
  const continueDesigning = () => (side === 'left' ? changeSide('right') : goForward());

  // Vista previa: la página real, escalada para ocupar como mucho ~28% del alto
  const previewHeight = Math.min(250, Math.max(150, height * 0.28));
  const previewScale = previewHeight / SPREAD_HEIGHT;
  const previewWidth = PAGE_WIDTH * previewScale;

  return (
    <View style={[styles.root, { width }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ---------- Barra superior ---------- */}
        <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
          <View style={styles.flex}>
            <Text style={styles.title}>
              Diseñar pliego {spreadIndex + 1}
              <Text style={styles.titleCount}> de {spreadCount}</Text>
            </Text>
            <Text style={styles.subtitle}>
              Págs. {pageNumberOf(spreadIndex, 'left')}–{pageNumberOf(spreadIndex, 'right')} · se guarda solo
            </Text>
          </View>
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
            accessibilityLabel="Terminar de diseñar"
            hitSlop={8}
          >
            <Ionicons name="checkmark" size={18} color="#FFF" />
            <Text style={styles.doneText}>Listo</Text>
          </Pressable>
        </View>

        {/* ---------- Pliego anterior · página izquierda / derecha · siguiente ---------- */}
        <View style={styles.tabs}>
          <Pressable
            onPress={() => goToSpread(spreadIndex - 1)}
            disabled={spreadIndex === 0}
            style={({ pressed }) => [
              styles.spreadArrow,
              spreadIndex === 0 && styles.disabled,
              pressed && styles.pressed,
            ]}
            accessibilityLabel="Pliego anterior"
            hitSlop={4}
          >
            <Ionicons name="chevron-back" size={20} color="#2B3654" />
          </Pressable>
          {(['left', 'right'] as PageSide[]).map((s) => {
            const active = s === side;
            const sideFill = Math.min(1, pageFill(draft[s].blocks));
            return (
              <Pressable
                key={s}
                onPress={() => changeSide(s)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.tabTitle, active && styles.tabTitleActive]}>
                  Pág. {pageNumberOf(spreadIndex, s)}
                </Text>
                <Text style={styles.tabSub}>{SIDE_LABEL[s]}</Text>
                <View style={styles.tabTrack}>
                  <View
                    style={[
                      styles.tabFill,
                      { width: `${sideFill * 100}%` },
                      sideFill > 0.9 && styles.capacityFull,
                    ]}
                  />
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={goForward}
            style={({ pressed }) => [
              styles.spreadArrow,
              isLastSpread && styles.spreadArrowAdd,
              pressed && styles.pressed,
            ]}
            accessibilityLabel={isLastSpread ? 'Añadir un pliego al final' : 'Pliego siguiente'}
            hitSlop={4}
          >
            <Ionicons
              name={isLastSpread ? 'add' : 'chevron-forward'}
              size={isLastSpread ? 22 : 20}
              color="#2B3654"
            />
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ---------- Vista previa en vivo ---------- */}
          <View style={styles.previewWrap}>
            <View
              style={[styles.previewPaper, { width: previewWidth, height: previewHeight }]}
            >
              <View
                style={{
                  position: 'absolute',
                  width: PAGE_WIDTH,
                  height: SPREAD_HEIGHT,
                  left: (previewWidth - PAGE_WIDTH) / 2,
                  top: (previewHeight - SPREAD_HEIGHT) / 2,
                  transform: [{ scale: previewScale }],
                }}
              >
                <BookPageView
                  page={draft[side]}
                  side={side}
                  pageNumber={pageNumberOf(spreadIndex, side)}
                  onPressPhoto={pickPhoto}
                  onPressEmpty={openCatalog}
                />
              </View>
            </View>
            <Text style={styles.previewHint}>
              {blocks.length === 0
                ? 'Página en blanco: elige con qué empezar'
                : `Así se verá · ${Math.round(Math.min(1, fill) * 100)}% del espacio usado`}
            </Text>
          </View>

          {/* ---------- Página vacía: empezar con un toque ---------- */}
          {blocks.length === 0 && (
            <>
              <Text style={styles.sectionTitle}>Empieza con…</Text>
              <View style={styles.quickRow}>
                {QUICK_START.map((type) => {
                  const def = BLOCK_CATALOG[type];
                  return (
                    <Pressable
                      key={type}
                      onPress={() => add(type)}
                      style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
                      accessibilityLabel={`Añadir ${def.label}`}
                    >
                      <View style={styles.catalogIcon}>
                        <Ionicons name={def.icon} size={22} color="#8B1E24" />
                      </View>
                      <Text style={styles.quickLabel} numberOfLines={1}>
                        {def.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={openCatalog}
                style={({ pressed }) => [styles.quickMore, pressed && styles.pressed]}
              >
                <Text style={styles.quickMoreText}>Ver los {CATALOG_ORDER.length} componentes</Text>
                <Ionicons name="chevron-forward" size={16} color="#2B3654" />
              </Pressable>
            </>
          )}

          {/* ---------- Componentes de la página ---------- */}
          {blocks.length > 0 && <Text style={styles.sectionTitle}>En esta página</Text>}
          {blocks.map((block, index) => {
            const def = BLOCK_CATALOG[block.type];
            const expanded = expandedId === block.id;
            const fitsOther = expanded && fitsInPage([...draft[otherSide(side)].blocks, block]);
            const preview =
              block.type === 'sticker'
                ? STICKER_OPTIONS.find((o) => o.kind === block.sticker)?.label
                : block.text.split('\n')[0];
            return (
              <View key={block.id} style={[styles.card, expanded && styles.cardExpanded]}>
                <Pressable
                  onPress={() => setExpandedId(expanded ? null : block.id)}
                  style={({ pressed }) => [styles.cardRow, pressed && styles.rowPressed]}
                  accessibilityLabel={`${def.label}: ${expanded ? 'cerrar' : 'editar'}`}
                >
                  <View style={styles.cardIcon}>
                    <Ionicons name={def.icon} size={20} color="#2B3654" />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.cardLabel}>{def.label}</Text>
                    <Text style={styles.cardPreview} numberOfLines={1}>
                      {preview || (def.photoCount > 0 ? 'Toca para poner fotos' : 'Toca para editar')}
                    </Text>
                  </View>
                  <Ionicons name={expanded ? 'chevron-up' : 'create-outline'} size={20} color="#7383AD" />
                </Pressable>

                {expanded && (
                  <View style={styles.cardEditor}>
                    {def.photoCount > 0 && (
                      <View>
                        <Text style={styles.fieldLabel}>
                          {def.photoCount > 1 ? 'Fotos' : 'Foto'}
                        </Text>
                        <View style={styles.photoRow}>
                          {block.photos.map((uri, i) => (
                            <Pressable
                              key={i}
                              onPress={() => pickForSlot(block, i)}
                              style={({ pressed }) => [styles.photoThumb, pressed && styles.pressed]}
                              accessibilityLabel={`Elegir foto ${i + 1}`}
                            >
                              {uri ? (
                                <Image source={{ uri }} style={styles.photoThumbImage} />
                              ) : (
                                <>
                                  <Ionicons name="image-outline" size={22} color="#7383AD" />
                                  <Text style={styles.photoThumbText}>Elegir</Text>
                                </>
                              )}
                            </Pressable>
                          ))}
                        </View>
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

                    {/* Acciones grandes, fáciles de tocar con el pulgar */}
                    <View style={styles.actionsRow}>
                      <ActionButton
                        icon="arrow-up"
                        label="Subir"
                        disabled={!swapped(index, -1)}
                        onPress={() => move(index, -1)}
                      />
                      <ActionButton
                        icon="arrow-down"
                        label="Bajar"
                        disabled={!swapped(index, 1)}
                        onPress={() => move(index, 1)}
                      />
                      <ActionButton
                        icon={side === 'left' ? 'arrow-forward' : 'arrow-back'}
                        label={`A pág. ${pageNumberOf(spreadIndex, otherSide(side))}`}
                        disabled={!fitsOther}
                        onPress={() => moveToOtherPage(block)}
                      />
                      <ActionButton
                        icon="trash-outline"
                        label="Quitar"
                        destructive
                        onPress={() => remove(block.id)}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* ---------- Botón fijo: añadir componente ---------- */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {nothingFits ? (
            // Página llena: en vez de un botón apagado, el siguiente paso
            <Pressable
              onPress={continueDesigning}
              style={({ pressed }) => [styles.addButton, styles.continueButton, pressed && styles.pressed]}
              accessibilityLabel={`Página llena. ${continueLabel}`}
            >
              <View style={styles.flex}>
                <Text style={styles.continueKicker}>PÁGINA LLENA</Text>
                <Text style={styles.addButtonText}>{continueLabel}</Text>
              </View>
              <Ionicons name={side === 'right' && isLastSpread ? 'add' : 'arrow-forward'} size={22} color="#FFF" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setCatalogOpen(true)}
              style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
              accessibilityLabel="Añadir componente"
            >
              <Ionicons name="add" size={22} color="#FFF" />
              <Text style={styles.addButtonText}>Añadir componente</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ---------- Catálogo (dentro de la misma pantalla: sin Modal anidado) ---------- */}
      {catalogOpen && (
        <View style={StyleSheet.absoluteFill}>
          <Pressable
            style={styles.backdrop}
            onPress={() => setCatalogOpen(false)}
            accessibilityLabel="Cerrar catálogo"
          />
          <View
            style={[
              styles.catalogSheet,
              { maxHeight: height * 0.78, paddingBottom: Math.max(insets.bottom, 14) },
            ]}
          >
            <View style={styles.handle} />
            <View style={styles.catalogHeader}>
              <Text style={styles.catalogTitle}>Añadir a la pág. {pageNumberOf(spreadIndex, side)}</Text>
              <Pressable
                onPress={() => setCatalogOpen(false)}
                style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                accessibilityLabel="Cerrar"
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color="#2B3654" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.catalogGrid}>
              {CATALOG_ORDER.map((type) => {
                const def = BLOCK_CATALOG[type];
                const fits = fitsByType[type];
                return (
                  <Pressable
                    key={type}
                    disabled={!fits}
                    onPress={() => add(type)}
                    style={({ pressed }) => [
                      styles.catalogCard,
                      { width: (width - 32 - 10) / 2 },
                      pressed && styles.pressed,
                      !fits && styles.disabled,
                    ]}
                    accessibilityLabel={`Añadir ${def.label}`}
                  >
                    <View style={styles.catalogIcon}>
                      <Ionicons name={def.icon} size={22} color="#8B1E24" />
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
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
};

const ActionButton: React.FC<{
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}> = ({ icon, label, onPress, disabled, destructive }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={label}
    style={({ pressed }) => [
      styles.actionButton,
      destructive && styles.actionButtonDestructive,
      pressed && styles.pressed,
      disabled && styles.disabled,
    ]}
  >
    <Ionicons name={icon} size={18} color={destructive ? '#C0392B' : '#2B3654'} />
    <Text
      style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}
      numberOfLines={1}
    >
      {label}
    </Text>
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

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F5F0',
  },
  flex: {
    flex: 1,
  },

  /* --- Barra superior --- */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: '#2B3654',
  },
  titleCount: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7390',
  },
  subtitle: {
    fontSize: 12.5,
    color: '#6B7390',
    marginTop: 2,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2B3654',
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 22,
  },
  doneText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },

  /* --- Pestañas de página --- */
  tabs: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  spreadArrow: {
    width: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spreadArrowAdd: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(43, 54, 84, 0.35)',
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#2B3654',
  },
  tabTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#6B7390',
  },
  tabTitleActive: {
    color: '#2B3654',
  },
  tabSub: {
    fontSize: 12,
    color: '#8A90A6',
  },
  tabTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(43, 54, 84, 0.1)',
    overflow: 'hidden',
    marginTop: 6,
  },
  tabFill: {
    height: '100%',
    backgroundColor: '#7383AD',
  },
  capacityFull: {
    backgroundColor: '#8B1E24',
  },

  /* --- Contenido --- */
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  previewWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  previewPaper: {
    backgroundColor: '#FDFBF2',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138, 119, 96, 0.25)',
    shadowColor: '#2B2014',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  previewHint: {
    fontSize: 12.5,
    color: '#6B7390',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2B3654',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 8,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.08)',
  },
  quickLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2B3654',
  },
  quickMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 12,
    paddingVertical: 10,
  },
  quickMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B3654',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.08)',
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: 'rgba(43, 54, 84, 0.45)',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 60,
  },
  rowPressed: {
    backgroundColor: '#F3F1EC',
  },
  cardIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(115, 131, 173, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#2B3654',
  },
  cardPreview: {
    fontSize: 13,
    color: '#6B7390',
    marginTop: 1,
  },
  cardEditor: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 12,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  photoThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
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
  photoThumbText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7383AD',
    marginTop: 2,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6B7390',
  },
  input: {
    backgroundColor: '#F7F5F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.14)',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    color: '#2B3654',
  },
  inputMultiline: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
  },
  chipActive: {
    backgroundColor: '#2B3654',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B3654',
  },
  chipTextActive: {
    color: '#FFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: 'rgba(43, 54, 84, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  actionButtonDestructive: {
    backgroundColor: '#FBECEA',
  },
  actionLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2B3654',
  },
  actionLabelDestructive: {
    color: '#C0392B',
  },

  /* --- Barra inferior --- */
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#F7F5F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(43, 54, 84, 0.15)',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#8B1E24',
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  continueButton: {
    backgroundColor: '#2B3654',
    paddingHorizontal: 18,
  },
  continueKicker: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  /* --- Catálogo --- */
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 14, 28, 0.45)',
  },
  catalogSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F5F0',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(43, 54, 84, 0.2)',
    marginBottom: 8,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  catalogTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2B3654',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(43, 54, 84, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  catalogCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(43, 54, 84, 0.08)',
  },
  catalogIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 30, 36, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catalogLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2B3654',
  },
  catalogDescription: {
    fontSize: 12.5,
    color: '#6B7390',
    marginTop: 2,
    minHeight: 34,
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
