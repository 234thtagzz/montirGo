import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Button } from '@/components/ui/button';
import { Ionicons, type IconName } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand, Radius, Space } from '@/constants/brand';
import { formatDateTime } from '@/utils/format';
import {
  getComplexityLabel,
  getRiskMeta,
  type AiAnalysis,
} from '@/features/service-request/ai';

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
 * Kartu hasil analisis AI. Dipakai di detail pesanan client dan detail
 * request/order montir supaya indikasi awal selalu tampil konsisten.
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
  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={16} color={Brand.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
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
            color={error ? Brand.red : Brand.textSecondary}
          />
          <View style={styles.noticeCopy}>
            <Text style={[styles.noticeTitle, error && styles.noticeTitleError]}>
              {error ? 'Analisis AI gagal dimuat' : 'Analisis AI belum tersedia'}
            </Text>
            <Text style={styles.noticeText}>
              {error ||
                'Permintaan tetap bisa diproses. Montir akan melakukan pemeriksaan langsung.'}
            </Text>
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
    </View>
  );
}

function AnalysisBody({ analysis }: { analysis: AiAnalysis }) {
  const complexity = getComplexityLabel(analysis.estimatedComplexity);

  return (
    <View>
      {analysis.symptomsSummary ? (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Ringkasan indikasi</Text>
          <Text style={styles.summaryText}>{analysis.symptomsSummary}</Text>
        </View>
      ) : null}

      {analysis.possibleIssues.length > 0 ? (
        <Section icon="help-circle-outline" title="Kemungkinan penyebab">
          {analysis.possibleIssues.map((issue, index) => (
            <View key={`${issue.title}-${index}`} style={styles.issueRow}>
              <View style={styles.issueDot} />
              <View style={styles.issueCopy}>
                <View style={styles.issueTitleRow}>
                  <Text style={styles.issueTitle}>{issue.title}</Text>
                  {issue.likelihood ? (
                    <View style={styles.likelihoodChip}>
                      <Text style={styles.likelihoodText}>{issue.likelihood}</Text>
                    </View>
                  ) : null}
                </View>
                {issue.note ? <Text style={styles.issueNote}>{issue.note}</Text> : null}
              </View>
            </View>
          ))}
        </Section>
      ) : null}

      {analysis.recommendedChecks.length > 0 ? (
        <Section icon="checkmark-done-outline" title="Pemeriksaan awal">
          {analysis.recommendedChecks.map((check, index) => (
            <Bullet key={`${check}-${index}`} icon="checkmark" text={check} color={Brand.primary} />
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
              color={Brand.textMuted}
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
              color={Brand.amber}
            />
          ))}
        </Section>
      ) : null}

      <View style={styles.footerRow}>
        {complexity ? (
          <View style={styles.complexityChip}>
            <Ionicons name="speedometer-outline" size={12} color={Brand.textSecondary} />
            <Text style={styles.complexityText}>Kompleksitas {complexity.toLowerCase()}</Text>
          </View>
        ) : null}
        {analysis.createdAt ? (
          <Text style={styles.time}>{formatDateTime(analysis.createdAt)}</Text>
        ) : null}
      </View>

      <View style={styles.disclaimer}>
        <Ionicons name="information-circle-outline" size={14} color={Brand.amber} />
        <Text style={styles.disclaimerText}>{analysis.disclaimer}</Text>
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={14} color={Brand.textSecondary} />
        <Text style={styles.sectionTitle}>{title}</Text>
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
  return (
    <View style={styles.bulletRow}>
      <Ionicons name={icon} size={12} color={color} style={styles.bulletIcon} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function RiskChip({ level }: { level: AiAnalysis['riskLevel'] }) {
  const meta = getRiskMeta(level);
  return (
    <View style={[styles.riskChip, { backgroundColor: meta.background }]}>
      <Ionicons name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.riskText, { color: meta.color }]}>{meta.shortLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Brand.primaryBorder,
    padding: Space.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: Brand.text },
  subtitle: { fontSize: 11, color: Brand.textSecondary, marginTop: 2 },
  riskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  riskText: { fontSize: 10.5, fontWeight: '700' },
  loading: { marginTop: Space.lg, gap: Space.sm },
  loadingBlock: { marginTop: Space.sm },
  summaryBox: {
    marginTop: Space.lg,
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.md,
    padding: Space.md,
  },
  summaryLabel: { fontSize: 10.5, fontWeight: '700', color: Brand.primary },
  summaryText: { fontSize: 12.5, color: Brand.text, lineHeight: 18, marginTop: 4 },
  section: { marginTop: Space.lg },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: Brand.textSecondary },
  sectionBody: { marginTop: Space.sm, gap: 6 },
  issueRow: { flexDirection: 'row', gap: Space.sm },
  issueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Brand.primary,
    marginTop: 6,
  },
  issueCopy: { flex: 1 },
  issueTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, flexWrap: 'wrap' },
  issueTitle: { fontSize: 12.5, fontWeight: '600', color: Brand.text, flexShrink: 1 },
  likelihoodChip: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    backgroundColor: Brand.divider,
  },
  likelihoodText: { fontSize: 9.5, fontWeight: '700', color: Brand.textSecondary },
  issueNote: { fontSize: 11.5, color: Brand.textSecondary, lineHeight: 16, marginTop: 2 },
  bulletRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  bulletIcon: { marginTop: 3 },
  bulletText: { flex: 1, fontSize: 12, color: Brand.text, lineHeight: 17 },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.lg,
    gap: Space.sm,
  },
  complexityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Brand.divider,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  complexityText: { fontSize: 10, fontWeight: '600', color: Brand.textSecondary },
  time: { fontSize: 10, color: Brand.textMuted },
  disclaimer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: Brand.amberSoft,
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  disclaimerText: { flex: 1, fontSize: 10.5, color: Brand.amber, lineHeight: 15 },
  notice: {
    flexDirection: 'row',
    gap: Space.sm,
    alignItems: 'flex-start',
    borderRadius: Radius.md,
    padding: Space.md,
    marginTop: Space.lg,
  },
  noticeEmpty: { backgroundColor: Brand.background },
  noticeError: { backgroundColor: Brand.redSoft },
  noticeCopy: { flex: 1 },
  noticeTitle: { fontSize: 12, fontWeight: '700', color: Brand.textSecondary },
  noticeTitleError: { color: Brand.red },
  noticeText: { fontSize: 11.5, color: Brand.textSecondary, lineHeight: 16, marginTop: 2 },
  retry: { marginTop: Space.sm, alignSelf: 'flex-start' },
});
