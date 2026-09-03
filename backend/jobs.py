"""轻量文件任务队列：V1 不依赖 Redis，任务以 JSON 文件落在 DATA_DIR/jobs。

worker 单并发消费；P0 引入 Redis 后可将本模块替换为 Redis 队列，接口保持不变。
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

try:
    from . import storage
except ImportError:
    import storage


def _jobs_dir() -> Path:
    directory = storage.ensure_dirs() / "jobs"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def enqueue(job_type: str, payload: dict) -> dict:
    job = {
        "id": str(uuid4()),
        "type": job_type,
        "payload": payload,
        "status": "pending",
        "result": None,
        "error": None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "startedAt": None,
        "finishedAt": None,
    }
    path = _jobs_dir() / f"{job['id']}.json"
    path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
    return job


def claim_next() -> dict | None:
    """原子领取一个 pending 任务（单 worker 单并发，rename 实现认领）。"""
    for path in sorted(_jobs_dir().glob("*.json")):
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue
        if job.get("status") != "pending":
            continue
        job["status"] = "running"
        job["startedAt"] = datetime.now(timezone.utc).isoformat()
        path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")
        return job
    return None


def finish(job: dict, status: str, result=None, error=None) -> None:
    job["status"] = status
    job["result"] = result
    job["error"] = error
    job["finishedAt"] = datetime.now(timezone.utc).isoformat()
    path = _jobs_dir() / f"{job['id']}.json"
    path.write_text(json.dumps(job, ensure_ascii=False), encoding="utf-8")


def list_jobs(limit: int = 50) -> list[dict]:
    items = []
    for path in sorted(_jobs_dir().glob("*.json"), reverse=True)[:limit]:
        try:
            items.append(json.loads(path.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return items
