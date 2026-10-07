'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, Pause, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { AdvancedModuleConfigurator } from '@/components/advanced-modules/AdvancedModuleConfigurator';
import { SellerQuestionsDialog } from '@/components/seller-questions/SellerQuestionsDialog';
import { IntakeIntro } from '@/components/intake/IntakeIntro';
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
import { PauseFormDialog, resumeForm } from './FormAvailability';
import { DeleteFormDialog, ShareFormDialog, formLinkPrefix } from './FormSharing';
import { UTILITY_CATEGORIES, UTILITY_CATEGORY_KEYS } from '@/lib/constants';
import {
    getAdvancedModuleIncludedFieldCount,
    ADVANCED_MODULE_DEFAULTS,
    normalizeAdvancedModuleExclusions,
    normalizeAdvancedModules,
    PACKET_MODE_LABELS,
} from '@/lib/packet/modules';
import { cn } from '@/lib/utils';
import type {
    BrandProfile,
    PacketMode,
    ProviderSuggestion,
    UtilityCategory,
} from '@/types';
import type { SavedSellerForm, SellerFormsResponse } from './types';
import { linkSuffixError, suggestLinkSuffix } from '@/lib/seller-forms/links';
import { buildBrandAccentStyle } from '@/lib/branding/deliverable';
import {
    SELLER_HEADING_MAX,
    SELLER_INTRO_MAX,
    customSellerText,
    defaultSellerHeading,
    defaultSellerIntro,
} from '@/lib/seller-forms/intro-copy';

// Pausing is saved on its own, right away, so it is not part of the draft.
// A null heading or introduction means the standard wording, which the fields show.
type Draft = Pick<
    SavedSellerForm,
    | 'name'
    | 'sellerHeading'
    | 'sellerIntro'
    | 'defaultBrandProfileId'
    | 'defaultUtilityCategories'
    | 'defaultPacketMode'
    | 'advancedModules'
    | 'advancedModuleExclusions'
    | 'collectHoaQuestions'
    | 'collectElectricMeterNumber'
> & { suffix?: string };
const emptyDraft: Draft = {
    name: '',
    sellerHeading: null,
    sellerIntro: null,
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
        sellerHeading: f.sellerHeading ?? null,
        sellerIntro: f.sellerIntro ?? null,
        defaultBrandProfileId: f.defaultBrandProfileId,
        defaultUtilityCategories: f.defaultUtilityCategories,
        defaultPacketMode: f.defaultPacketMode,
        advancedModules: normalizeAdvancedModules(f.advancedModules),
        advancedModuleExclusions: f.advancedModuleExclusions,
        collectHoaQuestions: f.collectHoaQuestions,
        collectElectricMeterNumber: f.collectElectricMeterNumber,
        ...(duplicate ? {} : f.linkSuffix ? { suffix: f.linkSuffix } : {}),
    };
}
const PACKET_MODE_SUMMARIES: Record<PacketMode, string> = {
    simple: 'Utility providers and account details only.',
    advanced: 'Also collects home systems, access details and service providers.',
};
const selectClass =
    'h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30 sm:h-8 sm:px-2 sm:text-sm';

function Section({ title, description, children }: {
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">{children}</CardContent>
        </Card>
    );
}

