
import { supabase } from "@/lib/supabaseClient"

/**
 * Helper to get a signed URL for a file in the 'images' bucket.
 * Handles both full public URLs (by extracting the path) and relative paths.
 * Returns the signed URL or the original string if generation fails.
 */
export const getSignedUrl = async (pathOrUrl) => {
    if (!pathOrUrl) return null

    let path = pathOrUrl

    // Check if it's a full Supabase Public URL
    // Example: https://<project>.supabase.co/storage/v1/object/public/images/folder/file.jpg
    if (pathOrUrl.startsWith('http')) {
        if (pathOrUrl.includes('/storage/v1/object/public/images/')) {
            path = pathOrUrl.split('/storage/v1/object/public/images/')[1]
        } else {
            // Not a standard public URL for 'images' bucket, return as is (might be external)
            return pathOrUrl
        }
    }

    if (!path) return pathOrUrl

    try {
        const { data, error } = await supabase.storage
            .from('images') // Assumption: bucket is always 'images' as per user context
            .createSignedUrl(path, 3600) // 1 hour expiry

        if (error) {
            console.warn("Error creating signed URL:", error)
            return pathOrUrl
        }

        return data?.signedUrl || pathOrUrl
    } catch (err) {
        console.error("Exception creating signed URL:", err)
        return pathOrUrl
    }
}
