import { StyleSheet, Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Phinio Mobile — Phase 3A</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0d',
  },
  text: {
    color: '#f5f5f7',
    fontSize: 18,
    fontWeight: '600',
  },
})