export function FormEditor({ id }: { id: string }) {
    const router = useRouter();
    const params = useSearchParams();
    const [brands, setBrands] = useState<BrandProfile[]>([]);
    const [data, setData] = useState<SellerFormsResponse | null>(null);
    const [form, setForm] = useState<SavedSellerForm | null>(null);
    const [draft, setDraft] = useState<Draft>(emptyDraft);
    const [baseline, setBaseline] = useState('');
    const [loadError, setLoadError] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [preview, setPreview] = useState(params.get('preview') === '1');
    const [suffixEdited, setSuffixEdited] = useState(false);
    const [confirming, setConfirming] = useState<'leave' | 'reload' | null>(null);
    const [pausing, setPausing] = useState(false);
    const [resuming, setResuming] = useState(false);
    const [shareTarget, setShareTarget] = useState<{ form: SavedSellerForm; shared: boolean } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [justSaved, setJustSaved] = useState(false);
    const leaving = useRef(false);
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
                if (id === 'new' && body.linkBase)
                    next.suffix = suggestLinkSuffix(next.name, body.linkBase.reservedSuffixes.map(a => a.suffix));
                if (!canceled) {
                    if (brandResponse.ok) setBrands(await brandResponse.json());
                    setData(body);
                    setForm(id === 'new' ? null : source || null);
                    setDraft(next);
                    setBaseline(JSON.stringify(next));
                }
            } catch (e) {
                if (!canceled)
                    setLoadError(
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
            if (dirty && !leaving.current) e.preventDefault();
        }
        window.addEventListener('beforeunload', beforeUnload);
        return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [dirty]);
    async function save() {
        setBusy(true);
        setError('');
        try {
            const patch = {
                ...draft,
                sellerHeading: customSellerText(draft.sellerHeading, defaultHeading),
                sellerIntro: customSellerText(draft.sellerIntro, defaultIntro),
            };
            if (form?.linkSuffix === patch.suffix) delete patch.suffix;
            if (patch.suffix !== undefined) {
                const invalid = linkSuffixError(patch.suffix);
                if (invalid) throw new Error(invalid);
            }
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
                        // A new form starts out accepting sellers.
                        ...(form ? { revision: form.revision } : { isActive: true }),
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
            // Shown in the save bar: a toast would cover the bar on a phone.
            setJustSaved(true);
            if (id === 'new') router.replace(`/dashboard/forms/${next.id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to save form');
        } finally {
            setBusy(false);
        }
    }
    async function resume() {
        if (!form) return;
        setResuming(true);
        const next = await resumeForm(form, true);
        // Adopt the new revision so the open draft still saves cleanly.
        if (next) setForm(next);
        setResuming(false);
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
    const noUtilities = !draft.defaultUtilityCategories.length;
    // Why Save is unavailable, in the order the form presents the fields.
    const readOnly = form !== null && !form.canEdit;
    const blocker = readOnly
        ? 'Only the person this form belongs to and workspace admins can change it.'
        : !draft.name.trim()
        ? 'Add a form name to save.'
        : noUtilities
          ? 'Choose at least one utility to save.'
          : invalidAdvanced
            ? 'Fix the handoff sections to save.'
            : '';
    const selectedBrand =
        brands.find((b) => b.id === draft.defaultBrandProfileId) ||
        brands.find((b) => b.is_default);
    const defaultHeading = defaultSellerHeading(selectedBrand?.name);
    const defaultIntro = defaultSellerIntro(selectedBrand?.name);
    const headingValue = draft.sellerHeading ?? defaultHeading;
    const introValue = draft.sellerIntro ?? defaultIntro;
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
    const packetMode: PacketMode = data?.isPaid ? draft.defaultPacketMode : 'simple';
    const configuration = {
        packetMode,
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
                    if (dirty) {
                        e.preventDefault();
                        setConfirming('leave');
                    }
                }}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Seller forms
            </Link>
            <PageHeader
                title={id === 'new' ? 'New seller form' : 'Edit seller form'}
                description="Changes apply to new requests. Sellers who already started keep the questions and introduction they were given."
            />
            {!data ? (
                loadError ? (
                    <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                        <p className="text-destructive">{loadError}</p>
                        <p className="text-muted-foreground">Return to Seller forms to retry.</p>
                    </div>
                ) : (
                    <p role="status" className="text-sm text-muted-foreground">Loading form…</p>
                )
            ) : (
                <>
                    {readOnly && (
                        <p role="note" className="rounded-lg border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                            {form?.ownerName || 'A teammate'} shared this form with {data.workspaceName}. You can preview it,
                            copy its link and create requests from it. Only {form?.ownerName || 'its creator'} and
                            workspace admins can change it.
                        </p>
                    )}
                    <Section title="Basics" description="What this form is called and how it greets sellers.">
                        <div className="space-y-2">
                            <Label htmlFor="formName">Form name</Label>
                            <Input
                                id="formName"
                                maxLength={80}
                                value={draft.name}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        name: e.target.value,
                                        ...(id === 'new' && data.linkBase && !suffixEdited
                                            ? { suffix: suggestLinkSuffix(e.target.value, data.linkBase.reservedSuffixes.map(a => a.suffix)) }
                                            : {}),
                                    })
                                }
                                placeholder="For example: Listing information"
                            />
                            <p className="text-xs text-muted-foreground">
                                Only your workspace sees this name. Sellers never do.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sellerHeading">Seller heading</Label>
                            <Input
                                id="sellerHeading"
                                maxLength={SELLER_HEADING_MAX}
                                value={headingValue}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        sellerHeading: e.target.value === defaultHeading ? null : e.target.value,
                                    })
                                }
                                placeholder={defaultHeading}
                            />
                            <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                                <p>
                                    The first line sellers read when they open your link.
                                    {draft.sellerHeading !== null && (
                                        <>
                                            {' '}
                                            <button
                                                type="button"
                                                className="text-primary underline"
                                                onClick={() => setDraft({ ...draft, sellerHeading: null })}
                                            >
                                                Use the standard heading
                                            </button>
                                        </>
                                    )}
                                </p>
                                <p className="shrink-0 tabular-nums">{headingValue.length}/{SELLER_HEADING_MAX}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sellerIntro">Seller introduction</Label>
                            <Textarea
                                id="sellerIntro"
                                maxLength={SELLER_INTRO_MAX}
                                rows={4}
                                value={introValue}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        sellerIntro: e.target.value === defaultIntro ? null : e.target.value,
                                    })
                                }
                                placeholder={defaultIntro}
                            />
                            <div className="flex justify-between gap-4 text-xs text-muted-foreground">
                                <p>
                                    A short note under the heading. It also greets
                                    sellers on requests you create yourself.
                                    {draft.sellerIntro !== null && (
                                        <>
                                            {' '}
                                            <button
                                                type="button"
                                                className="text-primary underline"
                                                onClick={() => setDraft({ ...draft, sellerIntro: null })}
                                            >
                                                Use the standard introduction
                                            </button>
                                        </>
                                    )}
                                </p>
                                <p className="shrink-0 tabular-nums">{introValue.length}/{SELLER_INTRO_MAX}</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">What sellers see first</p>
                            <div
                                data-testid="seller-intro-preview"
                                className="rounded-2xl border border-border bg-card/50 p-4 sm:p-6"
                                style={buildBrandAccentStyle(selectedBrand?.primary_color) as CSSProperties}
                            >
                                <IntakeIntro
                                    headingAs="p"
                                    brandName={selectedBrand?.name}
                                    heading={draft.sellerHeading}
                                    intro={draft.sellerIntro}
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This sits above the property address field. The
                                name comes from the form&apos;s Branding Profile.
                            </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Submissions go to {data.workspaceName}. This
                            destination stays fixed.
                        </p>
                    </Section>

                    <Section title="What sellers are asked" description="Choose the topics this form covers. Sellers only see questions that apply to their home.">
                        <fieldset className="space-y-3">
                            <legend className="text-sm font-medium">
                                Utilities to ask about
                            </legend>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                {UTILITY_CATEGORY_KEYS.map((category) => {
                                    const checked = draft.defaultUtilityCategories.includes(category);
                                    return (
                                        <Label
                                            key={category}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 transition-colors',
                                                checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-input',
                                            )}
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(next) =>
                                                    setDraft({
                                                        ...draft,
                                                        defaultUtilityCategories: next
                                                            ? [...draft.defaultUtilityCategories, category]
                                                            : draft.defaultUtilityCategories.filter((c) => c !== category),
                                                    })
                                                }
                                            />
                                            {UTILITY_CATEGORIES.find((c) => c.key === category)?.label}
                                        </Label>
                                    );
                                })}
                            </div>
                            {noUtilities && (
                                <p role="alert" className="text-sm text-destructive">
                                    Choose at least one utility.
                                </p>
                            )}
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
                        <fieldset className="space-y-3">
                            <legend className="text-sm font-medium">Sheet type</legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {(['simple', 'advanced'] as const).map((mode) => {
                                    const locked = mode === 'advanced' && !data.isPaid;
                                    const selected = packetMode === mode;
                                    return (
                                        <label
                                            key={mode}
                                            className={cn(
                                                'flex items-start gap-3 rounded-md border p-3 transition-colors has-[:focus-visible]:ring-[2px] has-[:focus-visible]:ring-ring/30',
                                                selected ? 'border-primary/40 bg-primary/5' : 'border-border',
                                                locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-input',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="formMode"
                                                className="mt-1 accent-primary"
                                                checked={selected}
                                                disabled={locked}
                                                onChange={() => setDraft({ ...draft, defaultPacketMode: mode })}
                                            />
                                            <span className="min-w-0 space-y-1">
                                                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                                                    {PACKET_MODE_LABELS[mode]}
                                                    {locked && <Badge variant="secondary">Pro or Teams</Badge>}
                                                </span>
                                                <span className="block text-xs leading-relaxed text-muted-foreground">
                                                    {PACKET_MODE_SUMMARIES[mode]}
                                                </span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {!data.isPaid && (
                                <p className="text-xs text-muted-foreground">
                                    {PACKET_MODE_LABELS.advanced} is part of{' '}
                                    <Link href="/dashboard/settings?tab=billing" className="text-primary underline">Pro and Teams</Link>.
                                </p>
                            )}
                        </fieldset>
                        {data.isPaid && draft.defaultPacketMode === 'advanced' && (
                            <div className="space-y-3">
                                <div>
                                    <h3 className="text-sm font-medium">Handoff sections</h3>
                                    <p className="text-xs text-muted-foreground">
                                        Turn sections on or off. Open a section to choose its questions.
                                    </p>
                                </div>
                                <AdvancedModuleConfigurator
                                    enabledModules={draft.advancedModules}
                                    exclusions={draft.advancedModuleExclusions}
                                    onToggleModule={(key) => {
                                        const modules = draft.advancedModules.includes(key)
                                            ? draft.advancedModules.filter((k) => k !== key)
                                            : [...draft.advancedModules, key];
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
                                        const exclusions = draft.advancedModuleExclusions[key] || [];
                                        setDraft({
                                            ...draft,
                                            advancedModuleExclusions: {
                                                ...draft.advancedModuleExclusions,
                                                [key]: exclusions.includes(field)
                                                    ? exclusions.filter((f) => f !== field)
                                                    : [...exclusions, field],
                                            },
                                        });
                                    }}
                                />
                                {invalidAdvanced && (
                                    <p role="alert" className="text-sm text-destructive">
                                        Include at least one handoff section and a
                                        question in each enabled section.
                                    </p>
                                )}
                            </div>
                        )}
                        <SellerQuestionsDialog
                            configuration={configuration}
                            triggerLabel="See every question on this form"
                        />
                    </Section>

                    <Section title="Branding" description="The logo, color and contact details sellers see on this form.">
                        <div className="space-y-2">
                            <Label htmlFor="formBrand">Branding Profile</Label>
                            <select
                                id="formBrand"
                                className={selectClass}
                                value={draft.defaultBrandProfileId || ''}
                                onChange={(e) =>
                                    setDraft({
                                        ...draft,
                                        defaultBrandProfileId: e.target.value || null,
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
                            <p className="text-xs text-muted-foreground">
                                {selectedBrand && (
                                    <>
                                        {/* New tab: this page may hold unsaved changes. */}
                                        <Link
                                            href={`/dashboard/branding/${selectedBrand.id}`}
                                            target="_blank"
                                            rel="noopener"
                                            className="text-primary underline"
                                        >
                                            Edit {selectedBrand.name}
                                        </Link>
                                        {' (opens in a new tab), or create '}
                                    </>
                                )}
                                {selectedBrand ? 'and manage' : 'Create or change'} profiles in{' '}
                                <Link href="/dashboard/branding" className="text-primary underline">Branding</Link>.
                            </p>
                        </div>
                    </Section>

                    {(data.linkBase || form) && (
                        <Section
                            title={form ? 'Link and availability' : 'Link'}
                            description={form
                                ? 'Where sellers open this form, and whether new sellers can start it.'
                                : 'Where sellers open this form.'}
                        >
                            {data.linkBase && (
                                <div className="space-y-2">
                                    <Label htmlFor="formSuffix">Link ending</Label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="break-all text-sm text-muted-foreground">{form ? formLinkPrefix(form, data.linkBase.url) : data.linkBase.url}/</span>
                                        <Input
                                            id="formSuffix"
                                            className="min-w-32 flex-1"
                                            value={draft.suffix || ''}
                                            disabled={!data.isPaid || readOnly}
                                            maxLength={60}
                                            aria-describedby="formSuffixHelp"
                                            onChange={(e) => {
                                                setSuffixEdited(true);
                                                setDraft({ ...draft, suffix: e.target.value });
                                            }}
                                            placeholder="For example: closing"
                                        />
                                    </div>
                                    <p id="formSuffixHelp" className="text-xs text-muted-foreground">
                                        {form?.isDefault
                                            ? 'This is your default form, so it also opens from your main link. '
                                            : ''}
                                        Use lowercase letters, numbers and dashes.
                                        Links you have already shared keep working.
                                    </p>
                                    {!data.isPaid && (
                                        <p className="text-xs text-muted-foreground">
                                            Customize links on{' '}
                                            <Link href="/dashboard/settings?tab=billing" className="text-primary underline">Pro or Teams</Link>.
                                            {' '}Your existing links keep working.
                                        </p>
                                    )}
                                </div>
                            )}
                            {form && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="flex items-center gap-2 text-sm font-medium">
                                            {form.isActive ? 'Accepting new sellers' : (
                                                <Badge variant="outline" className="border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400">
                                                    Paused
                                                </Badge>
                                            )}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {form.isActive
                                                ? 'Pause this form to stop new sellers from starting it. You can resume at any time.'
                                                : `New sellers cannot start this form. Sellers who already started can still finish.${form.isDefault ? ' Your main link is unavailable to new sellers while this form is paused.' : ''}`}
                                        </p>
                                    </div>
                                    {readOnly ? null : form.isActive ? (
                                        <Button variant="outline" onClick={() => setPausing(true)}>
                                            <Pause />
                                            Pause form
                                        </Button>
                                    ) : (
                                        <Button disabled={resuming} onClick={resume}>
                                            <Play />
                                            {resuming ? 'Resuming…' : 'Resume form'}
                                        </Button>
                                    )}
                                </div>
                            )}
                            {form && form.organizationId && (form.shared || form.canShare) && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-medium">
                                            {form.shared ? `Shared with ${data.workspaceName}` : 'Only you can use this form'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {form.shared
                                                ? 'Everyone in the workspace can copy its link and create requests from it. Only the person it belongs to and workspace admins can change it.'
                                                : data.capabilities.sharing.available
                                                  ? 'Share it so everyone in the workspace can copy its link and create requests from it. Its link stays the same.'
                                                  : 'Sharing a form with your team is part of the Teams plan.'}
                                        </p>
                                    </div>
                                    {form.shared ? (
                                        form.canEdit && (
                                            <Button variant="outline" disabled={dirty} onClick={() => setShareTarget({ form, shared: false })}>
                                                Stop sharing
                                            </Button>
                                        )
                                    ) : data.capabilities.sharing.available ? (
                                        <Button variant="outline" disabled={dirty} onClick={() => setShareTarget({ form, shared: true })}>
                                            Share with workspace
                                        </Button>
                                    ) : (
                                        <Link href="/dashboard/settings?tab=billing" className="text-sm text-primary underline">
                                            See Teams
                                        </Link>
                                    )}
                                </div>
                            )}
                            {form && form.canEdit && (
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3">
                                    <div className="min-w-0 space-y-1">
                                        <p className="text-sm font-medium">Delete this form</p>
                                        <p className="text-xs text-muted-foreground">
                                            {form.canDelete
                                                ? 'Its link stops working for new sellers and the form is removed. Requests already created from it are kept. This cannot be undone. Afterwards you can give its link ending to another form.'
                                                : form.isMine
                                                  ? 'This is your default form. Make another form the default first, then you can delete this one.'
                                                  : 'This is its creator’s default form, so it cannot be deleted.'}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="text-destructive hover:text-destructive"
                                        disabled={!form.canDelete}
                                        onClick={() => setDeleting(true)}
                                    >
                                        Delete form
                                    </Button>
                                </div>
                            )}
                        </Section>
                    )}

                    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/95 p-3 shadow-md backdrop-blur">
                        <div className="min-w-0 flex-1 basis-48 text-sm">
                            {error ? (
                                <p role="alert" className="text-destructive">{error}</p>
                            ) : (
                                <p role="status" className="flex items-center gap-1.5 text-muted-foreground">
                                    {blocker || (dirty ? 'Unsaved changes' : justSaved ? (
                                        <>
                                            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                            Seller form saved
                                        </>
                                    ) : form ? 'All changes saved' : 'Not saved yet')}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {conflict && (
                                <Button variant="outline" onClick={() => setConfirming('reload')}>
                                    Reload form
                                </Button>
                            )}
                            <Button variant="outline" onClick={() => setPreview(true)}>
                                <Eye />
                                Preview seller form
                            </Button>
                            <Button disabled={busy || conflict || blocker !== ''} onClick={save}>
                                {busy ? 'Saving…' : 'Save form'}
                            </Button>
                        </div>
                    </div>

                    <Dialog open={preview} onOpenChange={setPreview}>
                        <DialogContent className="h-[90dvh] sm:max-w-4xl overflow-y-auto">
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
                                        seller_intro: customSellerText(draft.sellerIntro, defaultIntro),
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
                    <ShareFormDialog
                        target={shareTarget}
                        workspaceName={data.workspaceName}
                        onClose={() => setShareTarget(null)}
                        // Adopt the new revision so the open draft still saves cleanly.
                        onSaved={setForm}
                    />
                    <DeleteFormDialog
                        form={deleting ? form : null}
                        onClose={() => setDeleting(false)}
                        onDeleted={() => {
                            leaving.current = true;
                            router.push('/dashboard/forms');
                        }}
                    />
                    <PauseFormDialog
                        form={pausing ? form : null}
                        onClose={() => setPausing(false)}
                        // Adopt the new revision so the open draft still saves cleanly.
                        onPaused={setForm}
                        quiet
                    />
                </>
            )}
            <ConfirmDialog
                open={confirming !== null}
                onOpenChange={(open) => { if (!open) setConfirming(null); }}
                title={confirming === 'reload' ? 'Reload this form?' : 'Leave without saving?'}
                description={confirming === 'reload'
                    ? 'This form was changed somewhere else. Reloading shows the latest version and discards the changes you have not saved.'
                    : 'The changes you have not saved will be lost.'}
                confirmLabel={confirming === 'reload' ? 'Reload and discard' : 'Leave without saving'}
                cancelLabel="Keep editing"
                destructive
                onConfirm={() => {
                    leaving.current = true;
                    if (confirming === 'reload') window.location.reload();
                    else router.push('/dashboard/forms');
                }}
            />
        </div>
    );
}
