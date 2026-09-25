// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Centralized Zod Validation Schemas Library
 *
 * This file provides comprehensive input validation schemas for all user-facing
 * forms and endpoints across the PropXchain platform.
 *
 * IMPORTANT SECURITY PATTERNS:
 * - Always use .safeParse() instead of .parse() (non-throwing)
 * - Use .min(1) instead of deprecated .nonempty()
 * - Leverage z.infer<> for automatic TypeScript types
 * - All validation must occur BEFORE data reaches backend canisters
 */

import { z } from 'zod';

// ============================================================================
// AUTHENTICATION & REGISTRATION SCHEMAS
// ============================================================================

/**
 * User Type Enum - Must match backend user_management canister roles
 */
export const UserTypeSchema = z.enum(['buyer', 'seller', 'solicitor', 'platform_admin']);

/**
 * Principal ID Validation - Internet Computer Principal format
 * Format: alphanumeric with hyphens, 5-63 characters
 */
export const PrincipalSchema = z
  .string()
  .min(5, 'Principal ID must be at least 5 characters')
  .max(63, 'Principal ID must not exceed 63 characters')
  .regex(
    /^[a-z0-9-]+$/,
    'Principal ID must contain only lowercase letters, numbers, and hyphens'
  );

/**
 * Email Validation - RFC 5322 compliant
 */
export const EmailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters')
  .toLowerCase()
  .trim();

/**
 * User Registration Form Schema
 * Used in RegisterPage for new user signup
 */
export const RegistrationFormSchema = z.object({
  email: EmailSchema,
  principal: PrincipalSchema,
  userType: UserTypeSchema,
  firmName: z.string().max(200, 'Firm name must not exceed 200 characters').optional(),
  licenseNumber: z.string().max(50, 'License number must not exceed 50 characters').optional(),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must not exceed 100 characters').optional(),
  phoneNumber: z
    .string()
    .regex(/^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/, 'Invalid UK phone number format')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500, 'Address must not exceed 500 characters').optional()
});

export type RegistrationFormData = z.infer<typeof RegistrationFormSchema>;

/**
 * Login Form Schema
 * Used in LoginPage for authentication
 */
export const LoginFormSchema = z.object({
  email: EmailSchema,
  principal: PrincipalSchema.optional()
});

export type LoginFormData = z.infer<typeof LoginFormSchema>;

/**
 * User Profile Update Schema
 */
export const UserProfileUpdateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name must not exceed 100 characters'),
  email: EmailSchema,
  phoneNumber: z
    .string()
    .regex(/^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/, 'Invalid UK phone number format')
    .optional()
    .or(z.literal('')),
  firmName: z.string().max(200, 'Firm name must not exceed 200 characters').optional(),
  licenseNumber: z.string().max(50, 'License number must not exceed 50 characters').optional(),
  address: z.string().max(500, 'Address must not exceed 500 characters').optional()
});

export type UserProfileUpdateData = z.infer<typeof UserProfileUpdateSchema>;

// ============================================================================
// DOCUMENT UPLOAD SCHEMAS
// ============================================================================

/**
 * Allowed MIME types for document uploads
 */
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.ms-excel', // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
] as const;

/**
 * Maximum file size: 10MB (GDPR-compliant - we store hashes only)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes

/**
 * File Name Validation - Prevent path traversal attacks
 */
export const FileNameSchema = z
  .string()
  .min(1, 'File name is required')
  .max(255, 'File name must not exceed 255 characters')
  .regex(/^[a-zA-Z0-9_\-.\s]+$/, 'File name contains invalid characters')
  .refine((name) => !name.includes('..'), 'File name cannot contain path traversal sequences')
  .refine((name) => !name.startsWith('.'), 'File name cannot start with a dot');

/**
 * Document Type Schema - Must match documentTypes.ts constants
 */
export const DocumentTypeSchema = z.enum([
  'Proof of Identity',
  'Proof of Address',
  'Proof of Funds',
  'Mortgage Agreement',
  'Title Deeds',
  'Energy Performance Certificate',
  'TA6 Property Information Form',
  'TA10 Fittings & Contents Form',
  'Solicitor License',
  'Professional Indemnity Insurance',
  'AML Certificate',
  'Survey Report',
  'Land Registry Confirmation'
]);

/**
 * Document Upload Schema
 * Used in DocumentsPage for file upload validation
 */
