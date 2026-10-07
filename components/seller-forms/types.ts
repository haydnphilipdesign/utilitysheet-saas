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
    /** Canonical share link: the bare base for the default form, base plus ending otherwise. */
    url: string;
    /** This form's own permanent link (base plus ending), default or not. */
    endingUrl: string | null;
    linkSuffix: string | null;
    revision: number;
    organizationId: string | null;
    isDefault: boolean;
    isActive: boolean;
    is_active: boolean;
    sellerHeading: string | null;
    sellerIntro: string | null;
    defaultBrandProfileId: string | null;
    defaultUtilityCategories: UtilityCategory[];
    defaultPacketMode: PacketMode;
    advancedModules: AdvancedModuleKey[];
    advancedModuleExclusions: AdvancedModuleExclusions;
    collectHoaQuestions: boolean;
    collectElectricMeterNumber: boolean;
    /** Shared with the workspace: every member can use it. */
    shared: boolean;
    /** Created by the person looking at it. */
    isMine: boolean;
    /** The creator, and for a shared form its owner and workspace admins. */
    canEdit: boolean;
    canShare: boolean;
    /** False for a default form, which cannot be deleted. */
    canDelete: boolean;
    /** Who a shared form belongs to now; only set in the workspace list. */
    ownerName: string | null;
}
export interface SellerFormLinkBase {
    slug: string;
    url: string;
    /** Revision of the form that owns the base name; required to rename the base. */
    revision: number;
    /** The default form, which the bare base link opens. */
    formId: string;
    formName: string;
    isActive: boolean;
    /** Every ending ever shared in this workspace stays bound to its form. */
    reservedSuffixes: Array<{ suffix: string; formId: string }>;
}
export interface SellerFormsResponse {
    forms: SavedSellerForm[];
    linkBase: SellerFormLinkBase | null;
    defaultId: string | null;
    isPaid: boolean;
    workspaceName: string;
    capabilities: SellerFormCapabilities;
    brandProfiles: Array<{ id: string; name: string; isDefault: boolean }>;
}
