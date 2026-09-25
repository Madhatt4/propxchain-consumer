// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useCallback, useRef } from 'react';
import { SearchUploadData } from '../../types/searches';
import { getSearchTypeById, getAllSearchTypes, calculateExpiryDate } from '../../utils/searchTypes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { logger } from '@/utils/logger';

interface SearchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (data: SearchUploadData) => Promise<void>;
  preselectedSearchType?: string;
  existingSearchTypes?: string[]; // Already uploaded search types for duplicate warning
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

const SearchUploadModal: React.FC<SearchUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  preselectedSearchType,
  existingSearchTypes = [],
}) => {
  const [selectedSearchType, setSelectedSearchType] = useState<string>(preselectedSearchType || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchDate, setSearchDate] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchTypes = getAllSearchTypes();
  const selectedTypeInfo = selectedSearchType ? getSearchTypeById(selectedSearchType) : null;
  const isDuplicate = existingSearchTypes.includes(selectedSearchType);

  // Calculate expected expiry date
  const expectedExpiry = selectedSearchType && searchDate
    ? calculateExpiryDate(searchDate, selectedSearchType)
    : null;

  // File validation
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return 'Please upload a PDF, JPG, or PNG file';
    }
    if (file.size > maxFileSize) {
      return 'File size must be less than 10MB';
    }
    return null;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setUploadState(prev => ({ ...prev, error }));
        return;
      }
      setSelectedFile(file);
      setUploadState(prev => ({ ...prev, error: null }));
    }
    // Reset input to allow re-selecting the same file
    event.target.value = '';
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const file = event.dataTransfer.files[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        setUploadState(prev => ({ ...prev, error }));
        return;
      }
      setSelectedFile(file);
      setUploadState(prev => ({ ...prev, error: null }));
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    if (!uploadState.isUploading) {
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async () => {
    if (!selectedSearchType || !selectedFile || !searchDate) {
      setUploadState(prev => ({
        ...prev,
        error: 'Please fill in all required fields',
      }));
      return;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
    });

    try {
      await onUpload({
        searchType: selectedSearchType,
        file: selectedFile,
        searchDate,
        provider: provider || undefined,
        notes: notes || undefined,
      });

      // Reset form
      setSelectedSearchType('');
      setSelectedFile(null);
      setSearchDate('');
      setProvider('');
      setNotes('');
      setUploadState({
        isUploading: false,
        progress: 0,
        error: null,
      });

      onClose();
    } catch (error) {
      logger.error('Upload error:', error);
      setUploadState({
        isUploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : 'Upload failed. Please try again.',
      });
    }
  };

  const handleClose = () => {
    if (!uploadState.isUploading) {
      setUploadState({ isUploading: false, progress: 0, error: null });
      setSelectedFile(null);
      onClose();
    }
  };

  // Reset preselected type when modal opens
  React.useEffect(() => {
    if (isOpen && preselectedSearchType) {
      setSelectedSearchType(preselectedSearchType);
    }
  }, [isOpen, preselectedSearchType]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload Property Search</DialogTitle>
          <DialogDescription>
            Upload a search document to register its hash on the blockchain for verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="searchType">
              Search Type <span className="text-red-500">*</span>
            </Label>
            <select
              id="searchType"
              value={selectedSearchType}
              onChange={(e) => setSelectedSearchType(e.target.value)}
              disabled={uploadState.isUploading || !!preselectedSearchType}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <option value="">Select a search type...</option>
              <optgroup label="Essential Searches">
                {searchTypes.filter(st => st.category === 'essential').map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </optgroup>
              <optgroup label="Location-Specific Searches">
                {searchTypes.filter(st => st.category === 'location-specific').map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </optgroup>
              <optgroup label="Optional Searches">
                {searchTypes.filter(st => st.category === 'optional').map(st => (
                  <option key={st.id} value={st.id}>{st.name}</option>
                ))}
              </optgroup>
            </select>
            {isDuplicate && (
              <p className="text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                A search of this type already exists. Uploading will replace it.
              </p>
            )}
          </div>

          {/* Search Date */}
          <div className="space-y-2">
            <Label htmlFor="searchDate">
              Search Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id="searchDate"
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              disabled={uploadState.isUploading}
              max={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              The date when the search was conducted
            </p>
            {expectedExpiry && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Valid until: {new Date(expectedExpiry).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label htmlFor="provider">
              Search Provider (optional)
            </Label>
            <Input
              id="provider"
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={uploadState.isUploading}
              placeholder="e.g., TM Group, SearchFlow, Local Council"
            />
          </div>

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>
              Document File <span className="text-red-500">*</span>
            </Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragOver ? "border-gray-400 bg-gray-100 dark:bg-gray-800/20" : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500",
                uploadState.isUploading && "opacity-50 cursor-not-allowed"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleClick}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                disabled={uploadState.isUploading}
              />

              {uploadState.isUploading ? (
                <div className="space-y-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500 mx-auto"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Uploading...</p>
                </div>
              ) : selectedFile ? (
                <div className="space-y-2">
                  <svg className="mx-auto h-8 w-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="mx-auto h-8 w-8 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {isDragOver ? 'Drop file here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      PDF, JPG, PNG up to 10MB
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes (optional)
            </Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={uploadState.isUploading}
              placeholder="Any additional notes about this search..."
              rows={2}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
            />
          </div>

          {/* Error Message */}
          {uploadState.error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md">
              <p className="text-sm text-red-700 dark:text-red-400">{uploadState.error}</p>
            </div>
          )}

          {/* Search Type Info */}
          {selectedTypeInfo && (
            <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{selectedTypeInfo.description}</p>
              <div className="flex flex-wrap gap-x-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Typical turnaround: {selectedTypeInfo.typicalTurnaround}</span>
                {selectedTypeInfo.estimatedCost && (
                  <span>Est. cost: {selectedTypeInfo.estimatedCost}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={uploadState.isUploading}
          >
            Cancel
          </Button>
          <Button
            className="bg-gray-700 hover:bg-gray-600"
            onClick={handleSubmit}
            disabled={uploadState.isUploading || !selectedSearchType || !selectedFile || !searchDate}
          >
            {uploadState.isUploading ? 'Uploading...' : 'Upload Search'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SearchUploadModal;