export const DocumentUploadSchema = z.object({
  fileName: FileNameSchema,
  fileSize: z
    .number()
    .positive('File size must be positive')
    .max(MAX_FILE_SIZE, `File size must not exceed ${MAX_FILE_SIZE / 1024 / 1024}MB`),
  mimeType: z
    .string()
    .refine(
      (type) => ALLOWED_MIME_TYPES.includes(type as any),
      `File type not allowed. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`
    ),
  documentType: DocumentTypeSchema,
  description: z.string().max(1000, 'Description must not exceed 1000 characters').optional(),
  hash: z
    .string()
    .length(64, 'SHA-256 hash must be exactly 64 characters')
    .regex(/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash format')
    .optional() // Hash is generated client-side, optional in initial validation
});

export type DocumentUploadData = z.infer<typeof DocumentUploadSchema>;

/**
 * Document Hash Validation Schema
 * Used for verifying document integrity
 */
export const DocumentHashSchema = z
  .string()
  .length(64, 'SHA-256 hash must be exactly 64 characters')
  .regex(/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash format');

export type DocumentHash = z.infer<typeof DocumentHashSchema>;

// ============================================================================
// URI & URL VALIDATION SCHEMAS
// ============================================================================

/**
 * URI Validation - Prevent injection and path traversal attacks
 * Allows only safe URI characters and validates structure
 */
export const URISchema = z
  .string()
  .min(1, 'URI is required')
  .max(2048, 'URI must not exceed 2048 characters')
  .regex(
    /^[a-zA-Z0-9_\-./:]+$/,
    'URI contains invalid characters'
  )
  .refine((uri) => !uri.includes('..'), 'URI cannot contain path traversal sequences')
  .refine((uri) => !uri.includes('//'), 'URI cannot contain double slashes (except protocol)')
  .refine((uri) => {
    // Allow http://, https://, or relative paths
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return true;
    }
    // Relative paths should not start with /
    return !uri.startsWith('/');
  }, 'Invalid URI format');

/**
 * URL Validation - Strict validation for external URLs
 */
export const URLSchema = z
  .string()
  .url('Invalid URL format')
  .refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch {
        return false;
      }
    },
    'URL must use HTTP or HTTPS protocol'
  );

// ============================================================================
// TRANSACTION & PROPERTY SCHEMAS
// ============================================================================

/**
 * UK Postcode Validation
 */
export const PostcodeSchema = z
  .string()
  .regex(
    /^([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})$/i,
    'Invalid UK postcode format'
  )
  .transform((val) => val.toUpperCase().trim());

/**
 * UPRN (Unique Property Reference Number) Validation
 *
 * The canonical GB property identifier (Ordnance Survey / LLPG): an integer of
 * 1–12 digits. Optional everywhere — an empty or absent value is valid and
 * carries no error. A UPRN identifies the property, never the owner.
 */
export const UprnSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{1,12}$/.test(v), 'UPRN must be 1–12 digits')
  .optional();

export type Uprn = z.infer<typeof UprnSchema>;

/**
 * Property Address Schema
 */
export const PropertyAddressSchema = z.object({
  line1: z.string().min(1, 'Address line 1 is required').max(200, 'Address line 1 too long'),
  line2: z.string().max(200, 'Address line 2 too long').optional().or(z.literal('')),
  city: z.string().min(1, 'City is required').max(100, 'City name too long'),
  postcode: PostcodeSchema,
  country: z.string().default('United Kingdom')
});

export type PropertyAddress = z.infer<typeof PropertyAddressSchema>;

/**
 * Financial Amount Schema - GBP currency validation
 */
export const CurrencyAmountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(100000000, 'Amount exceeds maximum allowed (£100M)')
  .refine((amount) => Number.isFinite(amount), 'Amount must be a valid number')
  .refine(
    (amount) => {
      // Check for at most 2 decimal places (pence)
      const decimalPlaces = (amount.toString().split('.')[1] || '').length;
      return decimalPlaces <= 2;
    },
    'Amount must have at most 2 decimal places'
  );

/**
 * Transaction Mode Schema
 */
export const TransactionModeSchema = z.enum(['diy', 'hybrid', 'professional']);

/**
 * Property Type Schema
 */
export const PropertyTypeSchema = z.enum(['freehold', 'leasehold', 'shared-ownership', 'commonhold']);

/**
 * Transaction Creation Schema
 */
