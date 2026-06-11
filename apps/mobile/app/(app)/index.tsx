import { useRef } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { GlassCard, GlassNav, GlassPill } from '#/components/glass'
import type { GlassSheetHandle } from '#/components/glass'
import { NotificationsBell } from '#/components/NotificationsBell'
import { NotificationsSheet } from '#/components/NotificationsSheet'
import { useTheme } from '#/theme/use-theme'
import { useDashboardQuery } from '#/hooks/useDashboard'
import type { DashboardStats, UpcomingPaymentItem } from '#/hooks/useDashboard'
import { useProfileQuery } from '#/hooks/useProfile'
import { formatCurrency, type Currency, type Locale } from '#/lib/format'

// Allocation bars cycle through these token roles, mirroring the web
// donut's palette order. Resolved inside the component via useTheme.
const ALLOCATION_TOKEN_ORDER = [
  'primary',
  'secondary',
  'tertiary',
  'outline',
  'onSurfaceVariant',
] as const

function dueLabel(
  p: UpcomingPaymentItem,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (p.isOverdue) {
    return t('common:due.overdueDays', { count: Math.abs(p.daysUntilDue) })
  }
  if (p.daysUntilDue === 0) return t('common:due.today')
  if (p.daysUntilDue === 1) return t('common:due.tomorrow')
  return t('common:due.inDays', { count: p.daysUntilDue })
}

export default function DashboardScreen() {
  const { t, i18n } = useTranslation('dashboard')
  const { colors } = useTheme()
  const sheetRef = useRef<GlassSheetHandle>(null)

  const profile = useProfileQuery()
  const dashboard = useDashboardQuery()

  const locale: Locale = i18n.language === 'bn' ? 'bn' : 'en'
  const currency: Currency = profile.data?.preferredCurrency ?? 'BDT'
  const money = (amount: string | null | undefined) =>
    formatCurrency(amount, currency, { locale })

  const firstName = profile.data?.fullName.trim().split(/\s+/)[0]
  const greeting = firstName
    ? t('greeting', { firstName })
    : t('greetingFallback')

  const stats = dashboard.data

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav
        title={t('common:tabs.dashboard')}
        trailing={
          <NotificationsBell onPress={() => sheetRef.current?.expand()} />
        }
      />

      {dashboard.isPending && !stats ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : dashboard.isError && !stats ? (
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.onSurface }]}>
            {t('errors.loadFailed')}
          </Text>
          <Text style={[styles.errorBody, { color: colors.onSurfaceVariant }]}>
            {t('errors.checkConnection')}
          </Text>
          <Pressable
            onPress={() => void dashboard.refetch()}
            accessibilityRole="button"
            style={[styles.retry, { borderColor: colors.outline }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>
              {t('errors.retry')}
            </Text>
          </Pressable>
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={dashboard.isRefetching}
              onRefresh={() => void dashboard.refetch()}
              tintColor={colors.primary}
            />
          }
        >
          {/* Net worth hero — the screen's single content glass surface
              (tab bar + nav + this card stay within the ≤3 budget). */}
          <GlassCard>
            <Text style={[styles.greeting, { color: colors.onSurfaceVariant }]}>
              {greeting}
            </Text>
            <Text
              style={[styles.heroLabel, { color: colors.onSurfaceVariant }]}
            >
              {t('netWorth.label')}
            </Text>
            <Text style={[styles.heroValue, { color: colors.onSurface }]}>
              {money(stats.netWorth)}
            </Text>
            <Text style={[styles.heroHint, { color: colors.onSurfaceVariant }]}>
              {t('netWorth.hint')}
            </Text>
          </GlassCard>

          <SummaryCard stats={stats} money={money} />
          <AllocationCard stats={stats} money={money} />
          <UpcomingCard stats={stats} money={money} />
        </ScrollView>
      ) : null}

      <NotificationsSheet ref={sheetRef} />
    </View>
  )
}

type MoneyFn = (amount: string | null | undefined) => string

/**
 * Secondary cards are flat (`surface-container-low`) per the ≤3 active
 * glass surfaces rule.
 */
