// Renders the section component for the active TA6 step, wiring its slice of
// the form and reporting edits back as a whole-form patch. Kept separate from
// the shell so the 15-way switch does not bloat TA6Form.

import type { ReactElement } from 'react';

import { Section01 } from './Section01';
import { Section02 } from './Section02';
import { Section03 } from './Section03';
import { Section04 } from './Section04';
import { Section05 } from './Section05';
import { Section06 } from './Section06';
import { Section07 } from './Section07';
import { Section08 } from './Section08';
import { Section09 } from './Section09';
import { Section10 } from './Section10';
import { Section11 } from './Section11';
import { Section12 } from './Section12';
import { Section13 } from './Section13';
import { Section14 } from './Section14';
import { Section15 } from './Section15';
import type { TA6PropertyInformation } from '../../../types/ta6.types';

export interface ActiveSectionProps {
  step: number;
  form: TA6PropertyInformation;
  onChange: (next: TA6PropertyInformation) => void;
  readOnly: boolean;
  uploadFile?: (file: File) => Promise<string>;
}

export function ActiveSection({
  step,
  form,
  onChange,
  readOnly,
  uploadFile,
}: ActiveSectionProps): ReactElement | null {
  const common = { readOnly, uploadFile };
  switch (step) {
    case 1:
      return <Section01 value={form.section1} onChange={(section1) => onChange({ ...form, section1 })} {...common} />;
    case 2:
      return <Section02 value={form.section2} onChange={(section2) => onChange({ ...form, section2 })} {...common} />;
    case 3:
      return <Section03 value={form.section3} onChange={(section3) => onChange({ ...form, section3 })} {...common} />;
    case 4:
      return <Section04 value={form.section4} onChange={(section4) => onChange({ ...form, section4 })} {...common} />;
    case 5:
      return <Section05 value={form.section5} onChange={(section5) => onChange({ ...form, section5 })} {...common} />;
    case 6:
      return <Section06 value={form.section6} onChange={(section6) => onChange({ ...form, section6 })} {...common} />;
    case 7:
      return <Section07 value={form.section7} onChange={(section7) => onChange({ ...form, section7 })} {...common} />;
    case 8:
      return <Section08 value={form.section8} onChange={(section8) => onChange({ ...form, section8 })} {...common} />;
    case 9:
      return <Section09 value={form.section9} onChange={(section9) => onChange({ ...form, section9 })} {...common} />;
    case 10:
      return <Section10 value={form.section10} onChange={(section10) => onChange({ ...form, section10 })} {...common} />;
    case 11:
      return <Section11 value={form.section11} onChange={(section11) => onChange({ ...form, section11 })} {...common} />;
    case 12:
      return <Section12 value={form.section12} onChange={(section12) => onChange({ ...form, section12 })} {...common} />;
    case 13:
      return <Section13 value={form.section13} onChange={(section13) => onChange({ ...form, section13 })} {...common} />;
    case 14:
      return <Section14 value={form.section14} onChange={(section14) => onChange({ ...form, section14 })} {...common} />;
    case 15:
      return <Section15 value={form.section15} onChange={(section15) => onChange({ ...form, section15 })} {...common} />;
    default:
      return null;
  }
}

export default ActiveSection;
