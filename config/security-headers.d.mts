// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

export declare const CONTENT_SECURITY_POLICY: string

export declare const DEV_CONTENT_SECURITY_POLICY: string

export declare const INLINE_SCRIPT_HASHES: string[]

export declare const SECURITY_HEADERS: {
  'Content-Security-Policy': string
  'X-Frame-Options': string
  'Strict-Transport-Security': string
  'X-Content-Type-Options': string
  'Referrer-Policy': string
  'Permissions-Policy': string
}

export declare const DEV_SECURITY_HEADERS: typeof SECURITY_HEADERS
