'use client';

import { useId, useMemo, useState } from 'react';
import { ListChecks, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PACKET_MODE_LABELS } from '@/lib/packet/modules';
import {
    countSellerQuestions,
    getIncludedSellerQuestionKeys,
    getSellerQuestionInventory,
    getSellerQuestionPreview,
    searchSellerQuestionSections,
    type SellerQuestionConfiguration,
    type SellerQuestionSection,
} from '@/lib/packet/seller-questions';

interface SellerQuestionsDialogProps {
    configuration: SellerQuestionConfiguration;
    /** Optional label for the trigger button. */
    triggerLabel?: string;
    className?: string;
}

const GROUP_LABELS: Record<SellerQuestionSection['group'], string> = {
    home_basics: 'Home basics',
    utilities: 'Utilities',
    handoff: 'Property handoff',
};

function SectionList({
    sections,
    includedKeys,
    emptyMessage,
}: {
    sections: SellerQuestionSection[];
    includedKeys?: Set<string>;
    emptyMessage: string;
}) {
    if (sections.length === 0) {
        return (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {sections.map((section) => (
                <section key={section.key} className="rounded-xl border border-border bg-muted/15 p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                                <Badge variant="outline">{GROUP_LABELS[section.group]}</Badge>
                                {section.handoffOnly && (
                                    <Badge variant="outline">{PACKET_MODE_LABELS.advanced} only</Badge>
                                )}
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground">{section.description}</p>
                            {section.condition && (
                                <p className="text-xs leading-relaxed text-foreground/70">{section.condition}</p>
                            )}
                        </div>
                        <span className="shrink-0 text-xs font-medium text-muted-foreground">
                            {section.questions.length} {section.questions.length === 1 ? 'question' : 'questions'}
                        </span>
                    </div>

                    <ul className="mt-3 space-y-2">
                        {section.questions.map((question) => {
                            const included = !includedKeys || includedKeys.has(question.key);
                            return (
                                <li
                                    key={question.key}
                                    className={`rounded-lg border px-3 py-2.5 ${
                                        included ? 'border-border bg-background/40' : 'border-dashed border-border bg-background/10'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground">{question.label}</p>
                                        {includedKeys && (
                                            <Badge variant={included ? 'default' : 'outline'}>
                                                {included ? 'Included' : 'Not included'}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                        Seller sees: {question.sellerPrompt}
                                    </p>
                                    {question.helper && (
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/90">
                                            {question.helper}
                                        </p>
                                    )}
                                    {question.choices && question.choices.length > 0 && (
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/90">
                                            Choices: {question.choices.join(', ')}
                                        </p>
                                    )}
                                    {question.example && (
                                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground/90">
                                            Example: {question.example}
                                        </p>
                                    )}
                                    {question.condition && (
                                        <p className="mt-1 text-xs leading-relaxed text-foreground/70">
                                            {question.condition}
                                        </p>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}

export function SellerQuestionsDialog({
    configuration,
    triggerLabel = 'Preview seller questions',
    className,
}: SellerQuestionsDialogProps) {
    const searchId = useId();
    const [open, setOpen] = useState(false);
    const [previewQuery, setPreviewQuery] = useState('');
    const [inventoryQuery, setInventoryQuery] = useState('');

    const previewSections = useMemo(
        () => getSellerQuestionPreview(configuration),
        [configuration]
    );
    const inventorySections = useMemo(() => getSellerQuestionInventory(), []);
    const includedKeys = useMemo(
        () => getIncludedSellerQuestionKeys(configuration),
        [configuration]
    );

    const filteredPreview = useMemo(
        () => searchSellerQuestionSections(previewSections, previewQuery),
        [previewSections, previewQuery]
    );
    const filteredInventory = useMemo(
        () => searchSellerQuestionSections(inventorySections, inventoryQuery),
        [inventorySections, inventoryQuery]
    );

    const previewCount = countSellerQuestions(previewSections);
    const inventoryCount = countSellerQuestions(inventorySections);
    const modeLabel = PACKET_MODE_LABELS[configuration.packetMode];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className)}>
                <ListChecks className="mr-2 h-4 w-4" />
                {triggerLabel}
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-hidden !max-w-[calc(100vw-2rem)] sm:!max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Seller questions</DialogTitle>
                    <DialogDescription>
                        See exactly what this form asks, and browse every question UtilitySheet can collect.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="preview" className="min-h-0">
                    <TabsList className="w-full">
                        <TabsTrigger value="preview">This form</TabsTrigger>
                        <TabsTrigger value="inventory">All questions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="preview" className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        <div className="space-y-1">
                            <p className="text-sm text-foreground">
                                <span className="font-medium">{modeLabel}</span>
                                {' · '}
                                {previewCount} {previewCount === 1 ? 'question' : 'questions'} in{' '}
                                {previewSections.length} {previewSections.length === 1 ? 'section' : 'sections'}
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Sellers only reach a section when it applies to their home, so most sellers answer
                                fewer questions than this. Conditions are listed under each question.
                            </p>
                        </div>

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id={`${searchId}-preview`}
                                value={previewQuery}
                                onChange={(event) => setPreviewQuery(event.target.value)}
                                placeholder="Search this form's questions"
                                aria-label="Search this form's questions"
                                className="pl-9"
                            />
                        </div>

                        <SectionList
                            sections={filteredPreview}
                            emptyMessage={
                                previewQuery.trim()
                                    ? 'No questions on this form match that search.'
                                    : 'This form has no questions configured yet.'
                            }
                        />
                    </TabsContent>

                    <TabsContent value="inventory" className="mt-3 max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        <div className="space-y-1">
                            <p className="text-sm text-foreground">
                                <span className="font-medium">{inventoryCount} built-in questions</span> across{' '}
                                {inventorySections.length} sections
                            </p>
                            <p className="text-xs leading-relaxed text-muted-foreground">
                                Every question UtilitySheet can ask today. Questions cannot be added or reworded.
                                Badges show what your current configuration includes.
                            </p>
                        </div>

                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id={`${searchId}-inventory`}
                                value={inventoryQuery}
                                onChange={(event) => setInventoryQuery(event.target.value)}
                                placeholder="Search all questions, for example: garage, mailbox, pool"
                                aria-label="Search all built-in seller questions"
                                className="pl-9"
                            />
                        </div>

                        <SectionList
                            sections={filteredInventory}
                            includedKeys={includedKeys}
                            emptyMessage="No built-in question matches that search. Use “Don’t see a question you need?” to tell us what is missing."
                        />
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
