// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import {
  PropertySearch,
  SearchSignOff,
  SearchesProgress,
  SearchUploadData,
  SearchStatus,
} from '../types/searches';
import {
  getEssentialSearchTypes,
  calculateExpiryDate,
  isSearchExpired,
} from '../utils/searchTypes';
import { icpService } from './icp.service';
import { generateFileHash } from '../utils/hashGenerator';
import { localDocumentRegistry } from './localDocumentRegistry';
import { logger } from '@/utils/logger';

// LocalStorage keys
const SEARCHES_STORAGE_KEY = 'propxchain_property_searches';
const SIGNOFFS_STORAGE_KEY = 'propxchain_search_signoffs';

/**
 * Property Searches Service
 * Manages property search documents with hash-only blockchain storage
 */
class SearchService {
  /**
   * Get all searches for a transaction
   */
  getSearchesForTransaction(transactionId: string): PropertySearch[] {
    const allSearches = this.getAllSearches();
    return allSearches.filter(s => s.transactionId === transactionId);
  }

  /**
   * Get all searches from localStorage
   */
  getAllSearches(): PropertySearch[] {
    try {
      const data = localStorage.getItem(SEARCHES_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error loading searches from localStorage:', error);
      return [];
    }
  }

  /**
   * Save searches to localStorage
   */
  private saveSearches(searches: PropertySearch[]): void {
    localStorage.setItem(SEARCHES_STORAGE_KEY, JSON.stringify(searches));
  }

  /**
   * Get a search by ID
   */
  getSearchById(searchId: string): PropertySearch | undefined {
    const allSearches = this.getAllSearches();
    return allSearches.find(s => s.id === searchId);
  }

  /**
   * Upload a new property search document
   * Registers hash on blockchain, stores metadata locally
   */
  async uploadSearch(
    transactionId: string,
    propertyId: number,
    uploadData: SearchUploadData
  ): Promise<PropertySearch> {
    const { searchType, file, searchDate, provider, notes } = uploadData;

    // Initialize ICP service
    await icpService.initialize();

    // Generate SHA-256 hash of the file
    logger.info('Generating search document hash...');
    const documentHash = await generateFileHash(file);
    logger.info('Hash generated:', documentHash.substring(0, 16) + '...');

    // Get user principal
    const userPrincipal = await icpService.getUserPrincipal();

    // Create local storage path reference
    const localPath = `${userPrincipal}/${propertyId}/searches/${searchType}/${file.name}`;
    const storageLocation = localDocumentRegistry.generateStorageLocation(localPath);

    // Register hash on blockchain
    logger.info('Registering search document proof on blockchain...');
    await icpService.ensureDocumentStorageActor();

    const storageResult = await (await icpService.requireDocumentStorage()).registerDocumentProof(
      file.name,
      documentHash,
      BigInt(file.size),
      file.type || 'application/octet-stream',
      storageLocation,
      [transactionId],  // Changed: now Text instead of Nat
      `property_search_${searchType}`,  // NEW: document type for notifications
      await icpService.getDocumentStorageCsrfToken()  // CSRF-protected on the canister
    );

    if ('err' in storageResult) {
      throw new Error(`Failed to register search document proof: ${storageResult.err}`);
    }

    const storageDocId = Number(storageResult.ok);
    logger.info('Search document proof registered, ID:', storageDocId);

    // Extract numeric part from transaction ID (e.g., "tx_1234567890" -> 1234567890)
    const txIdNumeric = transactionId.startsWith('tx_')
      ? transactionId.substring(3)
      : transactionId;

    // Register in document verification canister
    const verificationDocId = await (await icpService.requireDocumentVerification()).registerDocument(
      BigInt(propertyId),
      [BigInt(txIdNumeric)],  // Convert numeric part to BigInt
      `property_search_${searchType}`,
      documentHash,
      [BigInt(storageDocId)],
      [file.name],
      [BigInt(file.size)],
      [file.type || 'application/octet-stream']
    );

    logger.info('Search document registered in verification canister, ID:', verificationDocId);

    icpService.emitDocumentUploadedEvent(transactionId, file.name, `property_search_${searchType}`, documentHash);

    // Register in local document registry
    localDocumentRegistry.registerDocument({
      blockchainId: storageDocId,
      fileName: file.name,
      fileHash: documentHash,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      localPath: localPath,
      uploadedBy: userPrincipal,
      uploadedAt: new Date().toISOString(),
      propertyId: propertyId,
      transactionId: transactionId,
      documentType: `property_search_${searchType}`,
      verified: false,
      notes: notes || `Property search: ${searchType}`,
    });

    // Calculate expiry date
    const expiresAt = calculateExpiryDate(searchDate, searchType);

    // Get user profile for role
    let uploaderRole = 'user';
    try {
      const profile = await icpService.getMyProfile();
      uploaderRole = profile?.userType || 'user';
    } catch (error) {
      logger.warn('Could not get user profile for role:', error);
    }

    // Create PropertySearch record
    const newSearch: PropertySearch = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId,
      searchType,
      status: 'uploaded',
      documentHash,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      searchDate,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userPrincipal,
      uploaderRole,
      provider,
      expiresAt: expiresAt || undefined,
      notes,
      storageDocumentId: storageDocId,
      verificationDocumentId: Number(verificationDocId),
    };

    // Save to localStorage
    const allSearches = this.getAllSearches();
    allSearches.push(newSearch);
    this.saveSearches(allSearches);

    logger.info('Property search uploaded successfully:', newSearch.id);
    return newSearch;
  }

