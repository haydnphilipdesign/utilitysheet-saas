// Social preview (Open Graph) image content for each public page. Headlines
// reuse the page's own H1 so a shared link previews what the page says;
// update the entry here when you change that H1.
export const ogPages = {
  home: {
    path: '/',
    eyebrow: 'Seller utility details → buyer handoff',
    title: 'The utility handoff, finally organized',
  },
  features: {
    path: '/features',
    eyebrow: 'Features',
    title: 'Everything the handoff needs. Nothing it doesn’t.',
  },
  'how-it-works': {
    path: '/how-it-works',
    eyebrow: 'How it works',
    title: 'From seller link to buyer handoff. Three simple steps.',
  },
  pricing: {
    path: '/pricing',
    eyebrow: 'Pricing',
    title: 'Simple pricing for smoother transactions.',
  },
  faq: {
    path: '/faq',
    eyebrow: 'FAQ',
    title: 'Got questions? We’ve got answers.',
  },
  about: {
    path: '/about',
    eyebrow: 'Our story',
    title: 'Built around a real TC’s working day.',
  },
  demo: {
    path: '/demo',
    eyebrow: 'Interactive demo',
    title: 'Try the seller experience',
  },
  'transaction-coordinators': {
    path: '/utility-sheet-for-transaction-coordinators',
    eyebrow: 'For transaction coordinators',
    title: 'One less loose end on every file.',
  },
  'real-estate-agents': {
    path: '/utility-sheet-for-real-estate-agents',
    eyebrow: 'For real estate agents',
    title: 'A thoughtful handoff for your buyers.',
  },
  'seller-utility-information-form': {
    path: '/seller-utility-information-form',
    eyebrow: 'Seller utility information form',
    title: 'The utility form sellers can finish on their phone.',
  },
  'closing-utility-checklist': {
    path: '/real-estate-closing-utility-checklist',
    eyebrow: 'Checklist',
    title: 'Your closing utility checklist, sorted.',
  },
  'tc-utility-handoff-kit': {
    path: '/tc-utility-handoff-kit',
    eyebrow: 'Free TC resource',
    title: 'The TC Utility Handoff Kit',
  },
  'from-a-closing': {
    path: '/from-a-closing',
    eyebrow: 'For closing professionals',
    title: 'You just received a UtilitySheet',
  },
} as const satisfies Record<string, { path: string; eyebrow: string; title: string }>;

export type OgPageSlug = keyof typeof ogPages;

/** Image URL for a page path; pages without their own image use the home image. */
export function ogImagePathFor(path: string): string {
  const slug = (Object.keys(ogPages) as OgPageSlug[]).find((key) => ogPages[key].path === path);
  return `/og/${slug ?? 'home'}`;
}
