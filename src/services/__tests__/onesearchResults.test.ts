// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';

import { parseOneSearchResultsXml } from '../onesearchResults';

// Mirrors the real <SearchResultsSend> OneSearch pushed for invoice E26573713:
// default OSCRE namespace on the envelope, xmlns="" reset on <SearchOrder>, and
// the PDF pretty-printed inside <EmbeddedFileBinaryObject>. The credentials are
// in-band exactly as PISCES sends them — that is the point of the leak test
// below. Values here are synthetic.
const FAKE_PASSWORD = 'n0t-the-real-pisces-password';
const FAKE_USERNAME = 'propxchain-test-user';

function resultsXml(products: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<SearchResultsSend xmlns="http://www.oscre.org/ns/Searches/StandardV1/SearchResultsSend">
    <Authentication xmlns:auth="http://www.oscre.org/ns/v1/piscesauthentication">
        <Header><Version>1.0</Version><Mode /></Header>
        <AuthenticationData>
            <Username>${FAKE_USERNAME}</Username>
            <Password>${FAKE_PASSWORD}</Password>
        </AuthenticationData>
    </Authentication>
    <SearchOrder xmlns="">
        <IssueDate>2026-07-28</IssueDate>
        <SearchOrderReference>
            <Reference>propxchain-2026-07-27-abc</Reference>
            <AllocatedBy>SearchFacilitatorParty</AllocatedBy>
        </SearchOrderReference>
        <SubjectProperty>
            <PAFAddress><PostTown>London</PostTown><PostCode>SW1A 1AA</PostCode></PAFAddress>
        </SubjectProperty>
        ${products}
    </SearchOrder>
</SearchResultsSend>`;
}

function product(code: string, filename: string, b64: string): string {
  return `<SearchProduct>
      <ProductType>${code}</ProductType>
      <AsOfDate>2026-07-28</AsOfDate>
      <Attachment>
        <EmbeddedFileBinaryObject format="application/pdf" filename="${filename}">${b64}</EmbeddedFileBinaryObject>
        <Description>Search results</Description>
        <Date>2026-07-28</Date>
      </Attachment>
    </SearchProduct>`;
}

describe('parseOneSearchResultsXml', () => {
  it('should extract the attachment with its PISCES product code and filename', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(product('ONESEARCHDW', 'D03650735.pdf', 'JVBERi0xLjc=')),
    );

    expect(bundle.products).toHaveLength(1);
    expect(bundle.products[0].productType).toBe('ONESEARCHDW');
    expect(bundle.products[0].attachments[0]).toEqual({
      contentBase64: 'JVBERi0xLjc=',
      format: 'application/pdf',
      filename: 'D03650735.pdf',
      description: 'Search results',
    });
  });

  // PISCES authenticates in-band, so the stored results document contains our
  // live credentials. This bundle is forwarded to a third-party model, so a
  // regression that widened the parser to serialise the whole document would
  // ship the password to Anthropic.
  it('should never carry the in-band PISCES credentials into the bundle', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(product('ONESEARCHDW', 'D03650735.pdf', 'JVBERi0xLjc=')),
    );

    const serialised = JSON.stringify(bundle);
    expect(serialised).not.toContain(FAKE_PASSWORD);
    expect(serialised).not.toContain(FAKE_USERNAME);
    expect(serialised).not.toContain('AuthenticationData');
  });

  it('should strip whitespace from pretty-printed base64', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(product('ONESEARCHDW', 'a.pdf', '\n      JVBER\n      i0xLjc=\n    ')),
    );
    expect(bundle.products[0].attachments[0].contentBase64).toBe('JVBERi0xLjc=');
  });

  it('should keep every product of a multi-product pack in order', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(
        [
          product('LLC1CON29', 'llc1.pdf', 'QQ=='),
          product('ONESEARCHDW', 'dw.pdf', 'Qg=='),
          product('HOMECHECKPRO', 'env.pdf', 'Qw=='),
        ].join('\n'),
      ),
    );
    expect(bundle.products.map((p) => p.productType)).toEqual([
      'LLC1CON29',
      'ONESEARCHDW',
      'HOMECHECKPRO',
    ]);
    expect(bundle.products.map((p) => p.attachments[0].contentBase64)).toEqual([
      'QQ==',
      'Qg==',
      'Qw==',
    ]);
  });

  // Dropping an empty attachment here would hide the fact that a paid product
  // returned nothing; search-scan's normaliser turns it into a visible
  // "missing section" warning instead.
  it('should keep a product whose attachment has no content so it can be flagged', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(product('ONESEARCHDW', 'empty.pdf', '')),
    );
    expect(bundle.products).toHaveLength(1);
    expect(bundle.products[0].attachments[0].contentBase64).toBe('');
  });

  it('should label a product with no ProductType as UNKNOWN', () => {
    const bundle = parseOneSearchResultsXml(
      resultsXml(`<SearchProduct>
        <Attachment>
          <EmbeddedFileBinaryObject format="application/pdf">QQ==</EmbeddedFileBinaryObject>
        </Attachment>
      </SearchProduct>`),
    );
    expect(bundle.products[0].productType).toBe('UNKNOWN');
    expect('filename' in bundle.products[0].attachments[0]).toBe(false);
  });

  it('should return no products for malformed XML or an empty string', () => {
    expect(parseOneSearchResultsXml('<SearchResultsSend><oops').products).toEqual([]);
    expect(parseOneSearchResultsXml('').products).toEqual([]);
  });
});
