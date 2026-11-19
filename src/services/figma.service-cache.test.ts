import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import type { GetFileResponse } from "@figma/rest-api-spec";
import { FigmaService, type FigmaAuthOptions } from "./figma.js";

const AUTH_OPTIONS: FigmaAuthOptions = {
  figmaApiKey: "test-key",
  figmaOAuthToken: "",
  useOAuth: false,
};

function createSampleFile(): GetFileResponse {
  return {
    name: "Sample",
    lastModified: new Date().toISOString(),
    thumbnailUrl: "",
    version: "1",
    role: "viewer",
    editorType: "figma",
    schemaVersion: 0,
    components: {},
    componentSets: {},
    styles: {},
    document: {
      id: "0:0",
      name: "Document",
      type: "DOCUMENT",
      children: [
        {
          id: "10:20",
          name: "Page",
          type: "CANVAS",
          children: [
            {
              id: "11:22",
              name: "Frame",
              type: "FRAME",
              children: [],
            },
          ],
        },
      ],
    },
  } as unknown as GetFileResponse;
}

async function createCacheDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "figma-service-cache-test-"));
}

async function cleanup(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

describe("FigmaService caching", () => {
  it("reuses cached files for repeated getRawFile calls", async () => {
    const cacheDir = await createCacheDir();
    const sample = createSampleFile();
    const requestSpy = spyOnRequest().mockResolvedValue(sample);

    try {
      const service = new FigmaService(AUTH_OPTIONS, { cacheDir, ttlMs: 60_000 });
      const first = await service.getRawFile("FILE123");
      const second = await service.getRawFile("FILE123");

      expect(first.data.name).toBe("Sample");
      expect(second.data.document.id).toBe("0:0");
      expect(requestSpy).toHaveBeenCalledTimes(1);
    } finally {
      requestSpy.mockRestore();
      await cleanup(cacheDir);
    }
  });

  it("serves node lookups from cached file without extra API calls", async () => {
    const cacheDir = await createCacheDir();
    const sample = createSampleFile();
    const requestSpy = spyOnRequest().mockResolvedValue(sample);

    try {
      const service = new FigmaService(AUTH_OPTIONS, { cacheDir, ttlMs: 60_000 });
      const nodeId = "10:20";

      const first = await service.getRawNode("FILE456", nodeId);
      expect(first.data.nodes[nodeId]).toBeDefined();
      expect(requestSpy).toHaveBeenCalledTimes(1);

      await service.getRawNode("FILE456", nodeId);
      expect(requestSpy).toHaveBeenCalledTimes(1);
    } finally {
      requestSpy.mockRestore();
      await cleanup(cacheDir);
    }
  });

  it("falls back to the next PAT on authentication or quota errors", async () => {
    const originalFetch = globalThis.fetch;
    const seenKeys: string[] = [];

    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      const key = headers?.["X-Figma-Token"] || "";
      seenKeys.push(key);

      if (key === "first-key") {
        return new Response(JSON.stringify({ status: 401 }), {
          status: 401,
          statusText: "Unauthorized",
        });
      }

      return new Response(
        JSON.stringify({
          name: "Fallback result",
          document: { id: "0:0", type: "DOCUMENT", name: "Document", children: [] },
        }),
        { status: 200, statusText: "OK" },
      );
    }) as typeof fetch;

    try {
      const service = new FigmaService({
        figmaApiKey: "first-key",
        figmaOAuthToken: "",
        useOAuth: false,
        figmaApiKeys: ["first-key", "second-key"],
      });

      await service.getRawFile("ROTATION_TEST");

      expect(seenKeys).toEqual(["first-key", "second-key"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to the next PAT on quota limit 429", async () => {
    const originalFetch = globalThis.fetch;
    const seenKeys: string[] = [];

    globalThis.fetch = jest.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string>;
      const key = headers?.["X-Figma-Token"] || "";
      seenKeys.push(key);

      if (key === "limited-key") {
        return new Response(JSON.stringify({ status: 429 }), {
          status: 429,
          statusText: "Too Many Requests",
        });
      }

      return new Response(
        JSON.stringify({
          name: "Quota fallback",
          document: { id: "0:0", type: "DOCUMENT", name: "Document", children: [] },
        }),
        { status: 200, statusText: "OK" },
      );
    }) as typeof fetch;

    try {
      const service = new FigmaService({
        figmaApiKey: "limited-key",
        figmaOAuthToken: "",
        useOAuth: false,
        figmaApiKeys: ["limited-key", "available-key"],
      });

      await service.getRawFile("QUOTA_ROTATION_TEST");
      expect(seenKeys).toEqual(["limited-key", "available-key"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
function spyOnRequest() {
  return jest.spyOn(
    FigmaService.prototype as unknown as {
      request: (endpoint: string) => Promise<unknown>;
    },
    "request",
  );
}
