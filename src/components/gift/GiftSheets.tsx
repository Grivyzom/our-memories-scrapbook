import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SYSTEM_INSETS } from '../../constants/systemInsets';
import { formatGiftCode, isCompleteGiftCode } from '../../services/giftCrypto';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/* ============================ ENVOLVER EL REGALO ============================ */

interface GiftWrapSheetProps {
  visible: boolean;
  code: string | null;
  dedicatedTo?: string;
  pages: number;
  /** Prepara y envía el archivo cifrado. */
  onSendFile: () => Promise<void> | void;
  onClose: () => void;
}

/**
 * El regalo se entrega en dos partes que viajan por separado: el archivo
 * (cifrado, por cualquier app) y el código (mejor en persona). Quien sólo
 * tenga el archivo no puede ver nada.
 */
export const GiftWrapSheet: React.FC<GiftWrapSheetProps> = ({
  visible,
  code,
  dedicatedTo,
  pages,
  onSendFile,
  onClose,
}) => {
  const [sending, setSending] = useState(false);
  const who = dedicatedTo || 'tu pareja';

  const handleSend = async () => {
    if (sending) return;
    setSending(true);
    try {
      await onSendFile();
    } finally {
      setSending(false);
    }
  };

  const handleShareCode = () => {
    if (!code) return;
    Share.share({
      message: `Tu código secreto para abrir el libro de recuerdos: ${code} ❤️\nÁbrelo en Our Memories › Abrir un regalo.`,
    }).catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <View style={styles.giftIcon}>
          <Ionicons name="gift" size={26} color="#FFFFFF" />
        </View>
        <Text style={styles.title}>Envolver el regalo</Text>
        <Text style={styles.subtitle}>
          {`Libro para ${who} · ${pages} páginas`}
        </Text>

        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>CÓDIGO SECRETO</Text>
          {code ? (
            <Text style={styles.codeText} selectable>
              {code}
            </Text>
          ) : (
            <ActivityIndicator color="#8B1E24" style={{ marginVertical: 10 }} />
          )}
          <Text style={styles.codeHint}>
            Sin este código nadie puede abrir el libro, aunque le llegue el archivo.
          </Text>
        </View>

        <StepButton
          n={1}
          icon="paper-plane-outline"
          title="Enviar el libro"
          text="Por WhatsApp, correo, AirDrop…"
          busy={sending}
          onPress={handleSend}
        />
        <StepButton
          n={2}
          icon="key-outline"
          title={`Darle el código a ${who}`}
          text="Mejor en persona o por otro chat"
          onPress={handleShareCode}
          disabled={!code}
        />

        <Text style={styles.footnote}>
          Si cambias el libro, vuelve a enviarlo: el código sigue siendo el mismo.
        </Text>

        <Pressable onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.rowPressed]}>
          <Text style={styles.cancelText}>Listo</Text>
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
  onPress: () => void;
}> = ({ n, icon, title, text, busy, disabled, onPress }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled || busy}
    style={({ pressed }) => [styles.step, pressed && styles.rowPressed, disabled && styles.disabled]}
  >
    <View style={styles.stepNumber}>
      <Text style={styles.stepNumberText}>{n}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepText}>{busy ? 'Envolviendo el regalo…' : text}</Text>
    </View>
    {busy ? (
      <ActivityIndicator color="#2B3654" />
    ) : (
      <Ionicons name={icon} size={20} color="#2B3654" />
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
  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    setError(null);
    const message = await onSubmit(code);
    setBusy(false);
    if (message) setError(message);
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
        style={{ flex: 1 }}
        // En Android la ventana del Modal ya se encoge con el teclado; con 'height'
        // se descontaba dos veces y la hoja daba un salto al aparecer el teclado
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.giftIcon}>
            <Ionicons name="key" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Este regalo está cerrado con llave</Text>
          <Text style={styles.subtitle}>Escribe el código secreto que te dieron</Text>

          <TextInput
            value={code}
            onChangeText={(text) => {
              setError(null);
              setCode(formatGiftCode(text.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)));
            }}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor="#B9B0A3"
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            style={[styles.codeInput, error && styles.codeInputError]}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!busy}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={submit}
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
    // Sobre el indicador de inicio de iOS (34 pt) sin pegarse a él
    paddingBottom: Math.max(30, SYSTEM_INSETS.bottom + 16),
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2B2623',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#7A7167',
    textAlign: 'center',
    marginTop: 3,
  },
  codeCard: {
    marginTop: 16,
    marginBottom: 6,
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
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#2B3654',
    fontWeight: '700',
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
  footnote: {
    fontSize: 12,
    color: '#8F877B',
    textAlign: 'center',
    marginTop: 12,
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
    minHeight: 50,
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
  cancelText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#2B3654',
  },
});
