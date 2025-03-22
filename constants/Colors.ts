const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#000',
    background: '#fff',
    tint: '#2f95dc',
    icon: '#000',
    tabIconDefault: '#ccc',
    tabIconSelected: '#2f95dc',
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: '#fff',
    icon: '#fff',
    tabIconDefault: '#ccc',
    tabIconSelected: '#fff',
  },
  primary: '#1E8DCC',
  success: '#22C55E',
  error: '#EF4444',
  border: '#E5E7EB',
  text: '#333333',
  background: '#FFFFFF'
};

export type ColorScheme = typeof Colors;
