import React from 'react';
import { type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

type IconProps = {
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle | TextStyle>;
};

/** App icons via @expo/vector-icons (Feather / Ionicons / MaterialCommunity). */

export function IconTarget({ color = '#FB7160', size = 28, style }: IconProps) {
  return <Feather name="crosshair" size={size} color={color} style={style as TextStyle} />;
}

export function IconChecklist({ color = '#FB7160', size = 28, style }: IconProps) {
  return <Feather name="check-square" size={size} color={color} style={style as TextStyle} />;
}

export function IconChart({ color = '#FB7160', size = 28, style }: IconProps) {
  return <Feather name="trending-up" size={size} color={color} style={style as TextStyle} />;
}

export function IconReport({ color = '#1A1C20', size = 18, style }: IconProps) {
  return <Feather name="bar-chart-2" size={size} color={color} style={style as TextStyle} />;
}

export function IconPerson({ color = '#FB7160', size = 28, style }: IconProps) {
  return <Feather name="user" size={size} color={color} style={style as TextStyle} />;
}

export function IconTomatoClock({ color = '#FFFFFF', size = 36, style }: IconProps) {
  return <Ionicons name="timer-outline" size={size} color={color} style={style as TextStyle} />;
}

export function IconSun({ color = '#1A1A1D', size = 18, style }: IconProps) {
  return <Feather name="sun" size={size} color={color} style={style as TextStyle} />;
}

export function IconMoon({ color = '#FFF8F2', size = 18, style }: IconProps) {
  return <Feather name="moon" size={size} color={color} style={style as TextStyle} />;
}

export function IconClock({ color = 'rgba(255,255,255,0.35)', size = 28, style }: IconProps) {
  return <Feather name="clock" size={size} color={color} style={style as TextStyle} />;
}

export function IconPlant({ color = 'rgba(255,255,255,0.35)', size = 28, style }: IconProps) {
  return <MaterialCommunityIcons name="leaf" size={size} color={color} style={style as TextStyle} />;
}

export function IconSpark({ color = '#C8BDB0', size = 14, style }: IconProps) {
  return <Ionicons name="sparkles-outline" size={size} color={color} style={style as TextStyle} />;
}

export function IconChevron({ color = '#FFFFFF', size = 22, style }: IconProps) {
  return <Feather name="chevron-right" size={size} color={color} style={style as TextStyle} />;
}

export function IconGear({ color = '#1A1C20', size = 18, style }: IconProps) {
  return <Feather name="settings" size={size} color={color} style={style as TextStyle} />;
}

export function IconLogin({ color = '#1A1C20', size = 18, style }: IconProps) {
  return (
    <Ionicons name="person-outline" size={size} color={color} style={style as TextStyle} />
  );
}

export function IconLogout({ color = '#1A1C20', size = 18, style }: IconProps) {
  return (
    <Ionicons name="exit-outline" size={size} color={color} style={style as TextStyle} />
  );
}
