import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Surface } from '@/components/ui/surface';
import { AppText } from '@/components/ui/text';
import {
  getComplexityLabel,
  getRiskMeta,
  type AiAnalysis,
} from '@/features/service-request/ai';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/theme';
import { formatDateTime } from '@/utils/format';

interface AiAnalysisCardProps {
  analysis: AiAnalysis | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Kartu hasil analisis AI dengan token semantik (adaptif Light & Dark).
 */
export function AiAnalysisCard({
  analysis,
  loading = false,
  error = null,
  onRetry,
  retrying = false,
  title = 'Analisis AI',
  subtitle = 'Indikasi awal — bukan diagnosis final',
  style,
}: AiAnalysisCardProps) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <Surface variant="default" padding="lg" style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={17} color={theme.colors.statusInfoFg} />
        </View>
        <View style={styles.headerCopy}>
          <AppText variant="title">{title}</AppText>
          <AppText variant="caption" tone="secondary">
            {subtitle}
          </AppText>
        </View>
        {analysis ? <RiskChip level={analysis.riskLevel} /> : null}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <Skeleton height={12} width="90%" />
          <Skeleton height={12} width="75%" />
          <Skeleton height={12} width="82%" />
          <Skeleton height={48} width="100%" style={styles.loadingBlock} />
        </View>
      ) : analysis ? (
        <AnalysisBody analysis={analysis} />
      ) : (
        <View style={[styles.notice, error ? styles.noticeError : styles.noticeEmpty]}>
          <Ionicons
            name={error ? 'cloud-offline-outline' : 'sparkles-outline'}
            size={18}
            color={error ? theme.colors.statusDangerFg : theme.colors.textSecondary}
          />
          <View style={styles.noticeCopy}>
            <AppText variant="label" tone={error ? 'danger' : 'secondary'}>
              {error ? 'Analisis AI gagal dimuat' : 'Analisis AI belum tersedia'}
            </AppText>
            <AppText variant="caption" tone="secondary">
              {error ||
                'Permintaan tetap bisa diproses. Montir akan melakukan pemeriksaan langsung.'}
            </AppText>
            {onRetry ? (
              <Button
                label={retrying ? 'Menganalisis…' : 'Analisis ulang'}
                icon="refresh-outline"
                variant="secondary"
                compact
                loading={retrying}
                onPress={onRetry}
                style={styles.retry}
              />
            ) : null}
          </View>
        </View>
      )}
    </Surface>
  );
}

