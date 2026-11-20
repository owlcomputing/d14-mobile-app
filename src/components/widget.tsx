import { Text, View, type ViewProps } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { makeStyles } from '@/lib/theme';

type WidgetProps = ViewProps & {
  /** Small uppercase label shown above the content */
  header?: string;
  variant?: 'default' | 'red' | 'outline';
};

export function Widget({ header, variant = 'default', style, children, ...rest }: WidgetProps) {
  const styles = useStyles();
  const variants = useVariants();
  return (
    <View style={[styles.base, variants[variant], style]} {...rest}>
      {header ? (
        <Text style={[styles.header, variant === 'red' && styles.headerOnRed]}>{header}</Text>
      ) : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  base: {
    borderRadius: Radius.lg,
    padding: Spacing.three,
    marginBottom: Spacing.two + 4,
  },
  header: {
    color: c.red,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.two,
  },
  headerOnRed: { color: c.onAccent, opacity: 0.85 },
}));

const useVariants = makeStyles((c) => ({
  default: { backgroundColor: c.surface },
  red: { backgroundColor: c.red },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: c.border,
  },
}));
