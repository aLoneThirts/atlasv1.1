import { StyleSheet, Text, View } from 'react-native';

export function HeartsRow({ hearts, max = 5, size = 18 }: { hearts: number; max?: number; size?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Text key={i} style={[{ fontSize: size }, i >= hearts && styles.off]}>
          ❤️
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 2,
  },
  off: {
    opacity: 0.35,
  },
});
