import type { SellerFormCapabilities } from '@/lib/seller-forms/capabilities';
import type {
    AdvancedModuleExclusions,
    AdvancedModuleKey,
    PacketMode,
    UtilityCategory,
} from '@/types';
export interface SavedSellerForm {
    id: string;
    name: string;
    slug: string;
    url: string;
    revision: number;
    organizationId: string | null;
    isDefault: boolean;
    isActive: boolean;
    is_active: boolean;
    sellerIntro: string | null;
    defaultBrandProfileId: string | null;
    defaultUtilityCategories: UtilityCategory[];
    defaultPacketMode: PacketMode;
    advancedModules: AdvancedModuleKey[];
    advancedModuleExclusions: AdvancedModuleExclusions;
    collectHoaQuestions: boolean;
    collectElectricMeterNumber: boolean;
}
export interface SellerFormsResponse {
    forms: SavedSellerForm[];
    defaultId: string | null;
    isPaid: boolean;
    workspaceName: string;
    capabilities: SellerFormCapabilities;
    brandProfiles: Array<{ id: string; name: string; isDefault: boolean }>;
}
