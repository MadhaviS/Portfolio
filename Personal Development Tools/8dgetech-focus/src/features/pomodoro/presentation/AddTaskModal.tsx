import React, { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTheme } from '../../../core/theme/ThemeProvider';
import { fontBody } from '../../../core/theme/fonts';
import type { PomodoroTask } from '../domain/types';

type Props = {
  open: boolean;
  initialTask?: PomodoroTask | null;
  onClose: () => void;
  onSave: (payload: { title: string; estimate: number; note: string }) => void;
  onDelete?: () => void;
};

export function AddTaskModal({
  open,
  initialTask = null,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(480, width - 32);
  const [title, setTitle] = useState('');
  const [estimate, setEstimate] = useState(1);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const editing = !!initialTask;

  useEffect(() => {
    if (!open) return;
    if (initialTask) {
      setTitle(initialTask.title);
      setEstimate(Math.max(1, initialTask.estimatePomodoros));
      setNote(initialTask.note ?? '');
      setNoteOpen(Boolean(initialTask.note?.trim()));
      return;
    }
    setTitle('');
    setEstimate(1);
    setNote('');
    setNoteOpen(false);
  }, [open, initialTask]);

  const bump = (delta: number) => {
    setEstimate((n) => Math.max(1, Math.min(99, n + delta)));
  };

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      estimate,
      note: note.trim(),
    });
    onClose();
  };

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.card,
            { width: cardWidth, backgroundColor: c.surface, borderColor: c.border },
          ]}
        >
          <View style={styles.body}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What are you working on?"
              placeholderTextColor={c.onSurfaceMuted}
              autoFocus
              multiline
              style={[styles.titleInput, { color: c.onSurface }]}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={save}
            />

            <Text style={[styles.estLabel, { color: c.onSurface }]}>Est Pomodoros</Text>
            <View style={styles.estRow}>
              <View style={[styles.estBox, { backgroundColor: c.backgroundAlt }]}>
                <Text style={[styles.estValue, { color: c.onSurface }]}>{estimate}</Text>
              </View>
              <Pressable
                onPress={() => bump(1)}
                accessibilityLabel="Increase estimate"
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    backgroundColor: pressed ? c.backgroundAlt : c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={[styles.stepGlyph, { color: c.onSurfaceMuted }]}>▲</Text>
              </Pressable>
              <Pressable
                onPress={() => bump(-1)}
                accessibilityLabel="Decrease estimate"
                style={({ pressed }) => [
                  styles.stepBtn,
                  {
                    backgroundColor: pressed ? c.backgroundAlt : c.surface,
                    borderColor: c.border,
                  },
                ]}
              >
                <Text style={[styles.stepGlyph, { color: c.onSurfaceMuted }]}>▼</Text>
              </Pressable>
            </View>

            {noteOpen ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Some notes..."
                placeholderTextColor={c.onSurfaceMuted}
                multiline
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: `${c.primary}14`,
                    color: c.onSurface,
                  },
                ]}
              />
            ) : null}

            <View style={styles.linksRow}>
              <Pressable
                onPress={() => setNoteOpen(true)}
                style={styles.linkHit}
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, { color: c.primary }]}>+ Add Note</Text>
              </Pressable>
              <Pressable
                style={styles.linkHit}
                disabled
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, { color: c.onSurfaceMuted }]}>
                  + Add Project
                </Text>
                <Feather name="lock" size={13} color={c.onSurfaceMuted} />
              </Pressable>
            </View>
          </View>

          <View
            style={[
              styles.footer,
              {
                backgroundColor: c.backgroundAlt,
                borderTopColor: c.border,
              },
            ]}
          >
            {editing && onDelete ? (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={styles.deleteHit}
              >
                <Text style={[styles.deleteText, { color: c.danger }]}>Delete</Text>
              </Pressable>
            ) : (
              <View style={styles.footerSpacer} />
            )}
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelHit}>
              <Text style={[styles.cancelText, { color: c.onSurfaceMuted }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!title.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: c.primary },
                !title.trim() && styles.saveBtnDisabled,
                pressed && title.trim() ? { opacity: 0.88 } : null,
              ]}
            >
              <Text style={[styles.saveText, { color: c.primaryText }]}>Save</Text>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 12px 36px rgba(0,0,0,0.28)',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  body: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  titleInput: {
    fontFamily: fontBody,
    fontSize: 22,
    fontStyle: 'italic',
    fontWeight: '500',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 20,
    minHeight: 56,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  estLabel: {
    fontFamily: fontBody,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  estRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  estBox: {
    width: 72,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estValue: {
    fontFamily: fontBody,
    fontSize: 18,
    fontWeight: '600',
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stepGlyph: {
    fontSize: 11,
    lineHeight: 14,
  },
  noteInput: {
    marginHorizontal: 20,
    marginBottom: 8,
    minHeight: 70,
    borderRadius: 6,
    fontFamily: fontBody,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: 'top',
  },
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  linkHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  linkText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerSpacer: {
    flex: 1,
  },
  deleteHit: {
    marginRight: 'auto',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deleteText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '600',
  },
  cancelHit: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
  },
  saveBtn: {
    borderRadius: 6,
    paddingHorizontal: 22,
    paddingVertical: 10,
    minWidth: 78,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '700',
  },
});
