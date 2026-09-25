export interface StageHelpContent {
  title: string;
  description: string;
  expectations: string[];
}

export const STAGE_HELP: Record<string, StageHelpContent> = {
  'seller-1': {
    title: 'List Your Property',
    description:
      'This is where your sale begins. We pull your property details from the Land Registry to confirm you own it, then create your listing. This saves you filling in address details manually and proves ownership from day one.',
    expectations: [
      'Enter your property address or title number',
      'We verify ownership automatically via the Land Registry',
      'Your property details appear ready to share with buyers',
    ],
  },
  'seller-2': {
    title: 'Property Searches',
    description:
      'Searches check for hidden issues that could affect the sale — things like flooding risk, planning permissions nearby, or problems with drains. Your buyer needs these before they can commit to purchasing.',
    expectations: [
      'Local authority, environmental, and drainage searches are ordered',
      'Results usually take 2-4 weeks depending on the council',
      'Your conveyancer will review the results with you',
    ],
  },
  'seller-3': {
    title: 'Property Information Forms',
    description:
      'These forms tell the buyer everything they need to know about your property — boundaries, disputes, building work, what fixtures you are leaving. Honest answers here prevent problems later.',
    expectations: [
      'Complete the TA6 (property info) and TA10 (fittings) forms',
      'Answer questions about boundaries, services, and any disputes',
      'AI pre-fills what it can — you review and correct',
    ],
  },
  'seller-4': {
    title: 'Buyer Progress',
    description:
      'Once a buyer is matched to your property, you can track their progress here. You will see which steps they have completed so you know how close you are to exchange.',
    expectations: [
      'See which stages your buyer has completed',
      'No action needed from you — this is a progress tracker',
      'Both parties need to finish their steps before exchange',
    ],
  },
  'seller-5': {
    title: 'Conveyancer Review',
    description:
      'Your conveyancer (the legal professional handling your sale) reviews all the searches and forms. They may raise queries if anything needs clarifying. This is a normal part of the process.',
    expectations: [
      'Your conveyancer reviews search results and your forms',
      'They may ask follow-up questions called "enquiries"',
      'You respond to any enquiries to keep things moving',
    ],
  },
  'seller-6': {
    title: 'Contract & Exchange',
    description:
      'This is the big moment. When both sides sign and exchange contracts, the sale becomes legally binding. Neither party can pull out after this without serious financial consequences.',
    expectations: [
      'Review the final contract your conveyancer has prepared',
      'Sign the contract digitally through the platform',
      'Once both sides exchange, a completion date is set',
    ],
  },
  'seller-7': {
    title: 'Completion',
    description:
      'Completion day is when ownership officially transfers. The buyer sends the money, you hand over the keys, and the Land Registry updates the ownership record. Congratulations — your sale is done.',
    expectations: [
      'Funds transfer to your conveyancer on the agreed date',
      'You hand over the keys to the buyer',
      'The Land Registry updates the title to the new owner',
    ],
  },
  'buyer-1': {
    title: 'Property Matched',
    description:
      'You have been matched to a property and the transaction has started. This confirms which property you are buying and connects you to the seller through the platform.',
    expectations: [
      'Review the property details and confirm your interest',
      'Your transaction is created and linked to the seller',
      'You can now begin the steps needed to complete your purchase',
    ],
  },
  'buyer-2': {
    title: 'Mortgage & Funding',
    description:
      'You need to show you can afford the property. If you have a mortgage, upload your mortgage offer. If you are a cash buyer, upload proof of funds such as a bank statement.',
    expectations: [
      'Upload your formal mortgage offer or proof of funds',
      'Your conveyancer will verify the documents',
      'This must be in place before you can exchange contracts',
    ],
  },
  'buyer-3': {
    title: 'Property Survey',
    description:
      'A survey checks the physical condition of the property. It can reveal structural problems, damp, or other issues that might affect the price or your decision to buy. Surveys are optional but strongly recommended.',
    expectations: [
      'Choose a survey level — basic, homebuyer, or full structural',
      'A qualified surveyor visits and inspects the property',
      'Review the report and discuss any concerns with your conveyancer',
    ],
  },
  'buyer-4': {
    title: "Review Seller's Pack",
    description:
      "The seller has completed searches and filled in property information forms. Your conveyancer reviews these to check for anything that could affect you as the new owner — like planning issues or boundary disputes.",
    expectations: [
      'Your conveyancer reviews the search results and forms',
      'They highlight anything you should be aware of',
      'You may need to ask the seller to clarify certain points',
    ],
  },
  'buyer-5': {
    title: 'Conveyancer Enquiries',
    description:
      "Your conveyancer sends questions (called enquiries) to the seller's side about anything unclear in the paperwork. This back-and-forth is normal and makes sure there are no surprises after you buy.",
    expectations: [
      'Your conveyancer raises enquiries on your behalf',
      "The seller's conveyancer responds with answers or documents",
      'This can take a few rounds — patience is normal here',
    ],
  },
  'buyer-6': {
    title: 'Contract & Exchange',
    description:
      'When you sign and exchange contracts, you are legally committed to buying the property. Your deposit is paid at this point. After exchange, pulling out would mean losing your deposit.',
    expectations: [
      'Review and sign the contract prepared by your conveyancer',
      'Pay your deposit (usually 10% of the purchase price)',
      'A completion date is agreed and set in the contract',
    ],
  },
  'buyer-7': {
    title: 'Completion',
    description:
      'This is the day you become the legal owner. Your mortgage lender releases the funds, the money transfers to the seller, and you collect the keys. The Land Registry records you as the new owner.',
    expectations: [
      'Your lender sends the mortgage funds to your conveyancer',
      'The balance transfers to the seller and you get the keys',
      'The Land Registry updates ownership — the property is yours',
    ],
  },
};
