import type { AdvancedModuleKey, PacketMode } from '@/types';

export const PACKET_MODES: PacketMode[] = ['simple', 'advanced'];

export const ADVANCED_MODULE_KEYS: AdvancedModuleKey[] = [
    'lawn_exterior',
    'irrigation_seasonal_controls',
    'mailbox_access',
    'smart_home_security',
    'service_providers',
];

export const ADVANCED_MODULE_LABELS: Record<AdvancedModuleKey, string> = {
    lawn_exterior: 'Lawn & Exterior',
    irrigation_seasonal_controls: 'Irrigation & Seasonal Controls',
    mailbox_access: 'Mailbox & Access',
    smart_home_security: 'Smart Home & Security',
    service_providers: 'Service Providers',
};

export const ADVANCED_MODULE_DEFAULTS: AdvancedModuleKey[] = [...ADVANCED_MODULE_KEYS];

export function normalizeAdvancedModules(input?: string[] | null): AdvancedModuleKey[] {
    if (!Array.isArray(input) || input.length === 0) return [...ADVANCED_MODULE_DEFAULTS];
    const unique = new Set<AdvancedModuleKey>();
    for (const candidate of input) {
        if ((ADVANCED_MODULE_KEYS as string[]).includes(candidate)) {
            unique.add(candidate as AdvancedModuleKey);
        }
    }
    return unique.size > 0 ? Array.from(unique) : [...ADVANCED_MODULE_DEFAULTS];
}

