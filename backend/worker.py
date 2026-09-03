"""后台 worker：按需启动、模型任务单并发（需求第 8 章）。

V1 负责任务：
- asset_validate：上传资源的异步魔数/完整性校验；
- model_compress：模型压缩仅保留任务接口，V1 不实现压缩算法。

运行：python worker.py            持续轮询（间隔 2 秒）
      python worker.py --once     处理一个任务后退出（测试/迁移用）
"""

import argparse
import sys
import time

try:
    from . import jobs, storage
    from .asset_validation import validate_asset as validate_asset_bytes
except ImportError:
    import jobs
    import storage
    from asset_validation import validate_asset as validate_asset_bytes


def validate_asset(asset_id: str, content_type: str, filename: str = "asset") -> dict:
    data = storage.read_asset_bytes(asset_id)
    if data is None:
        raise FileNotFoundError(f"资源文件不存在：{asset_id}")
    normalized_mime, kind = validate_asset_bytes(data, filename, content_type)
    return {
        "assetId": asset_id,
        "bytes": len(data),
        "sha256": storage.sha256_hex(data),
        "mimeType": normalized_mime,
        "kind": kind,
    }


def process(job: dict) -> None:
    job_type = job["type"]
    payload = job.get("payload", {})
    if job_type == "asset_validate":
        result = validate_asset(
            payload["assetId"], payload.get("mimeType", ""), payload.get("filename", "asset")
        )
        jobs.finish(job, "done", result=result)
        return
    if job_type == "model_compress":
        # 模型压缩为后续版本能力，V1 仅登记任务并明确标记未实现，不伪造成功。
        jobs.finish(job, "failed", error="模型压缩将在后续版本提供，V1 仅支持内嵌动画控制")
        return
    jobs.finish(job, "failed", error=f"未知任务类型：{job_type}")


def run(once: bool = False, interval: float = 2.0) -> int:
    processed = 0
    while True:
        job = jobs.claim_next()
        if job is None:
            if once:
                return processed
            time.sleep(interval)
            continue
        try:
            process(job)
        except Exception as exc:  # 单个任务失败不拖垮 worker 进程
            jobs.finish(job, "failed", error=str(exc))
        processed += 1
        if once:
            return processed


def main() -> None:
    parser = argparse.ArgumentParser(description="3D Vision 后台 worker")
    parser.add_argument("--once", action="store_true", help="处理一个任务后退出")
    parser.add_argument("--interval", type=float, default=2.0)
    args = parser.parse_args()
    storage.ensure_dirs()
    count = run(once=args.once, interval=args.interval)
    print(f"worker finished, processed={count}", file=sys.stdout)


if __name__ == "__main__":
    main()