  /**
   * Verify a search document
   */
  async verifySearch(searchId: string, verifierNotes?: string): Promise<PropertySearch> {
    const allSearches = this.getAllSearches();
    const searchIndex = allSearches.findIndex(s => s.id === searchId);

    if (searchIndex === -1) {
      throw new Error('Search not found');
    }

    const search = allSearches[searchIndex];

    if (!search.verificationDocumentId) {
      throw new Error('Search has no verification ID');
    }

    // Initialize ICP service
    await icpService.initialize();

    // Verify on blockchain
    const result = await icpService.verifyDocumentWithHash(
      search.verificationDocumentId,
      verifierNotes
    );

    if ('err' in result) {
      throw new Error(`Verification failed: ${result.err}`);
    }

    const userPrincipal = await icpService.getUserPrincipal();

    // Update search record
    allSearches[searchIndex] = {
      ...search,
      status: 'verified',
      verifiedAt: new Date().toISOString(),
      verifiedBy: userPrincipal,
    };

    this.saveSearches(allSearches);
    logger.info('Search verified successfully:', searchId);

    return allSearches[searchIndex];
  }

  /**
   * Delete a search document
   */
  async deleteSearch(searchId: string): Promise<void> {
    const allSearches = this.getAllSearches();
    const searchIndex = allSearches.findIndex(s => s.id === searchId);

    if (searchIndex === -1) {
      throw new Error('Search not found');
    }

    const search = allSearches[searchIndex];

    // Initialize ICP service
    await icpService.initialize();

    // Delete from blockchain storage using rate-limited service method
    if (search.storageDocumentId) {
      try {
        const success = await icpService.deleteStorageDocument(search.storageDocumentId);
        if (!success) {
          logger.warn('Could not delete document proof');
        }
      } catch (error) {
        logger.warn('Error deleting from storage canister:', error);
      }
    }

    // Delete from verification canister using rate-limited service method
    if (search.verificationDocumentId) {
      try {
        const success = await icpService.deleteVerificationDocument(search.verificationDocumentId);
        if (!success) {
          logger.warn('Could not delete document metadata');
        }
      } catch (error) {
        logger.warn('Error deleting from verification canister:', error);
      }
    }

    // Remove from local registry
    if (search.storageDocumentId) {
      const localRecord = await localDocumentRegistry.getRecordByBlockchainId(search.storageDocumentId);
      if (localRecord) {
        localDocumentRegistry.removeDocument(localRecord.id);
      }
    }

    // Remove from localStorage
    allSearches.splice(searchIndex, 1);
    this.saveSearches(allSearches);

    logger.info('Search deleted successfully:', searchId);
  }

  /**
   * Check and update expired search statuses
   */
  updateExpiredStatuses(transactionId: string): PropertySearch[] {
    const allSearches = this.getAllSearches();
    let updated = false;

    const updatedSearches = allSearches.map(search => {
      if (
        search.transactionId === transactionId &&
        search.expiresAt &&
        search.status !== 'expired' &&
        isSearchExpired(search.expiresAt)
      ) {
        updated = true;
        return { ...search, status: 'expired' as SearchStatus };
      }
      return search;
    });

    if (updated) {
      this.saveSearches(updatedSearches);
    }

    return updatedSearches.filter(s => s.transactionId === transactionId);
  }

  /**
   * Check for duplicate search type
   */
  hasDuplicateSearchType(transactionId: string, searchType: string): boolean {
    const searches = this.getSearchesForTransaction(transactionId);
    return searches.some(s => s.searchType === searchType && s.status !== 'expired');
  }

