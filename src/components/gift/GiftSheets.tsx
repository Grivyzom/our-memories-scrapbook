import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { extractGiftCode, isCompleteGiftCode } from '../../services/giftCrypto';
import { GiftStatus } from '../../services/storageService';
import { BookSummary } from '../../constants/blockCatalog';
import { sheetBottomPadding } from '../ui/insets';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const COPIED_FEEDBACK_MS = 1800;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "hoy, 14:05", "ayer, 09:30" o "3 oct". */
const formatWhen = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (timestamp >= startOfToday) return `hoy, ${time}`;
  if (timestamp >= startOfToday - 86400000) return `ayer, ${time}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ============================ ENVOLVER EL REGALO ============================ */

interface GiftWrapSheetProps {
  visible: boolean;
  code: string | null;
  dedicatedTo?: string;
  summary: BookSummary;
  status: GiftStatus;
  /** El libro cambió después del último envío: hay que volver a enviarlo. */
  changedSinceSent: boolean;
  /** Prepara y envía el archivo cifrado. */
  onSendFile: () => Promise<void> | void;
  /** Se copió o se compartió el código. */
  onCodeShared: () => void;
  /** Ir a completar el libro (primera página sin terminar). */
  onDesign: () => void;
  /** Compartir sólo una imagen del pliego visible (con el libro abierto). */
  onSharePicture?: () => void;
  onClose: () => void;
}

/**
 * El regalo se entrega en dos partes que viajan por separado: el archivo
 * (cifrado, por cualquier app) y el código (mejor en persona). Quien sólo
 * tenga el archivo no puede ver nada. Antes de envolverlo se avisa de lo que
 * falta, y cada paso queda marcado al hacerlo.
 */
export const GiftWrapSheet: React.FC<GiftWrapSheetProps> = ({
  visible,
  code,
  dedicatedTo,
  summary,
  status,
  changedSinceSent,
  onSendFile,
  onCodeShared,
  onDesign,
  onSharePicture,
  onClose,
}) => {
  const { height } = useWindowDimensions();
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  }, []);

  const who = dedicatedTo || 'tu pareja';
  const isEmpty = summary.filledPages === 0;
  const blankPages = summary.pages - summary.filledPages;
  const hasIssues = blankPages > 0 || summary.emptyPhotoSlots > 0;
  const fileSent = !!status.sentAt && !changedSinceSent;
  const codeShared = !!status.codeSharedAt;
  const allDone = fileSent && codeShared;

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSendFile();
    } finally {
      setSending(false);
    }
  };

  const handleShareCode = async () => {
    if (!code) return;
    try {
      const result = await Share.share({
        message: `Tu código secreto para abrir el libro de recuerdos: ${code} ❤️\nÁbrelo en Our Memories › Abrir un regalo.`,
      });
      if (result.action === Share.sharedAction) onCodeShared();
    } catch {}
  };

  const handleCopyCode = async () => {
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      onCodeShared();
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch {}
  };

  const sendTitle = changedSinceSent
    ? 'Enviar la versión nueva'
    : fileSent
      ? 'Libro enviado'
      : 'Enviar el libro';
  const sendText = changedSinceSent
    ? 'Cambiaste el libro después de enviarlo'
    : fileSent
      ? `Último envío: ${formatWhen(status.sentAt!)} · tocar para reenviar`
      : 'Por WhatsApp, correo, AirDrop…';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { maxHeight: height * 0.92, paddingBottom: sheetBottomPadding() }]}>
        <View style={styles.handle} />
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={[styles.giftIcon, isEmpty && styles.giftIconMuted]}>
            <Ionicons name={isEmpty ? 'book-outline' : 'gift'} size={26} color="#FFFFFF" />
          </View>

          {isEmpty ? (
            /* ---------- Libro vacío: primero hay que llenarlo ---------- */
            <>
              <Text style={styles.title}>Tu libro aún está vacío</Text>
              <Text style={styles.subtitle}>
                Añade fotos y notas a sus páginas antes de envolverlo: así {who} tendrá algo que abrir.
              </Text>
              <Pressable
                onPress={onDesign}
                style={({ pressed }) => [styles.primary, pressed && styles.rowPressed]}
              >
                <Ionicons name="color-palette-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Empezar a diseñar</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>{allDone ? '¡Regalo enviado!' : 'Envolver el regalo'}</Text>
              <Text style={styles.subtitle}>
                {`Para ${who} · ${plural(summary.pages, 'página', 'páginas')} · ${plural(summary.photos, 'foto', 'fotos')}`}
              </Text>

              {/* ---------- Revisión: qué falta antes de enviarlo ---------- */}
              {hasIssues ? (
                <View style={styles.review}>
                  <Ionicons name="alert-circle-outline" size={20} color="#9A6512" />
                  <View style={styles.flex}>
                    <Text style={styles.reviewTitle}>Le falta un poco</Text>
                    <Text style={styles.reviewText}>
                      {[
                        blankPages > 0 && plural(blankPages, 'página en blanco', 'páginas en blanco'),
                        summary.emptyPhotoSlots > 0 &&
                          plural(summary.emptyPhotoSlots, 'marco sin foto', 'marcos sin foto'),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Pressable
                    onPress={onDesign}
                    style={({ pressed }) => [styles.reviewButton, pressed && styles.rowPressed]}
                    hitSlop={6}
                  >
                    <Text style={styles.reviewButtonText}>Completar</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={[styles.review, styles.reviewOk]}>
                  <Ionicons name="checkmark-circle" size={20} color="#2F7D4F" />
                  <Text style={[styles.reviewText, styles.flex]}>
                    Todas las páginas tienen contenido y fotos.
                  </Text>
                </View>
              )}

              {/* ---------- Código secreto ---------- */}
              <View style={styles.codeCard}>
                <Text style={styles.codeLabel}>CÓDIGO SECRETO</Text>
                {code ? (
                  <Text style={styles.codeText} selectable>
                    {code}
                  </Text>
                ) : (
                  <ActivityIndicator color="#8B1E24" style={{ marginVertical: 10 }} />
                )}
                <Pressable
                  onPress={handleCopyCode}
                  disabled={!code}
                  style={({ pressed }) => [
                    styles.copyButton,
                    copied && styles.copyButtonDone,
                    pressed && styles.rowPressed,
                  ]}
                  accessibilityLabel="Copiar el código"
                >
                  <Ionicons
                    name={copied ? 'checkmark' : 'copy-outline'}
                    size={15}
                    color={copied ? '#2F7D4F' : '#2B3654'}
                  />
                  <Text style={[styles.copyText, copied && styles.copyTextDone]}>
                    {copied ? 'Copiado' : 'Copiar código'}
                  </Text>
                </Pressable>
                <Text style={styles.codeHint}>
                  Sin este código nadie puede abrir el libro, aunque le llegue el archivo.
                </Text>
              </View>

              {/* ---------- Los dos pasos ---------- */}
              <StepButton
                n={1}
                icon={changedSinceSent ? 'refresh' : 'paper-plane-outline'}
                title={sendTitle}
                text={sendText}
                busy={sending}
                done={fileSent}
                warning={changedSinceSent}
                active={!fileSent}
                onPress={handleSend}
              />
              <StepButton
                n={2}
                icon="key-outline"
                title={`Darle el código a ${who}`}
                text={codeShared ? 'Ya lo compartiste · el código no cambia' : 'Mejor en persona o por otro chat'}
                done={codeShared}
                active={fileSent && !codeShared}
                onPress={handleShareCode}
                disabled={!code}
              />

              <Text style={styles.footnote}>
                Si cambias el libro, vuelve a enviarlo: el código sigue siendo el mismo.
              </Text>

              {onSharePicture && (
                <Pressable
                  onPress={onSharePicture}
                  style={({ pressed }) => [styles.linkRow, pressed && styles.rowPressed]}
                >
                  <Ionicons name="image-outline" size={17} color="#2B3654" />
                  <Text style={styles.linkText}>Compartir sólo una imagen de este pliego</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.cancel, allDone && styles.cancelDone, pressed && styles.rowPressed]}
        >
          <Text style={[styles.cancelText, allDone && styles.cancelTextDone]}>
            {isEmpty ? 'Ahora no' : 'Listo'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
};

const StepButton: React.FC<{
  n: number;
  icon: IconName;
  title: string;
  text: string;
  busy?: boolean;
  disabled?: boolean;
  /** Paso hecho: se marca con un ✓. */
  done?: boolean;
  /** Paso que toca hacer ahora: se resalta. */
  active?: boolean;
  /** Hay que repetirlo (p. ej. el libro cambió). */
  warning?: boolean;
  onPress: () => void;
}> = ({ n, icon, title, text, busy, disabled, done, active, warning, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    accessibilityRole="button"
    accessibilityLabel={`Paso ${n}: ${title}`}
    style={({ pressed }) => [
      styles.step,
      active && styles.stepActive,
      warning && styles.stepWarning,
      pressed && styles.rowPressed,
      disabled && styles.disabled,
    ]}
  >
    <View style={[styles.stepNumber, done && styles.stepNumberDone, active && styles.stepNumberActive]}>
      {done ? (
        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
      ) : (
        <Text style={[styles.stepNumberText, active && styles.stepNumberTextActive]}>{n}</Text>
      )}
    </View>
    <View style={styles.flex}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={[styles.stepText, warning && styles.stepTextWarning]}>
        {busy ? 'Envolviendo el regalo…' : text}
      </Text>
    </View>
    {busy ? (
      <ActivityIndicator color="#2B3654" />
    ) : (
      <Ionicons name={icon} size={20} color={warning ? '#9A6512' : '#2B3654'} />
    )}
  </Pressable>
);

/* ============================ ABRIR CON EL CÓDIGO ============================ */

interface GiftCodeSheetProps {
  visible: boolean;
  /** Abre el regalo con el código; devuelve un mensaje de error si falla. */
  onSubmit: (code: string) => Promise<string | null>;
  onClose: () => void;
}

export const GiftCodeSheet: React.FC<GiftCodeSheetProps> = ({ visible, onSubmit, onClose }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCode('');
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  const complete = isCompleteGiftCode(code);
  const submit = async (value = code) => {
    if (!isCompleteGiftCode(value) || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(value);
    setBusy(false);
    if (message) setError(message);
  };

  // El código suele llegar por chat: se pega el mensaje tal cual y se abre solo
  const handlePaste = async () => {
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        setError('No hay nada copiado. Copia el código del mensaje que te enviaron.');
        return;
      }
      const pasted = extractGiftCode(text);
      setError(null);
      setCode(pasted);
      if (isCompleteGiftCode(pasted)) submit(pasted);
    } catch {}
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        // En Android la ventana del Modal ya se encoge con el teclado; con 'height'
        // se descontaba dos veces y la hoja daba un salto al aparecer el teclado
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={[styles.sheet, { paddingBottom: sheetBottomPadding() }]}>
          <View style={styles.handle} />
          <View style={styles.giftIcon}>
            <Ionicons name="key" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Este regalo está cerrado con llave</Text>
          <Text style={styles.subtitle}>Escribe o pega el código secreto que te dieron</Text>

          <TextInput
            value={code}
            onChangeText={(text) => {
              setError(null);
              setCode(extractGiftCode(text));
            }}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor="#B9B0A3"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            autoFocus
            style={[styles.codeInput, error && styles.codeInputError]}
            returnKeyType="done"
            onSubmitEditing={() => submit()}
            editable={!busy}
            accessibilityLabel="Código secreto"
          />
          <Pressable
            onPress={handlePaste}
            disabled={busy}
            style={({ pressed }) => [styles.pasteButton, pressed && styles.rowPressed]}
            accessibilityLabel="Pegar el código"
          >
            <Ionicons name="clipboard-outline" size={16} color="#2B3654" />
            <Text style={styles.copyText}>Pegar</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => submit()}
            disabled={!complete || busy}
            style={({ pressed }) => [
              styles.primary,
              (!complete || busy) && styles.disabled,
              pressed && styles.rowPressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="lock-open-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Abrir el regalo</Text>
              </>
            )}
          </Pressable>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  scroll: {
    flexGrow: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D6CFC2',
    marginBottom: 12,
  },
  giftIcon: {
    alignSelf: 'center',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#8B1E24',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  giftIconMuted: {
    backgroundColor: '#7383AD',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2623',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#7A7167',
    textAlign: 'center',
    marginTop: 3,
    marginHorizontal: 8,
  },
  review: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFF4E0',
    borderWidth: 1,
    borderColor: '#F0D9A8',
  },
  reviewOk: {
    backgroundColor: '#EAF5EE',
    borderColor: '#C7E4D2',
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5C3D08',
  },
  reviewText: {
    fontSize: 12.5,
    color: '#6F5A33',
    marginTop: 1,
  },
  reviewButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E6C98C',
  },
  reviewButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C3D08',
  },
  codeCard: {
    marginTop: 12,
    marginBottom: 4,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9B46A',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#8B1E24',
  },
  codeText: {
    fontFamily: MONO,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#2B2623',
    marginVertical: 6,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEF0F6',
    marginBottom: 8,
  },
  copyButtonDone: {
    backgroundColor: '#EAF5EE',
  },
  copyText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2B3654',
  },
  copyTextDone: {
    color: '#2F7D4F',
  },
  codeHint: {
    fontSize: 12.5,
    color: '#7A7167',
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
  },
  stepActive: {
    borderColor: '#8B1E24',
  },
  stepWarning: {
    borderColor: '#E6C98C',
    backgroundColor: '#FFFBF2',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberActive: {
    backgroundColor: '#8B1E24',
  },
  stepNumberDone: {
    backgroundColor: '#2F7D4F',
  },
  stepNumberText: {
    color: '#2B3654',
    fontWeight: '700',
  },
  stepNumberTextActive: {
    color: '#FFFFFF',
  },
  stepTitle: {
    fontSize: 15.5,
    fontWeight: '600',
    color: '#2B2623',
  },
  stepText: {
    fontSize: 12.5,
    color: '#7A7167',
    marginTop: 1,
  },
  stepTextWarning: {
    color: '#9A6512',
    fontWeight: '600',
  },
  footnote: {
    fontSize: 12,
    color: '#8F877B',
    textAlign: 'center',
    marginTop: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 14,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B3654',
    textDecorationLine: 'underline',
  },
  codeInput: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E3DCCF',
    paddingVertical: 14,
    textAlign: 'center',
    fontFamily: MONO,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#2B2623',
  },
  codeInputError: {
    borderColor: '#C0392B',
  },
  pasteButton: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EEF0F6',
  },
  error: {
    color: '#C0392B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  primary: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#8B1E24',
    borderRadius: 16,
    paddingVertical: 15,
    minHeight: 52,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
  rowPressed: {
    opacity: 0.8,
  },
  cancel: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelDone: {
    backgroundColor: '#2B3654',
  },
  cancelText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#2B3654',
  },
  cancelTextDone: {
    color: '#FFFFFF',
  },
});
