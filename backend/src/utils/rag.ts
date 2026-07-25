export type RagStatus = 'red' | 'amber' | 'green';
export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_is_exact';

export interface KpiRagParams {
  actualValue: number;
  targetValue?: number | null;
  greenThreshold?: number | null;
  amberThreshold?: number | null;
  direction: KpiDirection;
}

export function computeRagStatus(params: KpiRagParams): RagStatus {
  const { actualValue, greenThreshold, amberThreshold, direction } = params;

  if (greenThreshold == null || amberThreshold == null) {
    return 'green';
  }

  if (direction === 'higher_is_better') {
    if (actualValue >= greenThreshold) return 'green';
    if (actualValue >= amberThreshold) return 'amber';
    return 'red';
  }

  if (direction === 'lower_is_better') {
    if (actualValue <= greenThreshold) return 'green';
    if (actualValue <= amberThreshold) return 'amber';
    return 'red';
  }

  if (direction === 'target_is_exact') {
    const diff = Math.abs(actualValue - (greenThreshold ?? 0));
    const amberDiff = Math.abs((amberThreshold ?? 0) - (greenThreshold ?? 0));
    if (diff <= amberDiff / 2) return 'green';
    if (diff <= amberDiff) return 'amber';
    return 'red';
  }

  return 'green';
}