export const TransactionCreationSchema = z.object({
  propertyAddress: z.string().min(1, 'Property address is required').max(500, 'Address too long'),
  propertyType: PropertyTypeSchema,
  propertyCategory: z.enum(['residential', 'commercial']),
  mode: TransactionModeSchema,
  purchasePrice: CurrencyAmountSchema,
  deposit: CurrencyAmountSchema.optional(),
  hasMortgage: z.boolean().default(false),
  mortgageAmount: CurrencyAmountSchema.optional(),
  completionDate: z.string().min(1, 'Completion date is required'),
  titleNumber: z
    .string()
    .regex(/^[A-Z]{2}\d{6}$/, 'Invalid Land Registry title number format (e.g., AB123456)')
    .optional()
    .or(z.literal(''))
});

export type TransactionCreationData = z.infer<typeof TransactionCreationSchema>;

// ============================================================================
// FORM FIELD SCHEMAS (Reusable Components)
// ============================================================================

/**
 * Text Input Schema - General purpose text field
 */
export const TextInputSchema = z
  .string()
  .min(1, 'This field is required')
  .max(1000, 'Text must not exceed 1000 characters')
  .trim();

/**
 * Optional Text Area Schema
 */
export const TextAreaSchema = z
  .string()
  .max(5000, 'Text must not exceed 5000 characters')
  .optional()
  .or(z.literal(''));

/**
 * Boolean Checkbox Schema
 */
export const CheckboxSchema = z.boolean().default(false);

/**
 * Date Schema - ISO 8601 format
 */
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (expected YYYY-MM-DD)')
  .refine((date) => {
    const parsed = new Date(date);
    return !isNaN(parsed.getTime());
  }, 'Invalid date');

/**
 * Date-Time Schema - ISO 8601 format with time
 */
export const DateTimeSchema = z
  .string()
  .datetime({ message: 'Invalid date-time format (expected ISO 8601)' });

// ============================================================================
// CSRF TOKEN SCHEMA
// ============================================================================

/**
 * CSRF Token Validation
 * Validates synchronizer token pattern (64-character hex string)
 */
export const CSRFTokenSchema = z
  .string()
  .length(64, 'CSRF token must be exactly 64 characters')
  .regex(/^[a-f0-9]{64}$/, 'Invalid CSRF token format');

export type CSRFToken = z.infer<typeof CSRFTokenSchema>;

// ============================================================================
// SESSION STORAGE SCHEMAS
// ============================================================================

/**
 * Session Expiry Timestamp Schema
 * Validates Unix timestamp for session expiration
 */
export const SessionExpirySchema = z
  .number()
  .int('Session expiry must be an integer')
  .positive('Session expiry must be positive')
  .refine(
    (timestamp) => timestamp > Date.now(),
    'Session has expired'
  );

/**
 * Session Data Schema - Complete session storage validation
 */
export const SessionDataSchema = z.object({
  principalId: PrincipalSchema,
  isAuthenticated: z.literal('true'),
  sessionExpiry: SessionExpirySchema,
  csrfToken: CSRFTokenSchema.optional(),
  userType: UserTypeSchema.optional()
});

export type SessionData = z.infer<typeof SessionDataSchema>;

// ============================================================================
// HELPER VALIDATION FUNCTIONS
// ============================================================================

/**
 * Safe Parse Wrapper - Returns typed result or null
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validated data or null on failure
 */
export function safeParse<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): z.infer<T> | null {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  }
  return null;
}

/**
 * Validate and Get Errors - Returns validation errors array
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Array of error messages or empty array on success
 */
export function getValidationErrors<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): string[] {
  const result = schema.safeParse(data);
  if (result.success) {
    return [];
  }
  return result.error.issues.map((err) => err.message);
}

/**
 * Validate Form Field - Single field validation with error message
 *
 * @param schema - Zod schema to validate against
 * @param value - Field value to validate
 * @returns Error message or null on success
 */
export function validateField<T extends z.ZodTypeAny>(
  schema: T,
  value: unknown
): string | null {
  const result = schema.safeParse(value);
  if (result.success) {
    return null;
  }
  return result.error.issues[0]?.message || 'Validation failed';
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserType = z.infer<typeof UserTypeSchema>;
export type Principal = z.infer<typeof PrincipalSchema>;
export type Email = z.infer<typeof EmailSchema>;
export type FileName = z.infer<typeof FileNameSchema>;
export type DocumentType = z.infer<typeof DocumentTypeSchema>;
export type URI = z.infer<typeof URISchema>;
export type URL = z.infer<typeof URLSchema>;
export type Postcode = z.infer<typeof PostcodeSchema>;
export type CurrencyAmount = z.infer<typeof CurrencyAmountSchema>;
export type TransactionMode = z.infer<typeof TransactionModeSchema>;
export type PropertyType = z.infer<typeof PropertyTypeSchema>;
