import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from './ThemeProvider';

/** Solid theme canvas behind the navigator (landing adds its own doodle image). */
export function DoodleBackground({ children }: { children: React.ReactNode }) {
  const { theme, resolved } = useTheme();

  return (
    <View
      key={resolved}
      style={[styles.root, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
