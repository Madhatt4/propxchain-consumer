// Plain-English section guides for the TA6 form (one card per section).
// Lay-person tone: what the section is really asking, what to dig out before
// starting, and reassurance about honest "not known" answers. Guidance only —
// these join the paraphrase bundle's pre-launch legal review (ADR 0009).

export interface TA6SectionGuide {
  /** TA6 section number, 1–15. */
  section: number;
  /** Friendly one-line framing, e.g. "Who owns what at the edges". */
  plainTitle: string;
  /** 2–3 short sentences explaining the section in everyday language. */
  intro: string;
  /** Documents or facts worth having to hand before answering. */
  whatYoullNeed: string[];
  /** One sentence of reassurance (e.g. that "Not known" is acceptable). */
  reassurance: string;
}