function FlatCard({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme()
  return (
    <View
      style={[styles.flatCard, { backgroundColor: colors.surfaceContainerLow }]}
    >
      {children}
    </View>
  )
}

function SummaryCard({
  stats,
  money,
}: {
  stats: DashboardStats
  money: MoneyFn
}) {
  const { t } = useTranslation('dashboard')
  const { colors } = useTheme()
  const pct = stats.investmentTotals.gainLossPercent
  const tone = pct > 0 ? 'gain' : pct < 0 ? 'loss' : 'neutral'
  const sign = pct > 0 ? '+' : ''

  return (
    <FlatCard>
      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={[styles.cellLabel, { color: colors.onSurfaceVariant }]}>
            {t('summary.invested')}
          </Text>
          <Text style={[styles.cellValue, { color: colors.onSurface }]}>
            {money(stats.investmentTotals.invested)}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={[styles.cellLabel, { color: colors.onSurfaceVariant }]}>
            {t('summary.currentValue')}
          </Text>
          <Text style={[styles.cellValue, { color: colors.onSurface }]}>
            {money(stats.investmentTotals.current)}
          </Text>
        </View>
      </View>
      <View style={styles.summaryRowLast}>
        <View style={styles.summaryCell}>
          <Text style={[styles.cellLabel, { color: colors.onSurfaceVariant }]}>
            {t('summary.monthlyEmi')}
          </Text>
          <Text style={[styles.cellValue, { color: colors.onSurface }]}>
            {money(stats.monthlyEmiOutflow)}
          </Text>
        </View>
        <View style={[styles.summaryCell, styles.pillCell]}>
          <GlassPill tone={tone} label={`${sign}${pct.toFixed(2)}%`} />
        </View>
      </View>
    </FlatCard>
  )
}

function AllocationCard({
  stats,
  money,
}: {
  stats: DashboardStats
  money: MoneyFn
}) {
  const { t } = useTranslation('dashboard')
  const { colors } = useTheme()

  return (
    <FlatCard>
      <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
        {t('allocation.title')}
      </Text>
      {stats.allocation.length === 0 ? (
        <Text style={[styles.cardEmpty, { color: colors.onSurfaceVariant }]}>
          {t('allocation.noData')}
        </Text>
      ) : (
        stats.allocation.map((slice, i) => {
          const barColor =
            colors[ALLOCATION_TOKEN_ORDER[i % ALLOCATION_TOKEN_ORDER.length]]
          return (
            <View key={slice.type} style={styles.allocRow}>
              <View style={styles.allocHeader}>
                <Text style={[styles.allocType, { color: colors.onSurface }]}>
                  {t(`investments:types.${slice.type}`, {
                    defaultValue: slice.type,
                  })}
                </Text>
                <Text
                  style={[
                    styles.allocValue,
                    { color: colors.onSurfaceVariant },
                  ]}
                >
                  {money(slice.value)} · {slice.percent}%
                </Text>
              </View>
              <View
                style={[
                  styles.allocTrack,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <View
                  style={[
                    styles.allocFill,
                    {
                      backgroundColor: barColor,
                      width: `${Math.min(100, Math.max(0, slice.percent))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          )
        })
      )}
    </FlatCard>
  )
}

function UpcomingCard({
  stats,
  money,
}: {
  stats: DashboardStats
  money: MoneyFn
}) {
  const { t } = useTranslation('dashboard')
  const { colors } = useTheme()

  return (
    <FlatCard>
      <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
        {t('upcoming.title')}
      </Text>
      {stats.upcomingPayments.length === 0 ? (
        <Text style={[styles.cardEmpty, { color: colors.onSurfaceVariant }]}>
          {t('upcoming.empty')}
        </Text>
      ) : (
        stats.upcomingPayments.map((p) => (
          <View
            key={`${p.kind}-${p.id}`}
            style={[
              styles.upcomingRow,
              { borderBottomColor: colors.outlineVariant },
            ]}
          >
            <View style={styles.upcomingBody}>
              <Text
                style={[styles.upcomingLabel, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {p.label}
                {p.sequenceNumber !== null ? `  #${p.sequenceNumber}` : ''}
              </Text>
              <Text
                style={[
                  styles.upcomingDue,
                  {
                    color: p.isOverdue
                      ? colors.tertiary
                      : colors.onSurfaceVariant,
                  },
                ]}
              >
                {dueLabel(p, t)}
              </Text>
            </View>
            <Text style={[styles.upcomingAmount, { color: colors.onSurface }]}>
              {money(p.amount)}
            </Text>
          </View>
        ))
      )}
    </FlatCard>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  errorBody: {
    fontSize: 14,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 13,
  },
  heroValue: {
    fontSize: 34,
    fontWeight: '700',
    marginVertical: 4,
  },
  heroHint: {
    fontSize: 12,
  },
  flatCard: {
    borderRadius: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  cardEmpty: {
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  summaryRowLast: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryCell: {
    flex: 1,
    gap: 2,
  },
  pillCell: {
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
  },
  cellLabel: {
    fontSize: 12,
  },
  cellValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  allocRow: {
    marginBottom: 12,
    gap: 6,
  },
  allocHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  allocType: {
    fontSize: 13,
    fontWeight: '600',
  },
  allocValue: {
    fontSize: 12,
  },
  allocTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  allocFill: {
    height: '100%',
    borderRadius: 3,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  upcomingBody: {
    flex: 1,
    gap: 2,
  },
  upcomingLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  upcomingDue: {
    fontSize: 12,
  },
  upcomingAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
})
