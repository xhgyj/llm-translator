import { describe, expect, it } from "vitest";
import { BackfillStore } from "../src/backfill";

describe("BackfillStore", () => {
  it("creates pending jobs and resolves them by jobId", () => {
    const store = new BackfillStore();

    const job = store.create("placeholder-1");

    expect(job.jobId).toBeTypeOf("string");
    expect(job.placeholderId).toBe("placeholder-1");
    expect(job.status).toBe("pending");

    const resolved = store.resolve(job.jobId);

    expect(resolved?.jobId).toBe(job.jobId);
    expect(resolved?.status).toBe("resolved");
    expect(store.get(job.jobId)?.status).toBe("resolved");
  });

  it("marks pending jobs failed and keeps job tracking data", () => {
    const store = new BackfillStore();

    const job = store.create("placeholder-2");

    expect(job.status).toBe("pending");
    expect(store.get(job.jobId)).toMatchObject({
      jobId: job.jobId,
      placeholderId: "placeholder-2",
      status: "pending",
    });

    const failed = store.fail(job.jobId, new Error("upstream unavailable"));

    expect(failed?.jobId).toBe(job.jobId);
    expect(failed?.status).toBe("failed");
    expect(failed?.errorMessage).toBe("upstream unavailable");
    expect(store.get(job.jobId)).toMatchObject({
      jobId: job.jobId,
      placeholderId: "placeholder-2",
      status: "failed",
      errorMessage: "upstream unavailable",
    });
  });
});
