import { useRef, useState } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { SymbolView } from 'expo-symbols'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  addDepositSchema,
  dpsCloseSchema,
  investmentUpdateSchema,
  withdrawalSchema,
} from '@phinio/validators'
import { GlassNav, GlassPill } from '#/components/glass'
import type { GlassSheetHandle } from '#/components/glass'
import { ErrorState, LoadingState } from '#/components/ScreenState'
import { FormSheet, type FormSheetConfig } from '#/components/FormSheet'
import { useTheme } from '#/theme/use-theme'
import {
  useAddDeposit,
  useCloseDps,
  useDeleteInvestment,
  useDeleteSavings,
  useInvestmentQuery,
  useMarkDepositPaid,
  useUpdateInvestment,
  useWithdraw,
} from '#/hooks/useInvestments'
import { useMoney } from '#/hooks/useMoney'

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function zodFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const field = String(issue.path[0] ?? '')
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message
  }
  return fieldErrors
}

function BackButton() {
  const router = useRouter()
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={() => router.back()}
      accessibilityRole="button"
      hitSlop={8}
    >
      {Platform.OS === 'ios' ? (
        <SymbolView
          name="chevron.left"
          size={20}
          tintColor={colors.onSurface}
          fallback={
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          }
        />
      ) : (
        <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
      )}
    </Pressable>
  )
}

