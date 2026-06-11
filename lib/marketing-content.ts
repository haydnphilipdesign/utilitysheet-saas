export const siteKeywords = [
  'utility sheet software',
  'reusable seller utility link',
  'seller utility information form',
  'real estate utility sheet',
  'transaction coordinator software',
  'real estate closing checklist',
  'utility setup sheet',
  'utility transfer checklist',
  'seller intake form for utilities',
  'real estate transaction tools',
  'closing prep software for agents',
] as const;

export const faqItems = [
  {
    question: 'Who is UtilitySheet for?',
    answer:
      'UtilitySheet is built for transaction coordinators, real estate agents, listing admins, support staff, and teams that need a repeatable way to collect seller utility information and share a clean utility sheet before closing.',
  },
  {
    question: 'Can I use one link for every property?',
    answer:
      'Yes. UtilitySheet creates a reusable seller link for your workspace. Add it to your email signature, text templates, or closing checklist, and sellers can start by entering the property address.',
  },
  {
    question: 'What is the Advanced Utility Packet?',
    answer:
      'Advanced Utility Packet mode adds optional transition details like lawn care, irrigation, security, service providers, mailbox details, and access notes so the final sheet is more complete.',
  },
  {
    question: 'Does the seller need an account or app?',
    answer:
      'No. Sellers open a secure link on their phone, confirm their utility providers, and submit the form without creating an account or downloading anything.',
  },
  {
    question: 'Do sellers actually complete the form?',
    answer:
      'Yes. Nearly 86% of started UtilitySheets are completed, which is why the workflow is built around one simple seller link instead of a long email thread or a blank PDF.',
  },
  {
    question: 'How does PDF delivery work?',
    answer:
      'When the seller submits, UtilitySheet can attach the finished utility sheet PDF to the completion email, so the file is ready to review and share right away. If you later update the live info sheet in the dashboard, future PDF downloads reflect those changes, but previously emailed attachments stay as sent snapshots.',
  },
  {
    question: 'Can I edit a submitted info sheet?',
    answer:
      'Yes. Submitted info sheets can be edited after seller submission on Pro and Team plans. Editing happens inside the authenticated dashboard, seller and public links stay read-only after submission, and future PDF downloads reflect the latest saved version. In Team workspaces, any teammate who already has access to the request can make updates.',
  },
  {
    question: 'How do provider suggestions work?',
    answer:
      'UtilitySheet suggests likely utility providers based on the property address. Sellers can confirm the suggestion, search for another provider, or enter one manually.',
  },
  {
    question: 'What happens if I hit the free plan limit?',
    answer:
      'Additional submissions are still saved. If they are locked because of the free-plan limit, they unlock automatically after you upgrade. Editing submitted sheets is reserved for Pro and Team workspaces.',
  },
  {
    question: 'How long does it take to get started?',
    answer:
      'After signup, your reusable seller link is the first thing you see in the dashboard. You can copy it right away, add it to a template, share it with a seller, and come back later to adjust branding, packet mode, or other settings.',
  },
  {
    question: 'What happens after I sign up?',
    answer:
      'You land on a dashboard built around your seller link. Copy the link, send it to a seller, track submissions, review the finished utility sheet, and download the PDF when the seller is done.',
  },
] as const;

export const pricingTiers = [
  {
    name: 'Starter',
    price: 'Free',
    description:
      'For proving the seller utility handoff workflow on a few live files each month.',
    href: '/auth/signup',
    features: [
      '3 live files per month',
      'Reusable seller link',
      'Simple Utility Sheet mode',
      'Dashboard view of submitted sheets',
      'Clean PDF and share link',
      'Completion email notifications',
      'Optional PDF attachment on completion emails',
    ],
  },
  {
    name: 'Pro',
    price: '$9/month',
    description:
      'For solo TCs and agents who want UtilitySheet as their default utility workflow on every transaction.',
    href: '/auth/signup?plan=pro',
    features: [
      'Use UtilitySheet on every file',
      'Advanced Utility Packet mode',
      'Edit submitted sheets after seller submission',
      'Live updates to future PDF downloads',
      'Custom branding and branded links',
      'Branded PDF attachments',
      'Locked submission unlocks',
      'Priority support',
    ],
  },
  {
    name: 'Teams',
    price: '$7/seat/month',
    description:
      'For TC companies, admins, and real estate teams that need shared access, shared defaults, and consistent branded output across multiple people.',
    href: '/auth/signup?plan=teams',
    features: [
      'Everything in Pro',
      'Shared organization workspace',
      'Any teammate with request access can edit submitted sheets',
      'Invites and user roles',
      'Org-wide packet defaults',
      'Branded output across the team',
      'Priority support',
    ],
  },
] as const;

export const workflowSteps = [
  {
    number: '01',
    title: 'Send one seller utility form link',
    description:
      'Share your reusable seller link by email, text, signature, or checklist. Sellers enter the property address and start from their phone or computer.',
  },
  {
    number: '02',
    title: 'Let the seller confirm utility providers',
    description:
      'UtilitySheet guides the seller through each utility. Where suggestions are available, sellers can confirm, search, or type their own provider details, and nearly 86% of started UtilitySheets are completed.',
  },
  {
    number: '03',
    title: 'Review, edit if needed, and share the buyer-ready sheet',
    description:
      'The finished utility sheet is ready as a web view and downloadable PDF. Add it to the file, share it with buyers or support teams, and make dashboard-side corrections on Pro and Teams.',
  },
] as const;

export const featureHighlights = [
  {
    title: 'Reusable seller link',
    description:
      'Use the same seller intake link across listings instead of rebuilding a utility request for every property.',
  },
  {
    title: 'Simple Utility Sheet and Advanced Utility Packet modes',
    description:
      'Choose a lightweight utility sheet or collect deeper closing-prep details when the transaction needs more context.',
  },
  {
    title: 'Suggested providers from the address',
    description:
      'UtilitySheet can suggest likely providers based on the property address. Sellers can confirm, search, or type their own answer.',
  },
  {
    title: 'Submitted-sheet editing on Pro and Teams',
    description:
      'Correct capitalization, addresses, provider names, phone numbers, websites, and other seller-entered details after submission without reopening the seller form.',
  },
  {
    title: 'Clean web and PDF output',
    description:
      'Create a buyer-ready utility sheet and PDF you can review, share, and send without reformatting.',
  },
  {
    title: 'Tracking, reminders, and status visibility',
    description:
      'See which requests are complete, which sellers need a nudge, and which utility sheets are ready to review.',
  },
  {
    title: 'White-label branding on paid plans',
    description:
      'Paid plans can add your logo, colors, branded link, and branded PDF output so the sheet looks like it came from your team.',
  },
] as const;

export const audiencePages = [
  {
    href: '/utility-sheet-for-transaction-coordinators',
    title: 'Utility sheet for transaction coordinators',
    description:
      'A repeatable seller link for TCs who want cleaner submissions and fewer utility follow-up messages.',
  },
  {
    href: '/utility-sheet-for-real-estate-agents',
    title: 'Utility sheet for real estate agents',
    description:
      'A simple way for agents and support teams to collect seller utility information and share a cleaner buyer-ready sheet.',
  },
  {
    href: '/seller-utility-information-form',
    title: 'Seller utility information form',
    description:
      'See how the guided seller experience turns one intake link into a ready-to-review utility sheet.',
  },
  {
    href: '/real-estate-closing-utility-checklist',
    title: 'Real estate closing utility checklist',
    description:
      'Use a practical utility checklist and see how UtilitySheet makes utility collection and sharing easier to repeat.',
  },
] as const;

export const supportPageLinks = [
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
] as const;
