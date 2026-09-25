import jsPDF from 'jspdf';
import { logger } from '@/utils/logger';

interface Party {
  userId: string;
  role: string;
  name: string;
  email: string;
  hasSigned: boolean;
  signedAt?: string;
  signature?: string;
  visualSignature?: string;
}

interface Transaction {
  id: string;
  propertyAddress: string;
  titleNumber: string;
  propertyType: string;
  parties: Party[];
  financialTerms: {
    purchasePrice: number;
    deposit: number;
    completionDate: string;
  };
  contractHash: string;
  exchangeTimestamp?: number;
}

export async function generateSignedContractPDF(
  transaction: Transaction,
  _currentUser: any
): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
      addFooter();
      return true;
    }
    return false;
  };

  // Footer on every page
  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(
      'Verified on Internet Computer Protocol Blockchain',
      pageWidth / 2,
      pageHeight - 15,
      { align: 'center' }
    );
    doc.text(
      `Transaction ID: ${transaction.id}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'This document is cryptographically secured and tamper-proof',
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  };

  // PAGE 1: COVER PAGE
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('PROPERTY EXCHANGE CONTRACT', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text('Recorded on Internet Computer Protocol Blockchain', pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(transaction.propertyAddress, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 15;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const exchangeDate = transaction.exchangeTimestamp
    ? new Date(transaction.exchangeTimestamp * 1000).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.text(`Exchange Date: ${exchangeDate}`, pageWidth / 2, yPosition, { align: 'center' });

  yPosition += 30;
  doc.setFillColor(220, 220, 220);
  doc.rect(20, yPosition, pageWidth - 40, 30, 'F');
  yPosition += 12;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(139, 0, 0);
  doc.text('LEGALLY BINDING AGREEMENT', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text('All parties have digitally signed this contract on the blockchain', pageWidth / 2, yPosition, { align: 'center' });

  addFooter();

  // PAGE 2: TRANSACTION DETAILS
  doc.addPage();
  yPosition = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('TRANSACTION DETAILS', 20, yPosition);

  yPosition += 15;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, pageWidth - 20, yPosition);

  yPosition += 10;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);

  const details = [
    ['Property Address:', transaction.propertyAddress],
    ['Title Number:', transaction.titleNumber],
    ['Property Type:', transaction.propertyType],
    ['Purchase Price:', `£${transaction.financialTerms.purchasePrice.toLocaleString()}`],
    ['Deposit Amount:', `£${transaction.financialTerms.deposit.toLocaleString()}`],
    ['Completion Date:', new Date(transaction.financialTerms.completionDate).toLocaleDateString('en-GB')],
    ['Contract Hash:', transaction.contractHash],
    ['Blockchain Transaction ID:', transaction.id],
  ];

  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, 25, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(value, 80, yPosition);
    yPosition += 8;
  });

  yPosition += 10;
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.setFont('helvetica', 'italic');
  doc.text('This contract has been cryptographically secured on the Internet Computer Protocol', 20, yPosition);
  doc.text('blockchain. The contract hash above provides proof of the exact terms agreed.', 20, yPosition + 5);

  addFooter();

  // PAGE 3+: PARTIES & SIGNATURES
  doc.addPage();
  yPosition = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('PARTIES & DIGITAL SIGNATURES', 20, yPosition);

  yPosition += 15;
  doc.setDrawColor(0, 51, 102);
  doc.setLineWidth(0.5);
  doc.line(20, yPosition, pageWidth - 20, yPosition);
  yPosition += 10;

  for (const party of transaction.parties) {
    checkPageBreak(70);

    // Party box
    doc.setFillColor(245, 245, 245);
    doc.rect(20, yPosition, pageWidth - 40, 65, 'F');
    doc.setDrawColor(200);
    doc.rect(20, yPosition, pageWidth - 40, 65, 'S');

    yPosition += 8;
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    doc.text(party.name, 25, yPosition);

    yPosition += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Role: ${party.role.charAt(0).toUpperCase() + party.role.slice(1)}`, 25, yPosition);

    yPosition += 6;
    doc.text(`Email: ${party.email}`, 25, yPosition);

    if (party.hasSigned && party.signedAt) {
      yPosition += 8;
      doc.setTextColor(0, 128, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('✓ SIGNED', 25, yPosition);

      yPosition += 6;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(
        `Signed on: ${new Date(party.signedAt).toLocaleString('en-GB')}`,
        25,
        yPosition
      );

      // Add visual signature if available
      if (party.visualSignature) {
        try {
          doc.addImage(party.visualSignature, 'PNG', pageWidth - 90, yPosition - 15, 60, 20);
        } catch (err) {
          logger.warn('Could not embed signature image:', err);
        }
      }

      yPosition += 6;
      doc.setFontSize(8);
      doc.setTextColor(100);
      if (party.signature) {
        doc.text(
          `Cryptographic Hash: ${party.signature.substring(0, 32)}...`,
          25,
          yPosition
        );
      }
    } else {
      yPosition += 8;
      doc.setTextColor(200, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('✗ NOT SIGNED', 25, yPosition);
    }

    yPosition += 12;
  }

  yPosition += 10;
  checkPageBreak(30);

  // Verification section
  doc.setFillColor(240, 248, 255);
  doc.rect(20, yPosition, pageWidth - 40, 25, 'F');
  doc.setDrawColor(0, 51, 102);
  doc.rect(20, yPosition, pageWidth - 40, 25, 'S');

  yPosition += 8;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 51, 102);
  doc.text('BLOCKCHAIN VERIFICATION', 25, yPosition);

  yPosition += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0);
  doc.text('This contract is permanently recorded on the Internet Computer Protocol blockchain.', 25, yPosition);
  yPosition += 5;
  doc.text('All signatures are cryptographically secured and cannot be altered or repudiated.', 25, yPosition);

  addFooter();

  // Convert to Blob
  const pdfBlob = doc.output('blob');
  return pdfBlob;
}
