import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatercolorHeart } from '../Stickers';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type WelcomeStep = 'choose' | 'dedicate';

interface WelcomeScreenProps {
  initialStep?: WelcomeStep;
  /** Nombre ya guardado (al cambiar la dedicatoria). */
  initialName?: string;
  /** Ya hay un libro propio empezado: se ofrece seguir con él. */
  hasOwnBook: boolean;
  /** Ya se abrió un regalo antes: se ofrece volver a verlo. */
  receivedFrom?: string | null;
  /** Termina la dedicatoria: nombre de la persona ('' si se omite). */
  onDedicate: (name: string) => void;
  onContinueOwnBook: () => void;
  onOpenGift: () => void;
  onViewReceived: () => void;
  /** Hay un libro abierto detrás: se puede volver sin cambiar nada. */
  onDismiss?: () => void;
}

/**
 * Primera pantalla: la app sirve para dos cosas distintas —preparar un libro
 * para regalarlo o abrir uno que te regalaron— y aquí se elige cuál.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  initialStep = 'choose',
  initialName = '',
  hasOwnBook,
  receivedFrom,
  onDedicate,
  onContinueOwnBook,
  onOpenGift,
  onViewReceived,
  onDismiss,
}) => {
  const [step, setStep] = useState<WelcomeStep>(initialStep);
  const [name, setName] = useState(initialName);
  useEffect(() => {
    setStep(initialStep);
    setName(initialName);
  }, [initialStep, initialName]);

  if (step === 'dedicate') {
    const trimmed = name.trim();
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => (initialStep === 'dedicate' && onDismiss ? onDismiss() : setStep('choose'))}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityLabel="Volver"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color="#FFF" />
            <Text style={styles.backText}>Volver</Text>
          </Pressable>

          <View style={styles.heartRow}>
            <WatercolorHeart size={44} rotation={-8} />
          </View>
          <Text style={styles.title}>¿Para quién es este libro?</Text>
          <Text style={styles.lead}>
            Su nombre aparecerá en la portada. Sólo lo verá quien tenga el código secreto del
            regalo.
          </Text>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>PARA</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Camila, mi amor…"
              placeholderTextColor="#A39A8E"
              style={styles.input}
              maxLength={40}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => onDedicate(trimmed)}
            />
          </View>

          <Pressable
            onPress={() => onDedicate(trimmed)}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.primaryButtonText}>
              {initialStep === 'dedicate' ? 'Guardar' : 'Empezar a diseñar'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#2B3654" />
          </Pressable>
          {initialStep !== 'dedicate' && (
            <Pressable onPress={() => onDedicate('')} style={styles.linkButton} hitSlop={6}>
              <Text style={styles.linkText}>Prefiero no poner un nombre</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {onDismiss && (
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityLabel="Volver al libro"
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={20} color="#FFF" />
            <Text style={styles.backText}>Volver al libro</Text>
          </Pressable>
        )}

        <View style={styles.heartRow}>
          <WatercolorHeart size={52} rotation={-8} />
        </View>
        <Text style={styles.brand}>Our Memories</Text>
        <Text style={styles.title}>Un libro de recuerdos para regalar</Text>
        <Text style={styles.lead}>
          Diseña un álbum con vuestras fotos y envíaselo a tu pareja con un código secreto: sólo
          quien lo tenga podrá abrirlo.
        </Text>

        <View style={styles.cards}>
          <ChoiceCard
            icon="gift-outline"
            title={hasOwnBook ? 'Seguir con mi regalo' : 'Crear un regalo'}
            text={
              hasOwnBook
                ? 'Continúa diseñando el libro que estás preparando.'
                : 'Diseña el libro página a página y envuélvelo con un código.'
            }
            accent
            onPress={hasOwnBook ? onContinueOwnBook : () => setStep('dedicate')}
          />
          {receivedFrom !== undefined && receivedFrom !== null && (
            <ChoiceCard
              icon="heart-outline"
              title="Ver el regalo que me hicieron"
              text={receivedFrom ? `El libro para ${receivedFrom}.` : 'Vuelve a abrir el libro que te enviaron.'}
              onPress={onViewReceived}
            />
          )}
          <ChoiceCard
            icon="key-outline"
            title="Abrir un regalo"
            text="¿Te enviaron un libro? Elige el archivo y escribe tu código secreto."
            onPress={onOpenGift}
          />
        </View>

        <View style={styles.steps}>
          <StepRow n={1} text="Diseña las páginas con tus fotos" />
          <StepRow n={2} text="Envuelve el regalo: se crea un código secreto" />
          <StepRow n={3} text="Envíale el libro y dale el código en persona" />
        </View>
      </ScrollView>
    </View>
  );
};

const ChoiceCard: React.FC<{
  icon: IconName;
  title: string;
  text: string;
  accent?: boolean;
  onPress: () => void;
}> = ({ icon, title, text, accent, onPress }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.card, accent && styles.cardAccent, pressed && styles.pressed]}
    accessibilityRole="button"
  >
    <View style={[styles.cardIcon, accent && styles.cardIconAccent]}>
      <Ionicons name={icon} size={22} color={accent ? '#FFFFFF' : '#2B3654'} />
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{text}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color="#9A9184" />
  </Pressable>
);

const StepRow: React.FC<{ n: number; text: string }> = ({ n, text }) => (
  <View style={styles.stepRow}>
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeText}>{n}</Text>
    </View>
    <Text style={styles.stepText}>{text}</Text>
  </View>
);

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  back: {
    position: 'absolute',
    top: 8,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  heartRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brand: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    fontStyle: 'italic',
    fontFamily: SERIF,
    marginTop: 6,
  },
  lead: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.82)',
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 10,
    marginHorizontal: 6,
  },
  cards: {
    marginTop: 26,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: '#FBF8F2',
  },
  cardAccent: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0B1020',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EEF0F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconAccent: {
    backgroundColor: '#8B1E24',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    color: '#2B2623',
  },
  cardText: {
    fontSize: 13.5,
    color: '#6F675D',
    marginTop: 3,
    lineHeight: 19,
  },
  steps: {
    marginTop: 26,
    gap: 10,
    paddingHorizontal: 6,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13.5,
  },
  inputCard: {
    marginTop: 26,
    backgroundColor: '#FBF8F2',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#8B1E24',
  },
  input: {
    fontSize: 20,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: '#2B2623',
    paddingVertical: 8,
  },
  primaryButton: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#2B3654',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: 14,
    padding: 6,
  },
  linkText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13.5,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
