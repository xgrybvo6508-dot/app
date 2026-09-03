// Общие композиции стилей поверх токенов (lib/theme/tokens.ts) — карточки,
// кнопки, поля ввода, чипы повторяются почти на каждом экране почти
// один-в-один; вынесены сюда один раз, чтобы визуальный язык гарантированно
// не расходился между экранами.
import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from './tokens';

export const sharedStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  hairlineTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  hairlineBottom: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },

  sectionTitle: {
    ...typography.sectionTitle,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  emptyText: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  cardTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  cardMeta: { ...typography.caption, color: colors.textMuted },

  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm + 2,
    color: colors.textPrimary,
  },
  multilineInput: { textAlignVertical: 'top' },

  rowGap: { flexDirection: 'row', gap: spacing.sm },
  columnGap: { gap: spacing.sm },
  addBox: { padding: spacing.md, gap: spacing.sm },
  flex1: { flex: 1 },

  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: colors.textInverse, fontSize: 13 },

  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.textSecondary, fontSize: 13 },

  chip: {
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.accent },
  chipText: { fontSize: 12, color: colors.textSecondary },
  chipTextActive: { fontSize: 12, color: colors.textInverse },

  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonText: { color: colors.textInverse, fontSize: 20, lineHeight: 22 },

  bannerAccent: {
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bannerAccentText: { fontSize: 12, color: colors.accentSoftText, fontWeight: '600' },
});
