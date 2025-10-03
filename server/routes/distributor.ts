import type { RequestHandler } from "express";
import { AuthedRequest, requireUser } from "../auth";
import { db, DistributionJob, newId } from "../store";
import { JobModel } from "../db";

function computeQueue(ownerJob: DistributionJob) {
  const queue: { lineNumber: number; line: string; userId: string; status: "sent" | "pending" | "failed"; sentAt?: number }[] = [];
  const T = ownerJob.targets.length || 1;
  const L = ownerJob.linesPerTick;
  const round = T * L;
  for (let i = 0; i < ownerJob.textLines.length; i++) {
    const inRound = i % round;
    const targetIdx = Math.floor(inRound / L);
    const userId = ownerJob.targets[targetIdx] || ownerJob.targets[0];
    queue.push({ lineNumber: i + 1, line: ownerJob.textLines[i], userId, status: "pending" });
  }
  return queue;
}

async function persistProgress(job: DistributionJob, beforeIndex: number) {
  try {
    const afterIndex = job.nextIndex; // 0-based count of lines sent so far
    await JobModel.updateOne(
      { jobId: job.id },
      {
        $set: {
          nextIndex: job.nextIndex,
          status: job.status,
        },
        $currentDate: {},
      },
    ).exec();
    if (afterIndex > 0 && afterIndex > beforeIndex) {
      await JobModel.updateOne(
        { jobId: job.id },
        {
          $set: { "queue.$[e].status": "sent", "queue.$[e].sentAt": Date.now() },
        },
        { arrayFilters: [{ "e.lineNumber": { $lte: afterIndex } }] as any },
      ).exec();
    }
  } catch {}
}

function startTimer(job: DistributionJob) {
  const tick = async () => {
    if (job.status !== "running") return;
    const linesToSend = job.linesPerTick;
    if (job.nextIndex >= job.textLines.length) {
      job.status = "completed";
      if (job._timer) clearInterval(job._timer);
      job._timer = undefined as any;
      try {
        await JobModel.updateOne({ jobId: job.id }, { $set: { status: job.status } }).exec();
      } catch {}
      return;
    }
    const before = job.nextIndex;
    for (const targetId of job.targets) {
      const target = db.users.get(targetId);
      if (!target) continue;
      for (
        let i = 0;
        i < linesToSend && job.nextIndex < job.textLines.length;
        i++
      ) {
        const line = job.textLines[job.nextIndex++];
        const msgId = newId("msg");
        const msg = {
          id: msgId,
          text: line,
          fromId: job.ownerId,
          ts: Date.now(),
          readBy: [],
          conversationId: undefined,
        };
        target.inbox.push(msg);
        db.messages.set(msgId, msg);
      }
    }
    await persistProgress(job, before);
  };
  job._timer = setInterval(tick, job.intervalSec * 1000);
}

export const createJob: RequestHandler = async (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res, "admin")) return;
  const { text, intervalSec, linesPerTick, targetIds } = req.body || {};
  const validLines = [1, 3, 5, 7, 10, 12, 15];
  if (typeof text !== "string" || !text.trim())
    return res.status(400).json({ error: "Invalid text" });

  const iSec = Number(intervalSec);
  if (!Number.isInteger(iSec) || iSec < 1 || iSec > 300)
    return res.status(400).json({ error: "Invalid interval" });

  if (!validLines.includes(Number(linesPerTick)))
    return res.status(400).json({ error: "Invalid linesPerTick" });
  const targets: string[] = Array.isArray(targetIds) ? targetIds : [];
  if (!targets.length) return res.status(400).json({ error: "No targets" });
  const textLines = text.replace(/\r\n/g, "\n").split("\n");
  const id = newId("job");
  const job: DistributionJob = {
    id,
    ownerId: areq.user!.id,
    createdAt: Date.now(),
    intervalSec: Number(intervalSec),
    linesPerTick: Number(linesPerTick),
    targets,
    textLines,
    nextIndex: 0,
    status: "running",
  };
  db.jobs.set(id, job);
  try {
    const queue = computeQueue(job);
    await JobModel.create({
      jobId: id,
      ownerId: job.ownerId,
      createdAt: job.createdAt,
      intervalSec: job.intervalSec,
      linesPerTick: job.linesPerTick,
      targets: job.targets,
      textLines: job.textLines,
      nextIndex: job.nextIndex,
      status: job.status,
      queue,
    });
  } catch {}
  startTimer(job);
  res.json({ job: { ...job, _timer: undefined } });
};

export const listJobs: RequestHandler = (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res, "admin")) return;
  const jobs = Array.from(db.jobs.values())
    .filter((j) => j.ownerId === areq.user!.id)
    .map((j) => ({ ...j, _timer: undefined }));
  res.json({ jobs });
};

export const getJob: RequestHandler = async (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res, "admin")) return;
  const { id } = req.params;
  const job = id ? db.jobs.get(id) : undefined;
  if (!job || job.ownerId !== areq.user!.id)
    return res.status(404).json({ error: "Not found" });
  let queue: any[] | undefined;
  try {
    const doc = await JobModel.findOne({ jobId: job.id }).lean();
    queue = doc?.queue as any[] | undefined;
  } catch {}
  res.json({ job: { ...job, _timer: undefined, queue } });
};

export const cancelJob: RequestHandler = async (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res, "admin")) return;
  const { id } = req.params;
  const job = id ? db.jobs.get(id) : undefined;
  if (!job || job.ownerId !== areq.user!.id)
    return res.status(404).json({ error: "Not found" });
  if (job._timer) clearInterval(job._timer);
  job.status = "cancelled";
  job._timer = undefined as any;
  try {
    await JobModel.updateOne({ jobId: job.id }, { $set: { status: job.status, nextIndex: job.nextIndex } }).exec();
  } catch {}
  res.json({ job: { ...job, _timer: undefined } });
};

export const listQueues: RequestHandler = async (req, res) => {
  const areq = req as AuthedRequest;
  if (!requireUser(areq, res, "admin")) return;
  try {
    const docs = await JobModel.find({ ownerId: areq.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    const jobs = docs.map((d: any) => ({ id: d.jobId, status: d.status, queue: d.queue || [] }));
    res.json({ jobs });
  } catch (e) {
    res.status(500).json({ error: "Failed to load queues" });
  }
};
