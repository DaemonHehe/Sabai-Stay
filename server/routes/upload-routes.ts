import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { formatZodError, requireAuth, requireRole } from "./route-helpers";
import { storage } from "../storage";
import { logEvent } from "../observability/logger";
import {
  getSupabaseAnonKey,
  getSupabaseServerKey,
  getSupabaseUrl,
} from "../supabase-config";

const LISTING_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const CONTRACT_DOCUMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const listingImageUploadRequestSchema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(8 * 1024 * 1024),
  listingId: z.string().optional(),
});

const contractDocumentUploadRequestSchema = z.object({
  contractId: z.string().min(1),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

const registerContractDocumentRequestSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().min(1).max(120),
  path: z.string().min(1),
});

let uploadClient: SupabaseClient | null | undefined;

function getUploadClient() {
  if (uploadClient !== undefined) {
    return uploadClient;
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey() ?? getSupabaseAnonKey();

  if (!supabaseUrl || !supabaseKey) {
    uploadClient = null;
    return uploadClient;
  }

  uploadClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return uploadClient;
}

function sanitizeFileName(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function assertAllowedContentType(
  contentType: string,
  allowlist: Set<string>,
  label: string,
) {
  if (!allowlist.has(contentType)) {
    throw new Error(`Unsupported ${label} content type: ${contentType}`);
  }
}

function buildPath(prefix: string, userId: string, fileName: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const cleanFileName = sanitizeFileName(fileName) || "file";
  return `${prefix}/${userId}/${year}/${month}/${randomUUID()}-${cleanFileName}`;
}

function ensureContractAccess(contract: Awaited<ReturnType<typeof storage.getContractById>>, userId: string) {
  if (!contract) {
    return {
      allowed: false,
      reason: "Contract not found",
      status: 404,
    } as const;
  }

  if (contract.ownerUserId !== userId && contract.studentUserId !== userId) {
    return {
      allowed: false,
      reason: "Forbidden",
      status: 403,
    } as const;
  }

  return {
    allowed: true,
  } as const;
}

export function registerUploadRoutes(app: Express) {
  app.post("/api/uploads/listing-images/signed-url", async (req, res) => {
    try {
      const actor = await requireRole(req, res, ["owner"]);
      if (!actor) {
        return;
      }

      const body = listingImageUploadRequestSchema.parse(req.body);
      assertAllowedContentType(
        body.contentType,
        LISTING_IMAGE_CONTENT_TYPES,
        "listing image",
      );

      if (body.listingId) {
        const listing = await storage.getListingById(body.listingId);
        if (!listing) {
          return res.status(404).json({ error: "Listing not found" });
        }
        if (listing.ownerUserId !== actor.userId) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const client = getUploadClient();
      if (!client) {
        return res.status(503).json({
          error:
            "Supabase upload client is not configured. Set SUPABASE_URL and a server key.",
        });
      }

      const bucket = process.env.LISTING_IMAGES_BUCKET ?? "listing-images";
      const path = buildPath("owners", actor.userId, body.fileName);
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUploadUrl(path, {
          upsert: false,
        });
      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create signed upload URL");
      }

      const publicUrl = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;

      return res.json({
        bucket,
        path,
        token: data.token,
        signedUploadUrl: data.signedUrl,
        assetUrl: publicUrl,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      logEvent("warn", "listing_image_upload_signature_failed", {
        requestId: req.requestId,
        error,
      });
      return res.status(400).json({
        error:
          error instanceof Error ? error.message : "Failed to prepare listing upload",
      });
    }
  });

  app.post("/api/uploads/contract-documents/signed-url", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) {
        return;
      }

      const body = contractDocumentUploadRequestSchema.parse(req.body);
      assertAllowedContentType(
        body.contentType,
        CONTRACT_DOCUMENT_CONTENT_TYPES,
        "contract document",
      );

      const contract = await storage.getContractById(body.contractId);
      const access = ensureContractAccess(contract, actor.userId);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.reason });
      }

      const client = getUploadClient();
      if (!client) {
        return res.status(503).json({
          error:
            "Supabase upload client is not configured. Set SUPABASE_URL and a server key.",
        });
      }

      const bucket =
        process.env.CONTRACT_DOCUMENTS_BUCKET ?? "contract-documents";
      const path = buildPath(
        `contracts/${body.contractId}`,
        actor.userId,
        body.fileName,
      );
      const signedUpload = await client.storage
        .from(bucket)
        .createSignedUploadUrl(path, {
          upsert: false,
        });
      if (signedUpload.error || !signedUpload.data) {
        throw new Error(
          signedUpload.error?.message ?? "Failed to create signed upload URL",
        );
      }

      const signedRead = await client.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60);
      if (signedRead.error || !signedRead.data) {
        throw new Error(
          signedRead.error?.message ?? "Failed to create signed read URL",
        );
      }

      return res.json({
        bucket,
        path,
        token: signedUpload.data.token,
        signedUploadUrl: signedUpload.data.signedUrl,
        signedReadUrl: signedRead.data.signedUrl,
        expiresInSeconds: 60 * 60,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      logEvent("warn", "contract_document_upload_signature_failed", {
        requestId: req.requestId,
        error,
      });
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare contract document upload",
      });
    }
  });

  app.post("/api/contracts/:id/documents", async (req, res) => {
    try {
      const actor = await requireAuth(req, res);
      if (!actor) {
        return;
      }

      const contract = await storage.getContractById(req.params.id);
      const access = ensureContractAccess(contract, actor.userId);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.reason });
      }

      const body = registerContractDocumentRequestSchema.parse(req.body);
      const client = getUploadClient();
      if (!client) {
        return res.status(503).json({
          error:
            "Supabase upload client is not configured. Set SUPABASE_URL and a server key.",
        });
      }

      const bucket =
        process.env.CONTRACT_DOCUMENTS_BUCKET ?? "contract-documents";
      const signedRead = await client.storage
        .from(bucket)
        .createSignedUrl(body.path, 60 * 60);
      if (signedRead.error || !signedRead.data) {
        throw new Error(
          signedRead.error?.message ?? "Failed to create signed read URL",
        );
      }

      const insert = await client
        .from("contract_documents")
        .insert({
          contract_id: req.params.id,
          name: body.name,
          type: body.type,
          file_url: `storage://${bucket}/${body.path}`,
        })
        .select("id, name, type, uploaded_at")
        .single();
      if (insert.error || !insert.data) {
        throw new Error(
          insert.error?.message ?? "Failed to register contract document",
        );
      }

      return res.status(201).json({
        id: insert.data.id,
        name: insert.data.name,
        type: insert.data.type,
        uploadedAt: insert.data.uploaded_at,
        fileUrl: signedRead.data.signedUrl,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: formatZodError(error) });
      }
      logEvent("warn", "contract_document_registration_failed", {
        requestId: req.requestId,
        contractId: req.params.id,
        error,
      });
      return res.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to register contract document",
      });
    }
  });
}
