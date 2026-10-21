import type { UtilityCategory } from '@/types';

/**
 * A made-up, completed Utility Info Sheet for the sample on
 * /utility-sheet-template and /templates/utility-info-sheet-sample.pdf.
 *
 * Everything here must stay obviously fictional: no real utility companies,
 * addresses, or people. Phone numbers use the 555-01xx range reserved for
 * fiction, and websites use the reserved .example domain.
 */

export const sampleUtilitySheet = {
  propertyAddress: '123 Sample Street, Anytown',
  sellerName: 'Alex Example',
  sellerPhone: '(555) 555-0100',
  dateCompleted: '04/15/2026',
  homeBasics: {
    water: 'City / public',
    sewer: 'Public sewer',
    heating: 'Natural gas',
  },
  providers: {
    electric: { provider: 'Example Electric Co.', phone: '(555) 555-0110', notes: 'electric.example' },
    gas: { provider: 'Sample Gas Utility', phone: '(555) 555-0111', notes: 'gas.example' },
    propane: { provider: 'None' },
    oil: { provider: 'None' },
    water: { provider: 'Anytown Water Department', phone: '(555) 555-0112', notes: 'Bills water and sewer together' },
    sewer: { provider: 'Anytown Water Department', phone: '(555) 555-0112', notes: 'Same bill as water' },
    trash: { provider: 'Example Waste Services', phone: '(555) 555-0113', notes: 'Pickup on Tuesdays' },
    internet: { provider: 'Sample Fiber Internet', phone: '(555) 555-0114', notes: 'Book install 1-2 weeks ahead' },
    cable: { provider: 'Not sure' },
  } satisfies Record<UtilityCategory, { provider: string; phone?: string; notes?: string }>,
  electricMeterNumber: '000-000-SAMPLE',
  hoa: {
    member: 'Yes',
    name: 'Sample Meadows HOA',
    management: 'Example Property Management, Pat Example',
    phone: '(555) 555-0120',
    email: 'manager@example.com',
    dues: '$150 per quarter',
    paymentAndDocuments: 'Pay online at hoa.example; documents from the management company',
  },
} as const;
