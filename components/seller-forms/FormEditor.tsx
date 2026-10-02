'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AdvancedModuleConfigurator } from '@/components/advanced-modules/AdvancedModuleConfigurator';
import { SellerQuestionsDialog } from '@/components/seller-questions/SellerQuestionsDialog';
import dynamic from 'next/dynamic';
const SellerWizard = dynamic(
    () =>
        import('@/components/seller-form/SellerWizard').then(
            (module) => module.SellerWizard,
        ),
    {
        ssr: false,
        loading: () => <p role="status">Loading seller preview...</p>,
    },
);
import { QuestionCollectionSwitches } from './QuestionCollectionSwitches';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    getAdvancedModuleIncludedFieldCount,
    ADVANCED_MODULE_DEFAULTS,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
    PACKET_MODE_LABELS,
} from '@/lib/packet/modules';
import type {
    BrandProfile,
    ProviderSuggestion,
    UtilityCategory,
} from '@/types';
import type { SavedSellerForm, SellerFormsResponse } from './types';
import { toast } from 'sonner';

type Draft = Pick<
    SavedSellerForm,
    | 'name'
    | 'sellerIntro'
    | 'isActive'
    | 'defaultBrandProfileId'
    | 'defaultUtilityCategories'
    | 'defaultPacketMode'
    | 'advancedModules'
    | 'advancedModuleExclusions'
    | 'collectHoaQuestions'
    | 'collectElectricMeterNumber'
