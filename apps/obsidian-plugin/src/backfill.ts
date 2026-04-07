import { randomUUID } from "node:crypto";

export type BackfillStatus = "pending" | "resolved" | "failed";

export type BackfillJob = {
  jobId: string;
  placeholderId: string;
  status: BackfillStatus;
  translatedText?: string;
  errorMessage?: string;
};

export class BackfillStore {
  private readonly jobs = new Map<string, BackfillJob>();

  create(placeholderId: string): BackfillJob {
    const job: BackfillJob = {
      jobId: randomUUID(),
      placeholderId,
      status: "pending",
    };

    this.jobs.set(job.jobId, job);
    return job;
  }

  resolve(jobId: string, translatedText?: string): BackfillJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    job.status = "resolved";
    job.translatedText = translatedText;
    delete job.errorMessage;
    return job;
  }

  fail(jobId: string, error: unknown): BackfillJob | undefined {
    const job = this.jobs.get(jobId);
    if (!job) {
      return undefined;
    }

    job.status = "failed";
    job.errorMessage = error instanceof Error ? error.message : String(error);
    delete job.translatedText;
    return job;
  }

  get(jobId: string): BackfillJob | undefined {
    return this.jobs.get(jobId);
  }
}
