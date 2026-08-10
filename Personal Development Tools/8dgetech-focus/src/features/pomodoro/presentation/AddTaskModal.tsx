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
import { Feather } from '@expo/vector-icons';
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
        <View style={[styles.card, { width: cardWidth }]}>
          <View style={styles.body}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What are you working on?"
              placeholderTextColor="#C4C4C4"
              autoFocus
              multiline
              style={styles.titleInput}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={save}
            />

            <Text style={styles.estLabel}>Est Pomodoros</Text>
            <View style={styles.estRow}>
              <View style={styles.estBox}>
                <Text style={styles.estValue}>{estimate}</Text>
              </View>
              <Pressable
                onPress={() => bump(1)}
                accessibilityLabel="Increase estimate"
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.stepBtnPressed,
                ]}
              >
                <Text style={styles.stepGlyph}>▲</Text>
              </Pressable>
              <Pressable
                onPress={() => bump(-1)}
                accessibilityLabel="Decrease estimate"
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed && styles.stepBtnPressed,
                ]}
              >
                <Text style={styles.stepGlyph}>▼</Text>
              </Pressable>
            </View>

            {noteOpen ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Some notes..."
                placeholderTextColor="#B0B0B0"
                multiline
                style={styles.noteInput}
              />
            ) : null}

            <View style={styles.linksRow}>
              <Pressable
                onPress={() => setNoteOpen(true)}
                style={styles.linkHit}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>+ Add Note</Text>
              </Pressable>
              <Pressable
                style={styles.linkHit}
                disabled
                accessibilityRole="button"
              >
                <Text style={[styles.linkText, styles.linkMuted]}>
                  + Add Project
                </Text>
                <Feather name="lock" size={13} color="#B0B0B0" />
              </Pressable>
            </View>
          </View>

          <View style={styles.footer}>
            {editing && onDelete ? (
              <Pressable
                onPress={onDelete}
                hitSlop={8}
                style={styles.deleteHit}
              >
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            ) : (
              <View style={styles.footerSpacer} />
            )}
            <Pressable onPress={onClose} hitSlop={8} style={styles.cancelHit}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!title.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                !title.trim() && styles.saveBtnDisabled,
                pressed && title.trim() ? { opacity: 0.88 } : null,
              ]}
            >
              <Text style={styles.saveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const fontBody = Platform.select({
  web: 'Outfit, system-ui, sans-serif',
  default: 'System',
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
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
    color: '#333',
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
    color: '#555555',
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
    backgroundColor: '#EFEFEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  estValue: {
    fontFamily: fontBody,
    fontSize: 18,
    fontWeight: '600',
    color: '#555',
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      },
      default: {
        elevation: 2,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
    }),
  },
  stepBtnPressed: {
    backgroundColor: '#F5F5F5',
  },
  stepGlyph: {
    fontSize: 11,
    color: '#666',
    lineHeight: 14,
  },
  noteInput: {
    marginHorizontal: 20,
    marginBottom: 8,
    minHeight: 70,
    borderRadius: 6,
    backgroundColor: '#F4F0D9',
    color: '#5C5428',
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
    color: '#7A7A7A',
    textDecorationLine: 'underline',
  },
  linkMuted: {
    color: '#A8A8A8',
  },
  footer: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFEFEF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E2E2',
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
    color: '#BA4949',
  },
  cancelHit: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    fontFamily: fontBody,
    fontSize: 14,
    fontWeight: '500',
    color: '#A0A0A0',
  },
  saveBtn: {
    backgroundColor: '#3D3D3D',
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
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
