export const ONBOARDING_STEPS = [
  { key: 'workspace', label: 'Workspace', href: '/onboarding/workspace', skippable: false },
  { key: 'source', label: 'Revenue source', href: '/onboarding/source', skippable: true },
  { key: 'partner', label: 'First partner', href: '/onboarding/partner', skippable: true },
  { key: 'agreement', label: 'First agreement', href: '/onboarding/agreement', skippable: true },
  { key: 'wallet', label: 'Wallet status', href: '/onboarding/wallet', skippable: true },
  { key: 'import', label: 'First import', href: '/onboarding/import', skippable: true },
] as const;

export type StepKey = (typeof ONBOARDING_STEPS)[number]['key'];

export function neighbours(key: StepKey) {
  const i = ONBOARDING_STEPS.findIndex((s) => s.key === key);
  return { prev: i > 0 ? ONBOARDING_STEPS[i - 1]!.href : '/onboarding', next: i < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[i + 1]!.href : '/onboarding/ready' };
}
