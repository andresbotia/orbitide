import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface Props {
  children: ReactNode;
  /** Shown above the error message. */
  title?: string;
  onReset?: () => void;
}
interface State {
  error: Error | null;
}

/** Keeps a crash in the embedded playtest / solver from taking down the Studio. */
export class StudioErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>{this.props.title ?? 'Something went wrong'}</Text>
        <Text style={styles.message}>{this.state.error.message}</Text>
        {this.props.onReset ? (
          <StudioButton
            label="Dismiss"
            onPress={() => {
              this.setState({ error: null });
              this.props.onReset?.();
            }}
          />
        ) : null}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    padding: studioSpace.lg,
    gap: studioSpace.sm,
    borderWidth: 1,
    borderColor: studioTheme.error,
    borderRadius: 8,
    backgroundColor: studioTheme.panel,
  },
  title: { color: studioTheme.error, fontSize: 13, fontWeight: '700' },
  message: { color: studioTheme.textDim, fontSize: 11, fontFamily: studioTheme.mono },
});
