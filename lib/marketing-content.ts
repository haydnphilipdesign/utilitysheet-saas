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
      'UtilitySheet is built for transaction coordinators, real estate agents, listing admins, support staff, and teams that need a repeatable way to collect seller utility information and share a clean utility sheet. Use it at listing intake, under contract, or as closing approaches, from either side of the transaction.',
  },
  {
    question: 'Can I use one link for every property?',
    answer:
      'Yes. UtilitySheet creates a reusable seller link for your workspace. Add it to your seller welcome email, listing checklist, closing-prep email, or text templates, and sellers can start by entering the property address. If different transactions need different questions, you can save a separate seller form for each, and every form has its own reusable link.',
  },
  {
    question: 'Can I save more than one seller form?',
    answer:
      'Yes. Each saved seller form has its own name, reusable link, question settings, Branding Profile, and an optional short introduction for the seller. The free plan includes one customizable form per workspace. Pro includes up to ten per workspace, and Teams includes up to ten per member. Pick a form when you create an individual request, or share its link directly. You can duplicate, pause, and reactivate forms, and editing a form never changes requests that sellers have already started.',
  },
  {
    question: 'Can I choose what sellers are asked?',
    answer:
      'Yes. On every plan you choose which utilities are included, whether sellers are asked about an HOA or condo association, and whether the electric meter number is collected. You can set these on a saved form or change them for a single request. Pro and Teams add Property Handoff Packet mode with its optional sections and per-question controls. A built-in preview shows exactly what the seller will see before you send anything.',
  },
  {
    question: 'Does UtilitySheet collect HOA or condo association details?',
    answer:
      'Yes, on every plan. Seller forms ask whether the home is part of an HOA or condo association. No or Not sure is one tap. If the seller answers Yes, the form collects the association name, management company, contact name, phone, and email, dues, and where dues are paid or documents are found. The answers appear on the web sheet and the PDF. The question is on by default and you can turn it off for a form or for a single request.',
  },
  {
    question: 'When should I send the seller link?',
    answer:
      'Whenever it fits your process. Listing teams can include it in a seller welcome email or listing checklist, or send it directly to the seller before closing. Buyer-side coordinators can ask the listing agent to forward the link to the seller, so the seller fills in the details. If you collect details early, review the sheet before you share it, since providers or access details can change before closing.',
  },
  {
    question: 'What is the Property Handoff Packet?',
    answer:
      'Property Handoff Packet mode collects utilities, home systems, access details, and service-provider information in one seller handoff. It adds optional sections for lawn and snow care, irrigation, mailbox and home access, security and smart devices, and recurring home service contacts, so the finished packet covers more than utilities alone.',
  },
  {
    question: 'Does the seller need an account or app?',
    answer:
      'No. Sellers open a secure link on their phone, confirm their utility providers, and submit the form without creating an account or downloading anything.',
  },
  {
    question: 'Do sellers actually complete the form?',
    answer:
      'The form is designed to be easy to finish on a phone: guided questions, provider suggestions when available, and no seller account required. Track submissions from your dashboard.',
  },
  {
    question: 'How does PDF delivery work?',
    answer:
      'When the seller submits, UtilitySheet can attach the finished utility sheet PDF to the completion email, so the file is ready to review and share right away. If you later update the live info sheet in the dashboard, future PDF downloads reflect those changes, but previously emailed attachments stay as sent snapshots.',
  },
  {
    question: 'Can I edit a submitted info sheet?',
    answer:
      'Yes. Submitted info sheets can be edited after seller submission on Pro and Team plans. Editing happens inside the authenticated dashboard, and future PDF downloads reflect the latest saved version. You can correct the address, provider names, phone numbers, websites, home basics, and HOA details, replace a seller’s “Not sure” with the right provider, or leave a utility off the sheet. In Team workspaces, any teammate who already has access to the request can make updates.',
  },
  {
    question: 'How do provider suggestions work?',
    answer:
      'UtilitySheet suggests likely utility providers based on the property address. Sellers can confirm the suggestion, search for another provider, or enter one manually.',
  },
  {
    question: 'What happens if I hit the free plan limit?',
    answer:
      'The free plan includes three submitted sheets per month. A file only counts when the seller submits it, so creating and sending requests is never blocked, and a request the seller never answers does not use one. Submissions past the limit are still saved. They are locked until you upgrade, then unlock automatically. Editing submitted sheets is reserved for Pro and Team workspaces.',
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
      'For proving the seller utility handoff workflow on a few submitted sheets each month.',
    href: '/auth/signup',
    features: [
      '3 submitted sheets per month',
      '1 customizable seller form per workspace',
      'Simple Utility Sheet mode',
      'HOA and condo association questions',
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
      'Up to 10 saved seller forms per workspace',
      'Property Handoff Packet mode',
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
      'For TC companies, admins, and real estate teams that need shared access, shared Branding Profiles, and consistent branded output across multiple people.',
    href: '/auth/signup?plan=teams',
    features: [
      'Everything in Pro',
      'Up to 10 saved seller forms per member',
      'Shared organization workspace',
      'Any teammate with request access can edit submitted sheets',
      'Invites and user roles',
      'Branding Profiles shared by the whole team',
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
      'Share your reusable seller link at listing intake or before closing, by email, text, signature, or checklist. Sellers enter the property address and start from their phone or computer.',
  },
  {
    number: '02',
    title: 'Let the seller confirm utility providers',
    description:
      'UtilitySheet guides the seller through each utility. Where suggestions are available, sellers can confirm, search, or type their own provider details.',
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
    title: 'Saved seller forms for different transactions',
    description:
      'Save a named form for each kind of file, each with its own reusable link, questions, branding, and optional note to the seller. One form is included on every plan, and Pro and Teams can save up to ten.',
  },
  {
    title: 'Control over what sellers are asked',
    description:
      'Choose the utilities, the HOA question, and the electric meter number on every plan, for a whole form or a single request. Preview the exact seller questions before you send.',
  },
  {
    title: 'HOA and condo association details',
    description:
      'Sellers answer one quick HOA question. A Yes collects the association name, management contact, dues, and where dues are paid, and it all prints on the sheet and PDF.',
  },
  {
    title: 'Simple Utility Sheet and Property Handoff Packet modes',
    description:
      'Choose core utility information, or collect utilities, home systems, access details, and service-provider information in one seller handoff.',
  },
  {
    title: 'Suggested providers from the address',
    description:
      'UtilitySheet can suggest likely providers based on the property address. Sellers can confirm, search, or type their own answer.',
  },
  {
    title: 'Submitted-sheet editing on Pro and Teams',
    description:
      'Correct addresses, provider names, phone numbers, websites, home basics, and HOA details after submission without reopening the seller form. Replace a “Not sure” answer with the right provider, or leave a utility off the sheet.',
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
