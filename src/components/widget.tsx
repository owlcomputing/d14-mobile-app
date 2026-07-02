import { StyleSheet, Text, View, type ViewProps } from 'react-native';

import { D14Colors, Radius, Spacing } from '@/constants/theme';

type WidgetProps = ViewProps & {
  /** Small uppercase label shown above the content */
  header?: string;
  variant?: 'default' | 'red' | 'outline';
};

export function Widget({ header, variant = 'default', style, children, ...rest }: WidgetProps) {
  return (
    <View style={[styles.base, variants[variant], style]} {...rest}>
      {header ? (
        <Text style={[styles.header, variant === 'red' && styles.headerOnRed]}>{header}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.two + 4,
  },
  header: {
    color: D14Colors.red,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  headerOnRed: { color: D14Colors.white, opacity: 0.85 },
});

const variants = StyleSheet.create({
  default: { backgroundColor: D14Colors.surface },
  red: { backgroundColor: D14Colors.red },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: D14Colors.border,
  },
});