export default function InvestmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { t } = useTranslation('investments')
  const { colors } = useTheme()
  const router = useRouter()
  const { money, date } = useMoney()

  const detail = useInvestmentQuery(id ?? '')
  const inv = detail.data

  const sheetRef = useRef<GlassSheetHandle>(null)
  const [sheetConfig, setSheetConfig] = useState<FormSheetConfig | null>(null)
  const markDepositPaid = useMarkDepositPaid(id ?? '')
  const updateInvestment = useUpdateInvestment()
  const deleteInvestment = useDeleteInvestment()
  const deleteSavings = useDeleteSavings()
  const withdraw = useWithdraw()
  const addDeposit = useAddDeposit()
  const closeDps = useCloseDps()

  const isActive = inv?.status === 'active'

  const openSheet = (config: FormSheetConfig) => {
    setSheetConfig(config)
    // Give state a tick to propagate before expanding.
    requestAnimationFrame(() => sheetRef.current?.expand())
  }

  const openWithdraw = () =>
    openSheet({
      title: t('withdraw:title'),
      submitLabel: t('withdraw:confirm'),
      fields: [
        {
          key: 'amount',
          label: t('withdraw:amountLabel'),
          keyboardType: 'decimal-pad',
          placeholder: '0.00',
        },
        {
          key: 'withdrawalDate',
          label: t('withdraw:dateLabel'),
          initialValue: isoToday(),
          placeholder: 'YYYY-MM-DD',
        },
        { key: 'notes', label: t('withdraw:notesLabel') },
      ],
      onSubmit: (values) => {
        const parsed = withdrawalSchema.safeParse({
          investmentId: id,
          amount: values.amount,
          withdrawalDate: values.withdrawalDate,
          notes: values.notes || undefined,
        })
        if (!parsed.success) return zodFieldErrors(parsed.error.issues)
        withdraw.mutate(parsed.data)
        return null
      },
    })

  const openAddDeposit = () =>
    openSheet({
      title: t('savings.depositTitle'),
      submitLabel: t('savings.depositCta'),
      fields: [
        {
          key: 'amount',
          label: t('savings.depositAmount'),
          keyboardType: 'decimal-pad',
          placeholder: '0.00',
        },
        {
          key: 'depositDate',
          label: t('savings.startDate'),
          initialValue: isoToday(),
          placeholder: 'YYYY-MM-DD',
        },
      ],
      onSubmit: (values) => {
        const parsed = addDepositSchema.safeParse({
          investmentId: id,
          amount: values.amount,
          depositDate: values.depositDate,
        })
        if (!parsed.success) return zodFieldErrors(parsed.error.issues)
        addDeposit.mutate(parsed.data)
        return null
      },
    })

  const openCloseDps = () =>
    openSheet({
      title: t('dps.closePremature'),
      submitLabel: t('dps.closePremature'),
      fields: [
        {
          key: 'receivedAmount',
          label: t('withdraw:amountReceivedLabel'),
          keyboardType: 'decimal-pad',
          placeholder: '0.00',
        },
        {
          key: 'closureDate',
          label: t('withdraw:closureDateLabel'),
          initialValue: isoToday(),
          placeholder: 'YYYY-MM-DD',
        },
      ],
      onSubmit: (values) => {
        const parsed = dpsCloseSchema.safeParse({
          investmentId: id,
          receivedAmount: values.receivedAmount,
          closureDate: values.closureDate,
        })
        if (!parsed.success) return zodFieldErrors(parsed.error.issues)
        closeDps.mutate(parsed.data)
        return null
      },
    })

  const openComplete = () => {
    if (!inv || !inv.dateOfInvestment) return
    openSheet({
      title: t('form.completed'),
      submitLabel: t('form.submit'),
      fields: [
        {
          key: 'exitValue',
          label: t('form.exitValueLabel'),
          keyboardType: 'decimal-pad',
          initialValue: inv.currentValue,
        },
        {
          key: 'completedAt',
          label: t('form.completionDateLabel'),
          initialValue: isoToday(),
          placeholder: 'YYYY-MM-DD',
        },
      ],
      onSubmit: (values) => {
        const parsed = investmentUpdateSchema.safeParse({
          id: inv.id,
          name: inv.name,
          type: inv.type,
          investedAmount: inv.investedAmount,
          currentValue: inv.currentValue,
          dateOfInvestment: inv.dateOfInvestment!.toISOString().slice(0, 10),
          estimatedClosureDate: inv.estimatedClosureDate
            ? inv.estimatedClosureDate.toISOString().slice(0, 10)
            : undefined,
          notes: inv.notes ?? undefined,
          status: 'completed',
          exitValue: values.exitValue,
          completedAt: values.completedAt,
        })
        if (!parsed.success) return zodFieldErrors(parsed.error.issues)
        updateInvestment.mutate(parsed.data)
        return null
      },
    })
  }

  const confirmDelete = () => {
    Alert.alert(t('form.deleteConfirmTitle'), t('form.deleteConfirmBody'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('form.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          const mutation =
            inv?.mode === 'flexible' ? deleteSavings : deleteInvestment
          mutation.mutate({ id: id ?? '' })
          router.back()
        },
      },
    ])
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface }]}>
      <GlassNav title={inv?.name ?? ''} leading={<BackButton />} />
      {detail.isPending && !inv ? (
        <LoadingState />
      ) : detail.isError && !inv ? (
        <ErrorState
          message={t('list.loadFailed')}
          onRetry={() => void detail.refetch()}
        />
      ) : inv ? (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Summary — flat; the nav + tab bar already hold glass budget. */}
          <View
            style={[styles.card, { backgroundColor: colors.surfaceContainerLow }]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.type, { color: colors.onSurfaceVariant }]}>
                {t(`types.${inv.type}`, { defaultValue: inv.type })}
              </Text>
              <GlassPill
                tone={inv.status === 'active' ? 'neutral' : 'gain'}
                label={
                  inv.status === 'active'
                    ? t('form.active')
                    : t('form.completed')
                }
              />
            </View>
            <Row label={t('form.investedLabel')} value={money(inv.investedAmount)} />
            <Row
              label={t('form.currentValueLabel')}
              value={money(inv.currentValue)}
            />
            {inv.exitValue ? (
              <Row label={t('form.exitValueLabel')} value={money(inv.exitValue)} />
            ) : null}
            {inv.dateOfInvestment ? (
              <Row label={t('form.dateLabel')} value={date(inv.dateOfInvestment)} />
            ) : null}
            {inv.estimatedClosureDate ? (
              <Row
                label={t('form.estimatedClosureLabel')}
                value={date(inv.estimatedClosureDate)}
              />
            ) : null}
            {inv.completedAt ? (
              <Row
                label={t('form.completionDateLabel')}
                value={date(inv.completedAt)}
              />
            ) : null}
            {inv.notes ? (
              <Text style={[styles.notes, { color: colors.onSurfaceVariant }]}>
                {inv.notes}
              </Text>
            ) : null}
          </View>

          {inv.mode === 'scheduled' && inv.deposits.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                {t('dps.depositSchedule')}
              </Text>
              {inv.deposits.map((d) => (
                <View
                  key={d.id}
                  style={[
                    styles.scheduleRow,
                    { borderBottomColor: colors.outlineVariant },
                  ]}
                >
                  <Text
                    style={[styles.scheduleNum, { color: colors.onSurfaceVariant }]}
                  >
                    #{d.installmentNumber ?? '—'}
                  </Text>
                  <View style={styles.scheduleBody}>
                    <Text style={[styles.scheduleDate, { color: colors.onSurface }]}>
                      {date(d.paidAt ?? d.dueDate)}
                    </Text>
                    {d.accruedValue ? (
                      <Text
                        style={[
                          styles.scheduleMeta,
                          { color: colors.onSurfaceVariant },
                        ]}
                      >
                        {t('dps.balanceAfter')}: {money(d.accruedValue)}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.scheduleAmount, { color: colors.onSurface }]}>
                    {money(d.amount)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (!isActive) return
                      markDepositPaid.mutate({
                        depositId: d.id,
                        paid: d.status !== 'paid',
                      })
                    }}
                    disabled={!isActive}
                    accessibilityRole="button"
                    accessibilityLabel={t('dps.markPaid')}
                  >
                    <GlassPill
                      tone={d.status === 'paid' ? 'gain' : 'neutral'}
                      label={
                        d.status === 'paid'
                          ? t('dps.statusPaid')
                          : t('dps.statusUpcoming')
                      }
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {inv.withdrawals.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surfaceContainerLow },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.onSurface }]}>
                {t('form.withdrawals')}
              </Text>
              {inv.withdrawals.map((w) => (
                <View
                  key={w.id}
                  style={[
                    styles.scheduleRow,
                    { borderBottomColor: colors.outlineVariant },
                  ]}
                >
                  <View style={styles.scheduleBody}>
                    <Text style={[styles.scheduleDate, { color: colors.onSurface }]}>
                      {date(w.withdrawalDate)}
                    </Text>
                    {w.notes ? (
                      <Text
                        style={[
                          styles.scheduleMeta,
                          { color: colors.onSurfaceVariant },
                        ]}
                        numberOfLines={1}
                      >
                        {w.notes}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={[styles.scheduleAmount, { color: colors.onSurface }]}>
                    {money(w.amount)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {isActive ? (
            <View style={styles.actions}>
              {inv.mode === 'flexible' ? (
                <ActionButton
                  label={t('savings.depositCta')}
                  color={colors.primary}
                  onPress={openAddDeposit}
                />
              ) : null}
              {inv.mode !== 'scheduled' ? (
                <ActionButton
                  label={t('list.withdraw')}
                  color={colors.primary}
                  onPress={openWithdraw}
                />
              ) : null}
              {inv.mode === 'lump_sum' ? (
                <ActionButton
                  label={t('form.completed')}
                  color={colors.primary}
                  onPress={openComplete}
                />
              ) : null}
              {inv.mode === 'scheduled' ? (
                <ActionButton
                  label={t('dps.closePremature')}
                  color={colors.primary}
                  onPress={openCloseDps}
                />
              ) : null}
              <ActionButton
                label={t('form.delete')}
                color={colors.tertiary}
                onPress={confirmDelete}
              />
            </View>
          ) : null}
        </ScrollView>
      ) : null}
      <FormSheet
        ref={sheetRef}
        config={sheetConfig}
        onDone={() => sheetRef.current?.close()}
      />
    </View>
  )
}

function ActionButton({
  label,
  color,
  onPress,
}: {
  label: string
  color: string
  onPress: () => void
}) {
  const { colors } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.actionButton, { borderColor: colors.outline }]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme()
  return (
    <View style={styles.kvRow}>
      <Text style={[styles.kvLabel, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text style={[styles.kvValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 120,
  },
  card: {
    borderRadius: 16,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  type: {
    fontSize: 13,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  kvLabel: {
    fontSize: 13,
  },
  kvValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notes: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleNum: {
    fontSize: 12,
    minWidth: 28,
  },
  scheduleBody: {
    flex: 1,
    gap: 2,
  },
  scheduleDate: {
    fontSize: 13,
    fontWeight: '500',
  },
  scheduleMeta: {
    fontSize: 12,
  },
  scheduleAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: '40%',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
