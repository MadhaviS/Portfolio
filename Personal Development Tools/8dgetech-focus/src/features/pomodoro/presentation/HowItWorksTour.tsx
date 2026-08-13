import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { fontBody } from '../../../core/theme/fonts';

export type TourStep = {
  title: string;
  body: string;
};

const DEFAULT_STEPS: TourStep[] = [
  {
    title: 'How it works',
    body: 'Work in short focus blocks, then take a break. This tour walks you through the flow — you can skip anytime.',
  },
  {
    title: 'Add a task',
    body: 'Write what you want to finish today in the task list. Tap a task to make it the one you are working on.',
  },
  {
    title: 'Estimate focus blocks',
    body: 'Each Pulse block is one focus session (default 25 minutes). Use + / − on a task to set how many blocks you expect.',
  },
  {
    title: 'Start and focus',
    body: 'Choose Focus, press START, and stay with the task until the timer ends. Pause anytime if you need to.',
  },
  {
    title: 'Break, then repeat',
    body: 'After focus, take a short break (or a longer one every few rounds). Keep going until your tasks are done.',
  },
];

type HowItWorksTourProps = {
  open: boolean;
  onFinish: () => void;
  steps?: TourStep[];
};

export function HowItWorksTour({
  open,
  onFinish,
  steps = DEFAULT_STEPS,
}: HowItWorksTourProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isCompact = width < 560;
  const [index, setIndex] = useState(0);

  const step = steps[index] ?? steps[0];
  const isLast = index >= steps.length - 1;
  const progress = useMemo(
    () => steps.map((_, i) => i <= index),
    [index, steps],
  );

  const finish = () => {
    setIndex(0);
    onFinish();
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const back = () => {
    setIndex((i) => Math.max(i - 1, 0));
  };

  return (
    <Modal
      visible={open}
      animationType={isCompact ? 'slide' : 'fade'}
      transparent
      onRequestClose={finish}
    >
      <View
        style={[
          styles.backdrop,
          isCompact ? styles.backdropCompact : styles.backdropWide,
        ]}
      >
        <View
          style={[
            styles.card,
            isCompact ? styles.cardCompact : styles.cardWide,
            {
              backgroundColor: c.surface,
              borderColor: c.border,
              maxHeight: height * (isCompact ? 0.9 : 0.8),
              width: isCompact ? '100%' : Math.min(440, width - 48),
            },
          ]}
        >
          {isCompact ? (
            <View style={[styles.handle, { backgroundColor: c.border }]} />
          ) : null}

          <View style={styles.topRow}>
            <Text style={[styles.kicker, { color: c.onSurfaceMuted }]}>
              Tour · {index + 1} of {steps.length}
            </Text>
            <Pressable onPress={finish} hitSlop={8} accessibilityLabel="Skip tour">
              <Text style={[styles.skip, { color: c.onSurfaceMuted }]}>Skip</Text>
            </Pressable>
          </View>

          <View style={styles.dots}>
            {progress.map((done, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor: done ? c.primary : c.border,
                    width: i === index ? 18 : 8,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.title, { color: c.onSurface }]}>{step.title}</Text>
          <Text style={[styles.body, { color: c.onSurfaceMuted }]}>{step.body}</Text>

          <View style={styles.actions}>
            {index > 0 ? (
              <Pressable
                onPress={back}
                style={[styles.secondaryBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.secondaryLabel, { color: c.onSurface }]}>
                  Back
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={finish}
                style={[styles.secondaryBtn, { borderColor: c.border }]}
              >
                <Text style={[styles.secondaryLabel, { color: c.onSurface }]}>
                  Skip tour
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={next}
              style={[styles.primaryBtn, { backgroundColor: c.primary }]}
            >
              <Text style={styles.primaryLabel}>
                {isLast ? 'Got it' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdropWide: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdropCompact: {
    justifyContent: 'flex-end',
  },
  card: {
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 18,
    gap: 12,
  },
  cardWide: {
    borderRadius: 16,
    paddingTop: 18,
  },
  cardCompact: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    marginBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    fontFamily: fontBody,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  skip: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '600',
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontFamily: fontBody,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  body: {
    fontFamily: fontBody,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '500',
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  secondaryLabel: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryLabel: {
    fontFamily: fontBody,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
