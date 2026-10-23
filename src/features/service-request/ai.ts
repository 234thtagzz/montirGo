// Analisis AI untuk service request.
// Pemanggilan AI tetap lewat Edge Function `analyze-request` (PRD §11):
// API key tidak pernah ada di aplikasi, dan penyimpanan hasil dilakukan server-side.
import { supabase } from '@/lib/supabase';
import { describeFunctionError } from '@/lib/edge-functions';
import { Brand } from '@/constants/brand';
import type { IconName } from '@/components/ui/icon';

export type AiRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AiComplexity = 'ringan' | 'sedang' | 'berat';

export interface AiPossibleIssue {
  title: string;
  likelihood: string | null;
  note: string | null;
}

export interface AiAnalysis {
  id: string | null;
  possibleIssues: AiPossibleIssue[];
  symptomsSummary: string | null;
  riskLevel: AiRiskLevel;
  recommendedChecks: string[];
  suggestedTools: string[];
  estimatedComplexity: AiComplexity | null;
  questionsForClient: string[];
  disclaimer: string;
  createdAt: string | null;
}

export const DEFAULT_AI_DISCLAIMER =
  'Hasil AI adalah indikasi awal dan memerlukan pemeriksaan langsung oleh montir.';

export interface AiRiskMeta {
  label: string;
  shortLabel: string;
  color: string;
  background: string;
  icon: IconName;
}

const RISK_META: Record<AiRiskLevel, AiRiskMeta> = {
  low: {
    label: 'Risiko rendah',
    shortLabel: 'Rendah',
    color: Brand.green,
    background: Brand.greenSoft,
    icon: 'shield-checkmark-outline',
  },
  medium: {
    label: 'Risiko sedang',
    shortLabel: 'Sedang',
    color: Brand.amber,
    background: Brand.amberSoft,
    icon: 'alert-circle-outline',
  },
  high: {
    label: 'Risiko tinggi',
    shortLabel: 'Tinggi',
    color: Brand.red,
    background: Brand.redSoft,
    icon: 'warning-outline',
  },
  critical: {
    label: 'Risiko kritis',
    shortLabel: 'Kritis',
    color: Brand.red,
    background: Brand.redSoft,
    icon: 'flame-outline',
  },
};

export function getRiskMeta(level: string | null | undefined): AiRiskMeta {
  return RISK_META[level as AiRiskLevel] ?? RISK_META.medium;
}

export function getComplexityLabel(value: AiComplexity | null): string | null {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export interface RawAiAnalysis {
  id?: string | null;
  possible_issues?: unknown;
  symptoms_summary?: unknown;
  risk_level?: unknown;
  recommended_checks?: unknown;
  suggested_tools?: unknown;
  estimated_complexity?: unknown;
  questions_for_client?: unknown;
  disclaimer?: unknown;
  created_at?: string | null;
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asStringArray(value: unknown, limit = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asText(item))
    .filter((item): item is string => item !== null)
    .slice(0, limit);
}

function normalizeRisk(value: unknown): AiRiskLevel {
  const text = asText(value)?.toLowerCase() ?? '';
  if (text.includes('critical') || text.includes('kritis')) return 'critical';
  if (text.includes('high') || text.includes('tinggi')) return 'high';
  if (text.includes('low') || text.includes('rendah')) return 'low';
  return 'medium';
}

function normalizeComplexity(value: unknown): AiComplexity | null {
  const text = asText(value)?.toLowerCase() ?? '';
  if (text.includes('berat')) return 'berat';
  if (text.includes('ringan')) return 'ringan';
  if (text.includes('sedang')) return 'sedang';
  return null;
}

function normalizeIssues(value: unknown): AiPossibleIssue[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AiPossibleIssue | null => {
      if (typeof item === 'string') {
        return { title: item.trim(), likelihood: null, note: null };
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const title =
          asText(record.title) ?? asText(record.issue) ?? asText(record.name) ?? asText(record.summary);
        if (!title) return null;
        return {
          title,
          likelihood: asText(record.likelihood)?.toLowerCase() ?? null,
          note: asText(record.note) ?? asText(record.description) ?? null,
        };
      }
      return null;
    })
    .filter((item): item is AiPossibleIssue => item !== null)
    .slice(0, 4);
}

/** Normalisasi baris ai_diagnoses / JSONB dari view menjadi bentuk UI. */
export function mapAiAnalysis(raw: RawAiAnalysis | null | undefined): AiAnalysis | null {
  if (!raw) return null;
  return {
    id: raw.id ?? null,
    possibleIssues: normalizeIssues(raw.possible_issues),
    symptomsSummary: asText(raw.symptoms_summary),
    riskLevel: normalizeRisk(raw.risk_level),
    recommendedChecks: asStringArray(raw.recommended_checks),
    suggestedTools: asStringArray(raw.suggested_tools),
    estimatedComplexity: normalizeComplexity(raw.estimated_complexity),
    questionsForClient: asStringArray(raw.questions_for_client, 4),
    disclaimer: asText(raw.disclaimer) ?? DEFAULT_AI_DISCLAIMER,
    createdAt: raw.created_at ?? null,
  };
}

const ANALYSIS_COLUMNS =
  'id, possible_issues, symptoms_summary, risk_level, recommended_checks, ' +
  'suggested_tools, estimated_complexity, questions_for_client, disclaimer, created_at';

export async function getRequestAnalysis(requestId: string): Promise<AiAnalysis | null> {
  const { data, error } = await supabase
    .from('ai_diagnoses')
    .select(ANALYSIS_COLUMNS)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return mapAiAnalysis(data as unknown as RawAiAnalysis | null);
}

/**
 * Minta Edge Function menganalisis request lalu menyimpan hasilnya.
 * Dipanggil setelah request dibuat (dan bisa diulang dari detail pesanan).
 */
export async function analyzeRequest(requestId: string): Promise<AiAnalysis> {
  const { data, error } = await supabase.functions.invoke('analyze-request', {
    body: { requestId },
  });

  if (error) {
    throw await describeFunctionError(error, 'analyze-request', 'Analisis AI tidak tersedia.');
  }

  const analysis = mapAiAnalysis((data as { analysis?: RawAiAnalysis } | null)?.analysis);
  if (!analysis) throw new Error('Hasil analisis AI kosong. Coba lagi.');
  return analysis;
}
