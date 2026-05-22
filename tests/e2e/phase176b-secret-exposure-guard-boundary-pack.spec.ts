import { test, expect } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  isSecretExposureSafe,
  scanForSecretExposure,
} from "../../backend/security/secretExposureGuard";

const projectRoot = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(path.join(projectRoot, relativePath), "utf8");

const readIfExists = (relativePath: string): string => {
  const fullPath = path.join(projectRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : "";
};

test.describe("phase176b secret exposure guard boundary pack", () => {
  test("secret exposure guard flags service role frontend env public url storage and private key exposure", async () => {
    const unsafe = scanForSecretExposure({
      context: "frontend_source",
      content: `
        const key = "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE";
        const client = createClient(url, key);
        client.storage.from("exports");
        getPublicUrl("artifact.mp4");
        -----BEGIN PRIVATE KEY-----
      `,
    });

    expect(unsafe.kind).toBe("unsafe");
    expect(unsafe.safeToExpose).toBe(false);

    if (unsafe.kind !== "unsafe") {
      throw new Error("Expected unsafe decision");
    }

    expect(unsafe.findings.map((finding) => finding.kind)).toEqual(
      expect.arrayContaining([
        "service_role_reference",
        "frontend_service_role_env",
        "public_url_generation",
        "direct_frontend_storage",
        "suspicious_private_key",
      ]),
    );
  });

  test("secret exposure guard allows backend mediated safe descriptor and signed url boundary text", async () => {
    const safe = scanForSecretExposure({
      context: "backend_source",
      content: `
        signedUrlDeliveryProvider.generateSignedUrl({
          artifactId,
          storageRef,
        });
        response.status(200).json({
          kind: "artifact_delivery_ready",
          deliveryMode: signedUrlResult.deliveryMode,
          signedUrl: signedUrlResult.signedUrl,
        });
      `,
    });

    expect(safe).toEqual({
      kind: "safe",
      findings: [],
      safeToExpose: true,
    });

    expect(isSecretExposureSafe(safe)).toBe(true);
  });

  test("secret exposure guard boundary is not route wired and frontend remains free of direct storage secrets", async () => {
    const guardSource = readSource("backend/security/secretExposureGuard.ts");
    const routeSource = readSource("backend/routes/exports.ts");

    const frontendSource =
      readSource("src/services/artifactDeliveryDescriptorService.ts") +
      "\n" +
      readSource("src/store/artifactDeliveryDescriptorStore.ts") +
      "\n" +
      readSource("src/services/artifactDownloadNavigationStrategy.ts") +
      "\n" +
      readSource("src/components/ArtifactDeliveryDescriptorAction.tsx") +
      "\n" +
      readSource("src/components/ArtifactDownloadAction.tsx") +
      "\n" +
      readIfExists("src/services/supabaseClient.ts") +
      "\n" +
      readIfExists("src/lib/supabase.ts");

    expect(guardSource).toContain("scanForSecretExposure");
    expect(guardSource).toContain("isSecretExposureSafe");
    expect(guardSource).toContain("safeToExpose: false");

    expect(routeSource).not.toContain("scanForSecretExposure");
    expect(routeSource).not.toContain("secretExposureGuard");

    expect(frontendSource).not.toContain("@supabase/supabase-js");
    expect(frontendSource).not.toContain("createClient(");
    expect(frontendSource).not.toContain(".storage.from(");
    expect(frontendSource).not.toContain("SERVICE_ROLE");
    expect(frontendSource).not.toContain("service_role");
    expect(frontendSource).not.toContain("SUPABASE_SERVICE_ROLE");
    expect(frontendSource).not.toContain("getPublicUrl");
  });
});
