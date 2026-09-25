/**
 * Copy for the five welcome cards.
 *
 * Content lives apart from the component on purpose: this is brand voice, and
 * Marc edits it without touching React. Rules it follows, from the plan:
 *
 *  - Never name a UI element. Describe what happens; the screen should be findable.
 *  - Every step says WHY, not just what. "Prove it's yours — so buyers can trust
 *    your listing" beats "Ownership verification".
 *  - Teach both journeys. Most movers are doing both at once.
 */

export interface WelcomeStep {
  readonly title: string;
  readonly why: string;
}

export interface WelcomeCard {
  readonly id: string;
  readonly heading: string;
  readonly intro: string;
  readonly steps?: readonly WelcomeStep[];
  readonly outro?: string;
}

export const WELCOME_CARDS: readonly WelcomeCard[] = [
  {
    id: 'what-propxchain-is',
    heading: 'Everything a buyer asks for, ready before you list',
    intro:
      'Normally the questions start after someone makes an offer, and the answers take weeks to find. PropXchain gathers them up front, so the waiting happens before the clock is running rather than after.',
    outro:
      'And every fact carries its source. What goes on the record stays on the record — so a conveyancer, a lender or a buyer can check where something came from instead of taking your word for it.',
  },
  {
    id: 'selling',
    heading: 'Selling your home',
    intro: 'Six steps, in the order they happen.',
    steps: [
      { title: 'Add your property', why: 'One address is enough to start — we find the rest.' },
      { title: 'Prove it is yours', why: 'A title check from the Land Registry, so buyers know the listing is genuine.' },
      { title: 'Answer the standard forms', why: 'TA6, TA7 and TA10 in plain English, saved as you go, so you can stop and come back.' },
      { title: 'We gather the facts', why: 'EPC, flood risk, planning and what nearby homes sold for — pulled in for you.' },
      { title: 'Order your searches', why: 'You choose the provider and see the full price before you commit.' },
      { title: 'Share your pack', why: 'One link for the buyer and their conveyancer, instead of the same questions asked twice.' },
    ],
  },
  {
    id: 'buying',
    heading: 'Buying a home',
    intro: 'Six steps, in the order they happen.',
    steps: [
      { title: 'Join the transaction', why: 'A code from the seller puts you both on the same record.' },
      { title: 'Sort your funding', why: 'Get your mortgage and deposit position clear early — it is what holds most moves up.' },
      { title: 'Read the seller pack', why: 'Forms, searches and title, before you spend money on a survey.' },
      { title: 'Book your survey', why: 'You already know what to look for, because the pack told you.' },
      { title: 'Raise your enquiries', why: 'Your conveyancer asks, the seller answers, and it is all in one place.' },
      { title: 'Exchange and complete', why: 'Contracts signed, dates agreed, keys handed over.' },
    ],
  },
  {
    id: 'following-your-move',
    heading: 'Following your move',
    intro:
      'Once an offer is agreed, the hardest part is not knowing what is happening. This is what you can see.',
    steps: [
      { title: 'Where you are', why: 'Every stage, what is done and what is next.' },
      { title: 'Your chain', why: 'The moves above and below you, so a delay somewhere else is not a mystery.' },
      { title: 'Talk to the other side', why: 'Messages on the transaction rather than lost in an inbox.' },
      { title: 'Bring in your conveyancer', why: 'Invite the firm you choose straight onto the move — or pick one from our panel at the same price as going direct.' },
    ],
  },
  {
    id: 'all-set',
    heading: 'That is the whole thing',
    intro:
      'You do not have to remember any of it. Whatever needs doing next is always waiting for you when you come back.',
    outro:
      'Stuck, or something looks wrong? Tell us — we would rather hear it early. Good luck with the move.',
  },
];
