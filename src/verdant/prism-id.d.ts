export function canonicalJson(value: unknown): string;
export function kappa(value: unknown): Promise<string>;
export function createPrism(options?: {
  deviceClass?: 'browser' | 'native' | 'mobile' | 'embedded' | 'recovery';
  protection?: 'software' | 'platform' | 'secure-element' | 'threshold-shares';
}): Promise<{
  prism: string;
  device: Record<string, unknown>;
  [key: string]: unknown;
}>;