> & { slug?: string };
const emptyDraft: Draft = {
    name: '',
    sellerIntro: null,
    isActive: true,
    defaultBrandProfileId: null,
    defaultUtilityCategories: [...UTILITY_CATEGORY_KEYS],
    defaultPacketMode: 'simple',
    advancedModules: [...ADVANCED_MODULE_DEFAULTS],
    advancedModuleExclusions: {},
    collectHoaQuestions: true,
    collectElectricMeterNumber: true,
};
function draftOf(f: SavedSellerForm, duplicate = false): Draft {
    return {
        name: duplicate ? `${f.name.slice(0, 75)} copy` : f.name,
        sellerIntro: f.sellerIntro,
        isActive: duplicate || f.isActive,
        defaultBrandProfileId: f.defaultBrandProfileId,
        defaultUtilityCategories: f.defaultUtilityCategories,
        defaultPacketMode: f.defaultPacketMode,
        advancedModules: normalizeAdvancedModules(f.advancedModules),
        advancedModuleExclusions: f.advancedModuleExclusions,
        collectHoaQuestions: f.collectHoaQuestions,
        collectElectricMeterNumber: f.collectElectricMeterNumber,
        ...(duplicate ? {} : { slug: f.slug }),
    };
}
export function FormEditor({ id }: { id: string }) {
    const router = useRouter();
    const params = useSearchParams();
    const [brands, setBrands] = useState<BrandProfile[]>([]);
    const [data, setData] = useState<SellerFormsResponse | null>(null);
    const [form, setForm] = useState<SavedSellerForm | null>(null);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [baseline, setBaseline] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [preview, setPreview] = useState(params.get('preview') === '1');
    const dirty = baseline !== '' && JSON.stringify(draft) !== baseline;
    useEffect(() => {
        let canceled = false;
        async function load() {
            try {
                const [res, brandResponse] = await Promise.all([
                    fetch('/api/seller-forms'),
                    fetch('/api/branding'),
                ]);
                const body: SellerFormsResponse = await res.json();
                if (!res.ok) throw new Error('Unable to load seller forms');
                const sourceId = id === 'new' ? params.get('duplicate') : id;
                const source = body.forms.find((f) => f.id === sourceId);
                if (sourceId && !source)
                    throw new Error('Form not found in this workspace');
                if (id === 'new' && !body.capabilities.canCreate)
                    throw new Error(
                        body.capabilities.message || 'Additional forms are not available yet.',
                    );
                const next = source
                    ? draftOf(source, id === 'new')
                    : { ...emptyDraft };
                if (!canceled) {
                    if (brandResponse.ok) setBrands(await brandResponse.json());
                    setData(body);
                    setForm(id === 'new' ? null : source || null);
                    setDraft(next);
                    setBaseline(JSON.stringify(next));
                }
            } catch (e) {
                if (!canceled)
                    setError(
                        e instanceof Error ? e.message : 'Unable to load form',
                    );
            }
        }
        void load();
        return () => {
            canceled = true;
        };
    }, [id, params]);
    useEffect(() => {
        function beforeUnload(e: BeforeUnloadEvent) {
            if (dirty) e.preventDefault();
        }
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty]);
    async function save() {
        setBusy(true);
        setError('');
        try {
            const patch = { ...draft };
            if (form?.slug === patch.slug) delete patch.slug;
            // Retain stored paid selections on downgrade; only send actual changes.
            if (!data?.isPaid) {
                delete (patch as Partial<Draft>).advancedModules;
                delete (patch as Partial<Draft>).advancedModuleExclusions;
                if (form && patch.defaultPacketMode === form.defaultPacketMode)
                    delete (patch as Partial<Draft>).defaultPacketMode;
            }
            const res = await fetch(
                form ? `/api/seller-forms/${form.id}` : '/api/seller-forms',
                {
                    method: form ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...patch,
                        ...(form ? { revision: form.revision } : {}),
                    }),
                },
            );
            const result = await res.json();
            if (!res.ok) {
                setConflict(result.code === 'FORM_REVISION_CONFLICT');
                throw new Error(result.error || 'Unable to save form');
            }
            const next: SavedSellerForm = result.form;
            setForm(next);
            const nextDraft = draftOf(next);
            setDraft(nextDraft);
            setBaseline(JSON.stringify(nextDraft));
            setConflict(false);
            toast.success('Seller form saved');
            if (id === 'new') router.replace(`/dashboard/forms/${next.id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save form');
        } finally {
            setBusy(false);
        }
    }
    const invalidAdvanced =
        data?.isPaid &&
        draft.defaultPacketMode === 'advanced' &&
        (!draft.advancedModules.length ||
            draft.advancedModules.some(
                (key) =>
                    getAdvancedModuleIncludedFieldCount(
                        key,
                        draft.advancedModuleExclusions,
                    ) === 0,
            ));
    const selectedBrand =
        brands.find((b) => b.id === draft.defaultBrandProfileId) ||
        brands.find((b) => b.is_default);
    const previewBrand = selectedBrand
        ? {
              name: selectedBrand.name,
              logo_url: selectedBrand.logo_url || undefined,
              primary_color: selectedBrand.primary_color || undefined,
              contact_email: selectedBrand.contact_email || undefined,
              contact_phone: selectedBrand.contact_phone || undefined,
              contact_website: selectedBrand.contact_website || undefined,
          }
        : null;
    const configuration = {
        packetMode: data?.isPaid
            ? draft.defaultPacketMode
            : ('simple' as const),
        utilityCategories: draft.defaultUtilityCategories,
        advancedModules: draft.advancedModules,
        advancedModuleExclusions: draft.advancedModuleExclusions,
        collectHoaQuestions: draft.collectHoaQuestions,
        collectElectricMeterNumber: draft.collectElectricMeterNumber,
    };
    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <Link
                href="/dashboard/forms"
                onClick={(e) => {
                    if (
                        dirty &&
                        !window.confirm('Discard unsaved form changes?')
                    )
                        e.preventDefault();
                }}
                className="text-sm text-primary"
            >
                ← Seller forms
            </Link>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold">
                    {id === 'new' ? 'New form' : 'Edit seller form'}
                </h1>
                <span className="text-sm text-muted-foreground">
                    {dirty ? 'Unsaved changes' : 'Saved'}
                </span>
            </div>
            {error && (
                <div role="alert" className="space-y-2">
                    <p>{error}</p>
                    {conflict && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (
                                    window.confirm(
                                        'Reload and discard this draft?',
                                    )
                                )
                                    window.location.reload();
                            }}
                        >
                            Reload form
                        </Button>
                    )}
                </div>
            )}
            {!data ? (
                <p role="status">
                    {error
                        ? 'Return to Seller forms to retry.'
                        : 'Loading form…'}
                </p>
            ) : (
                <>
                    <Card>
                        <CardContent className="space-y-6 pt-6">
                            <p className="text-sm text-muted-foreground">
                                Submissions go to {data.workspaceName}. This
                                destination stays fixed.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="formName">
                                    Internal form name
                                </Label>
                                <Input
                                    id="formName"
                                    maxLength={80}
                                    value={draft.name}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            name: e.target.value,
                                        })
                                    }
                                    placeholder="For example: Listing information"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Only your workspace sees this name.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="sellerIntro">
                                    Seller introduction (optional)
                                </Label>
                                <textarea
                                    id="sellerIntro"
                                    maxLength={500}
                                    rows={4}
                                    className="w-full rounded-md border border-input bg-background p-3 text-sm"
                                    value={draft.sellerIntro || ''}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            sellerIntro: e.target.value || null,
                                        })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Plain text shown before address entry and on
                                    the seller welcome screen.{' '}
                                    {draft.sellerIntro?.length || 0}/500
                                </p>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <Label htmlFor="formActive">
                                    Accept new starts
                                </Label>
                                <Switch
                                    id="formActive"
                                    checked={draft.isActive}
                                    onCheckedChange={(isActive) =>
                                        setDraft({ ...draft, isActive })
                                    }
                                />
                            </div>
                            {!draft.isActive && (
                                <p className="text-sm text-muted-foreground">
                                    Paused. Existing seller requests stay
                                    available, including if this is your default
                                    form.
                                </p>
                            )}
                            {form && (
                                <div className="space-y-2">
                                    <Label htmlFor="formSlug">
                                        Reusable link
                                    </Label>
                                    <Input
                                        id="formSlug"
                                        value={draft.slug || ''}
                                        disabled={!data.isPaid}
                                        onChange={(e) =>
                                            setDraft({
                                                ...draft,
                                                slug: e.target.value,
                                            })
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Published links continue to work when
                                        you change the link name.
                                    </p>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="formBrand">
                                    Branding Profile
                                </Label>
                                <select
                                    id="formBrand"
                                    className="w-full rounded-md border border-input bg-background p-2"
                                    value={draft.defaultBrandProfileId || ''}
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            defaultBrandProfileId:
                                                e.target.value || null,
                                        })
                                    }
                                >
                                    <option value="">Workspace default</option>
                                    {data.brandProfiles.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <fieldset className="space-y-3">
                                <legend className="text-sm font-medium">
                                    Utilities to ask about
                                </legend>
                                <div className="grid grid-cols-2 gap-3">
                                    {UTILITY_CATEGORY_KEYS.map((category) => (
                                        <Label
                                            key={category}
                                            className="flex items-center gap-2"
                                        >
                                            <Checkbox
                                                checked={draft.defaultUtilityCategories.includes(
                                                    category,
                                                )}
                                                onCheckedChange={(checked) =>
                                                    setDraft({
                                                        ...draft,
                                                        defaultUtilityCategories:
                                                            checked
                                                                ? [
                                                                      ...draft.defaultUtilityCategories,
                                                                      category,
                                                                  ]
                                                                : draft.defaultUtilityCategories.filter(
                                                                      (c) =>
                                                                          c !==
                                                                          category,
                                                                  ),
                                                    })
                                                }
                                            />
                                            {
                                                UTILITY_CATEGORIES.find(
                                                    (c) => c.key === category,
                                                )?.label
                                            }
                                        </Label>
                                    ))}
                                </div>
                            </fieldset>
                            <QuestionCollectionSwitches
                                hoa={draft.collectHoaQuestions}
                                meter={draft.collectElectricMeterNumber}
                                onHoa={(collectHoaQuestions) =>
                                    setDraft({ ...draft, collectHoaQuestions })
                                }
                                onMeter={(collectElectricMeterNumber) =>
                                    setDraft({
                                        ...draft,
                                        collectElectricMeterNumber,
                                    })
                                }
                            />
                            <div className="space-y-2">
                                <Label htmlFor="formMode">Packet mode</Label>
                                <select
                                    id="formMode"
                                    className="w-full rounded-md border border-input bg-background p-2"
                                    value={
                                        data.isPaid
                                            ? draft.defaultPacketMode
                                            : 'simple'
                                    }
                                    onChange={(e) =>
                                        setDraft({
                                            ...draft,
                                            defaultPacketMode:
                                                e.target.value === 'advanced'
                                                    ? 'advanced'
                                                    : 'simple',
                                        })
                                    }
                                >
                                    <option value="simple">
                                        {PACKET_MODE_LABELS.simple}
                                    </option>
                                    <option
                                        value="advanced"
                                        disabled={!data.isPaid}
                                    >
                                        {PACKET_MODE_LABELS.advanced} (Pro /
                                        Teams)
                                    </option>
                                </select>
                            </div>
                            {data.isPaid &&
                                draft.defaultPacketMode === 'advanced' && (
                                    <AdvancedModuleConfigurator
                                        enabledModules={draft.advancedModules}
                                        exclusions={
                                            draft.advancedModuleExclusions
                                        }
                                        onToggleModule={(key) => {
                                            const modules =
                                                draft.advancedModules.includes(
                                                    key,
                                                )
                                                    ? draft.advancedModules.filter(
                                                          (k) => k !== key,
                                                      )
                                                    : [
                                                          ...draft.advancedModules,
                                                          key,
                                                      ];
                                            setDraft({
                                                ...draft,
                                                advancedModules: modules,
                                                advancedModuleExclusions:
                                                    normalizeAdvancedModuleExclusions(
                                                        draft.advancedModuleExclusions,
                                                        modules,
                                                    ),
                                            });
                                        }}
                                        onToggleField={(key, field) => {
                                            const exclusions =
                                                draft.advancedModuleExclusions[
                                                    key
                                                ] || [];
                                            setDraft({
                                                ...draft,
                                                advancedModuleExclusions: {
                                                    ...draft.advancedModuleExclusions,
                                                    [key]: exclusions.includes(
                                                        field,
                                                    )
                                                        ? exclusions.filter(
                                                              (f) =>
                                                                  f !== field,
                                                          )
                                                        : [
                                                              ...exclusions,
                                                              field,
                                                          ],
                                                },
                                            });
                                        }}
                                    />
                                )}
                            <p className="text-sm text-muted-foreground">
                                Saving affects new requests. Started requests
                                keep their captured questions and introduction.
                            </p>
                            {invalidAdvanced && (
                                <p
                                    role="alert"
                                    className="text-sm text-destructive"
                                >
                                    Include at least one handoff section and a
                                    question in each enabled section.
                                </p>
                            )}
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    disabled={
                                        busy ||
                                        conflict ||
                                        !draft.name.trim() ||
                                        !draft.defaultUtilityCategories
                                            .length ||
                                        invalidAdvanced
                                    }
                                    onClick={save}
                                >
                                    {busy ? 'Saving…' : 'Save form'}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setPreview(true)}
                                >
                                    Preview seller form
                                </Button>
                                <SellerQuestionsDialog
                                    configuration={configuration}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Dialog open={preview} onOpenChange={setPreview}>
                        <DialogContent className="h-[90dvh] max-w-4xl overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Seller preview</DialogTitle>
                                <DialogDescription>
                                    Preview your draft with a fictional address.
                                    No request is created and no messages are
                                    sent.
                                </DialogDescription>
                            </DialogHeader>
                            {preview && (
                                <SellerWizard
                                    brandProfile={previewBrand}
                                    key={JSON.stringify(draft)}
                                    isDemo
                                    token="saved-form-preview"
                                    initialSuggestions={
                                        {} as Record<
                                            UtilityCategory,
                                            ProviderSuggestion[]
                                        >
                                    }
                                    initialRequestData={{
                                        property_address:
                                            '123 Example Street, Austin, TX 78701',
                                        seller_intro: draft.sellerIntro,
                                        utility_categories:
                                            draft.defaultUtilityCategories,
                                        packet_mode: configuration.packetMode,
                                        advanced_modules: draft.advancedModules,
                                        advanced_module_exclusions:
                                            draft.advancedModuleExclusions,
                                        collect_hoa_questions:
                                            draft.collectHoaQuestions,
                                        collect_electric_meter_number:
                                            draft.collectElectricMeterNumber,
                                    }}
                                />
                            )}
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </div>
    );
}