  // ═══════════════════════════════════════════════════════════════
  // SIGN-OFF MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get all sign-offs from localStorage
   */
  getAllSignOffs(): SearchSignOff[] {
    try {
      const data = localStorage.getItem(SIGNOFFS_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      logger.error('Error loading sign-offs from localStorage:', error);
      return [];
    }
  }

  /**
   * Save sign-offs to localStorage
   */
  private saveSignOffs(signOffs: SearchSignOff[]): void {
    localStorage.setItem(SIGNOFFS_STORAGE_KEY, JSON.stringify(signOffs));
  }

  /**
   * Get active sign-off for a transaction
   */
  getActiveSignOff(transactionId: string): SearchSignOff | undefined {
    const allSignOffs = this.getAllSignOffs();
    return allSignOffs.find(so => so.transactionId === transactionId && so.isActive);
  }

  /**
   * Sign off searches for a transaction
   */
  async signOffSearches(
    transactionId: string,
    notes?: string
  ): Promise<SearchSignOff> {
    // Get current user info
    await icpService.initialize();
    const userPrincipal = await icpService.getUserPrincipal();

    let userRole: 'solicitor' | 'conveyancer' = 'solicitor';
    let userName = 'Unknown';

    try {
      const profile = await icpService.getMyProfile();
      if (profile) {
        userName = profile.name || profile.email || 'Unknown';
        if (profile.userType?.includes('conveyancer')) {
          userRole = 'conveyancer';
        }
      }
    } catch (error) {
      logger.warn('Could not get user profile:', error);
    }

    // Get current searches
    const searches = this.getSearchesForTransaction(transactionId);
    const searchIds = searches.map(s => s.id);

    // Create sign-off record
    const signOff: SearchSignOff = {
      id: `signoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      transactionId,
      signedOffBy: userPrincipal,
      signedOffByName: userName,
      signedOffByRole: userRole,
      signedOffAt: new Date().toISOString(),
      searchesIncluded: searchIds,
      searchCount: searchIds.length,
      notes,
      isActive: true,
    };

    // Save to localStorage
    const allSignOffs = this.getAllSignOffs();
    allSignOffs.push(signOff);
    this.saveSignOffs(allSignOffs);

    logger.info('Searches signed off successfully:', signOff.id);
    return signOff;
  }

  /**
   * Revoke a sign-off
   */
  async revokeSignOff(transactionId: string, reason: string): Promise<void> {
    const allSignOffs = this.getAllSignOffs();
    const signOffIndex = allSignOffs.findIndex(
      so => so.transactionId === transactionId && so.isActive
    );

    if (signOffIndex === -1) {
      throw new Error('No active sign-off found for this transaction');
    }

    // Get current user info
    await icpService.initialize();
    const userPrincipal = await icpService.getUserPrincipal();

    let userName = 'Unknown';
    try {
      const profile = await icpService.getMyProfile();
      if (profile) {
        userName = profile.name || profile.email || 'Unknown';
      }
    } catch (error) {
      logger.warn('Could not get user profile:', error);
    }

    // Update sign-off
    allSignOffs[signOffIndex] = {
      ...allSignOffs[signOffIndex],
      isActive: false,
      revokedAt: new Date().toISOString(),
      revokedBy: userPrincipal,
      revokedByName: userName,
      revocationReason: reason,
    };

    this.saveSignOffs(allSignOffs);
    logger.info('Sign-off revoked successfully');
  }

  /**
   * Get sign-off history for a transaction
   */
  getSignOffHistory(transactionId: string): SearchSignOff[] {
    const allSignOffs = this.getAllSignOffs();
    return allSignOffs
      .filter(so => so.transactionId === transactionId)
      .sort((a, b) => new Date(b.signedOffAt).getTime() - new Date(a.signedOffAt).getTime());
  }

  // ═══════════════════════════════════════════════════════════════
  // PROGRESS CALCULATION
  // ═══════════════════════════════════════════════════════════════

  /**
   * Calculate searches progress for a transaction
   */
  calculateProgress(transactionId: string): SearchesProgress {
    const searches = this.updateExpiredStatuses(transactionId);
    const signOff = this.getActiveSignOff(transactionId);
    const essentialTypes = getEssentialSearchTypes();

    const uploadedSearches = searches.filter(s => s.status === 'uploaded' || s.status === 'verified');
    const verifiedSearches = searches.filter(s => s.status === 'verified');
    const expiredSearches = searches.filter(s => s.status === 'expired');

    // Count essential searches uploaded
    const essentialSearchesUploaded = essentialTypes.filter(et =>
      uploadedSearches.some(s => s.searchType === et.id)
    ).length;

    // Calculate progress percentage
    let progressPercentage = 0;
    let statusLabel = 'Not Started';

    if (signOff) {
      progressPercentage = 100;
      statusLabel = 'Signed Off';
    } else if (uploadedSearches.length > 0) {
      // Base progress on essential searches (80% max without sign-off)
      const essentialProgress = (essentialSearchesUploaded / essentialTypes.length) * 80;
      progressPercentage = Math.min(essentialProgress, 80);

      if (essentialSearchesUploaded === essentialTypes.length) {
        statusLabel = 'Pending Sign-Off';
      } else {
        statusLabel = 'In Progress';
      }
    }

    return {
      hasAnySearches: searches.length > 0,
      uploadedCount: uploadedSearches.length,
      essentialSearchesUploaded,
      essentialSearchesTotal: essentialTypes.length,
      verifiedCount: verifiedSearches.length,
      expiredCount: expiredSearches.length,
      isSignedOff: !!signOff,
      signOff,
      progressPercentage,
      statusLabel,
    };
  }
}

// Export singleton instance
export const searchService = new SearchService();
