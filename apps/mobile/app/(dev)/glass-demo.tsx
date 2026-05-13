/**
 * DEV-ONLY screen. Exercises every glass primitive once so we can spot-
 * check tier resolution + visual fidelity on simulators / devices.
 * Reachable at `/glass-demo` because `(dev)` is an expo-router route
 * group (parens segments don't appear in the URL). Will be gated to
 * dev builds or removed before the first production release.
 */
import { useRef } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  GlassCard,
  GlassFAB,
  GlassNav,
  GlassPill,
  GlassSheet,
  GlassSurface,
  type GlassSheetHandle,
} from '#/components/glass'
import { useGlassTier } from '#/lib/glass-tier'
import { useTheme } from '#/theme/use-theme'

export default function GlassDemo() {
  const tier = useGlassTier()
  const { colors } = useTheme()
  const sheetRef = useRef<GlassSheetHandle>(null)

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <GlassNav
        title="Glass demo"
        leading={
          <Text style={{ color: colors.onSurfaceVariant }}>Back</Text>
        }
        trailing={<GlassPill label={`tier: ${tier}`} />}
      />

      <SafeAreaView style={styles.body} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Section title="GlassSurface" subtitle="Base wrapper, 3 variants">
            <GlassSurface borderRadius={12} style={styles.surfaceDemo}>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                variant=&quot;regular&quot;
              </Text>
            </GlassSurface>
            <View style={{ height: 12 }} />
            <GlassSurface
              variant="clear"
              borderRadius={12}
              style={styles.surfaceDemo}
            >
              <Text style={[styles.label, { color: colors.onSurface }]}>
                variant=&quot;clear&quot;
              </Text>
            </GlassSurface>
          </Section>

          <Section title="GlassCard" subtitle="16px radius + 16px padding">
            <GlassCard>
              <Text style={[styles.label, { color: colors.onSurface }]}>
                Net worth
              </Text>
              <Text
                style={[styles.amount, { color: colors.onSurface }]}
              >
                ৳1,24,500.00
              </Text>
            </GlassCard>
          </Section>

          <Section title="GlassPill" subtitle="Neutral / gain / loss tones">
            <View style={styles.row}>
              <GlassPill label="Neutral" />
              <GlassPill label="+5.2%" tone="gain" />
              <GlassPill label="-1.8%" tone="loss" />
            </View>
          </Section>

          <Section
            title="GlassSheet"
            subtitle="Tap the FAB → sheet expands"
          />
        </ScrollView>
      </SafeAreaView>

      <GlassFAB
        onPress={() => sheetRef.current?.expand()}
        accessibilityLabel="Open demo sheet"
      />

      <GlassSheet ref={sheetRef}>
        <Text style={[styles.label, { color: colors.onSurface }]}>
          Demo bottom sheet
        </Text>
        <Text
          style={{ color: colors.onSurfaceVariant, marginTop: 8 }}
        >
          Tier: {tier}
        </Text>
      </GlassSheet>
    </View>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={[styles.sectionSubtitle, { color: colors.onSurfaceVariant }]}
        >
          {subtitle}
        </Text>
      ) : null}
      <View style={{ marginTop: 12 }}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  scroll: {
    padding: 16,
    paddingBottom: 96,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  surfaceDemo: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  amount: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 4,
  },
})