function AnalysisBody({ analysis }: { analysis: AiAnalysis }) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  const complexity = getComplexityLabel(analysis.estimatedComplexity);

  return (
    <View style={styles.body}>
      {analysis.symptomsSummary ? (
        <View style={styles.summaryBox}>
          <AppText variant="overline" tone="info">
            Ringkasan indikasi
          </AppText>
          <AppText variant="body">{analysis.symptomsSummary}</AppText>
        </View>
      ) : null}

      {analysis.possibleIssues.length > 0 ? (
        <Section icon="help-circle-outline" title="Kemungkinan penyebab">
          {analysis.possibleIssues.map((issue, index) => (
            <View key={`${issue.title}-${index}`} style={styles.issueRow}>
              <View style={styles.issueDot} />
              <View style={styles.issueCopy}>
                <View style={styles.issueTitleRow}>
                  <AppText variant="label" style={styles.issueTitle}>
                    {issue.title}
                  </AppText>
                  {issue.likelihood ? (
                    <Badge label={issue.likelihood} tone="neutral" size="sm" />
                  ) : null}
                </View>
                {issue.note ? (
                  <AppText variant="caption" tone="secondary">
                    {issue.note}
                  </AppText>
                ) : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {analysis.recommendedChecks.length > 0 ? (
        <Section icon="checkmark-done-outline" title="Pemeriksaan awal">
          {analysis.recommendedChecks.map((check, index) => (
            <Bullet
              key={`${check}-${index}`}
              icon="checkmark"
              text={check}
              color={theme.colors.statusInfoFg}
            />
          ))}
        </Section>
      ) : null}

      {analysis.suggestedTools.length > 0 ? (
        <Section icon="construct-outline" title="Alat yang mungkin dibutuhkan">
          {analysis.suggestedTools.map((tool, index) => (
            <Bullet
              key={`${tool}-${index}`}
              icon="ellipse"
              text={tool}
              color={theme.colors.textMuted}
            />
          ))}
        </Section>
      ) : null}

      {analysis.questionsForClient.length > 0 ? (
        <Section icon="chatbubble-ellipses-outline" title="Pertanyaan untuk client">
          {analysis.questionsForClient.map((question, index) => (
            <Bullet
              key={`${question}-${index}`}
              icon="help"
              text={question}
              color={theme.colors.statusWarningFg}
            />
          ))}
        </Section>
      ) : null}

      <View style={styles.footerRow}>
        {complexity ? (
          <View style={styles.complexityChip}>
            <Ionicons name="speedometer-outline" size={13} color={theme.colors.textSecondary} />
            <AppText variant="caption" tone="secondary">
              Kompleksitas {complexity.toLowerCase()}
            </AppText>
          </View>
        ) : null}
        {analysis.createdAt ? (
          <AppText variant="caption" tone="muted">
            {formatDateTime(analysis.createdAt)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.disclaimer}>
        <Ionicons
          name="information-circle-outline"
          size={15}
          color={theme.colors.statusWarningFg}
        />
        <AppText variant="caption" tone="warning" style={styles.flexCopy}>
          {analysis.disclaimer}
        </AppText>
      </View>
    </View>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: IconName;
  title: string;
  children: ReactNode;
}) {
  const { theme } = useAppTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={15} color={theme.colors.textSecondary} />
        <AppText variant="label" tone="secondary">
          {title}
        </AppText>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Bullet({
  icon,
  text,
  color,
}: {
  icon: IconName;
  text: string;
  color: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={13} color={color} style={styles.bulletIcon} />
      <AppText variant="caption" style={styles.flexCopy}>
        {text}
      </AppText>
    </View>
  );
}

function RiskChip({ level }: { level: AiAnalysis['riskLevel'] }) {
  const meta = getRiskMeta(level);
  return <Badge label={meta.shortLabel} tone={meta.tone} icon={meta.icon} size="sm" />;
}

const createStyles = (theme: AppTheme) => ({
  card: {
    borderColor: theme.colors.statusInfoBorder,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.md,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.statusInfoBg,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  loading: {
    gap: theme.spacing.sm,
  },
  loadingBlock: {
    marginTop: theme.spacing.sm,
  },
  body: {
    gap: theme.spacing.md,
  },
  summaryBox: {
    backgroundColor: theme.colors.statusInfoBg,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    gap: theme.spacing.xxs,
  },
  section: {
    gap: theme.spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
  },
  sectionBody: {
    gap: theme.spacing.xs,
  },
  issueRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
  },
  issueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.actionPrimaryAltBg,
    marginTop: 7,
  },
  issueCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  issueTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
    flexWrap: 'wrap' as const,
  },
  issueTitle: { flexShrink: 1 },
  bulletRow: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    alignItems: 'flex-start' as const,
  },
  bulletIcon: { marginTop: 3 },
  flexCopy: { flex: 1 },
  footerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: theme.spacing.sm,
  },
  complexityChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.bgSurfaceSubtle,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.radii.pill,
  },
  disclaimer: {
    flexDirection: 'row' as const,
    gap: theme.spacing.xs,
    alignItems: 'flex-start' as const,
    backgroundColor: theme.colors.statusWarningBg,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  notice: {
    flexDirection: 'row' as const,
    gap: theme.spacing.sm,
    alignItems: 'flex-start' as const,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  },
  noticeEmpty: { backgroundColor: theme.colors.bgSurfaceSubtle },
  noticeError: { backgroundColor: theme.colors.statusDangerBg },
  noticeCopy: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  retry: {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start' as const,
  },
});
