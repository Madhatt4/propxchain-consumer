// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The body to hand supabase.storage.upload: the file's bytes, not the File.
 *
 * Given a File, supabase-js wraps it in multipart FormData, and iOS Safari
 * dropped that request after its preflight ("Load failed") when Marc attached
 * a photo to TA6 5.2 on 2026-10-15: the OPTIONS reached Supabase, the POST
 * never did. Raw bytes go as a plain body with the content type in a header,
 * which is the path every browser sends reliably.
 */
export async function uploadBody(file: Blob): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}
