"""磁盘存储层：资源二进制与发布产物落盘，数据库/内存只保留路径、hash 与元数据。

目录结构（需求第 8 章）：
    {DATA_DIR}/assets/        资源二进制（GLB/图片）
    {DATA_DIR}/releases/      发布产物 JSON，按项目分目录
    {DATA_DIR}/uploads-tmp/   上传临时目录，校验通过后原子移动到 assets
    {DATA_DIR}/backups/       迁移与备份快照
容器内 DATA_DIR=/data/3dvision；本地开发默认仓库根目录 ./data。
"""

import hashlib
import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

_SUBDIRS = ("assets", "releases", "uploads-tmp", "backups")


def data_root() -> Path:
    env_dir = os.getenv("DATA_DIR")
    if env_dir:
        root = Path(env_dir)
    else:
        # backend/storage.py → 仓库根/data
        root = Path(__file__).resolve().parent.parent / "data"
    return root


def ensure_dirs() -> Path:
    root = data_root()
    for sub in _SUBDIRS:
        (root / sub).mkdir(parents=True, exist_ok=True)
    return root


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _assets_dir() -> Path:
    return ensure_dirs() / "assets"


def _tmp_dir() -> Path:
    return ensure_dirs() / "uploads-tmp"


def asset_path(asset_id: str) -> Path:
    return _assets_dir() / f"{asset_id}.bin"


def save_asset_bytes(asset_id: str, data: bytes) -> dict:
    """先写 uploads-tmp 再原子替换到 assets，避免半成品文件被直接访问。"""
    ensure_dirs()
    final_path = asset_path(asset_id)
    tmp_path = _tmp_dir() / f"{asset_id}.part"
    with open(tmp_path, "wb") as handle:
        handle.write(data)
    os.replace(tmp_path, final_path)
    stat = final_path.stat()
    return {
        "path": str(final_path.relative_to(data_root())),
        "sha256": sha256_hex(data),
        "size": stat.st_size,
    }


def read_asset_bytes(asset_id: str) -> bytes | None:
    path = asset_path(asset_id)
    if not path.exists():
        return None
    return path.read_bytes()


def remove_asset_file(asset_id: str) -> bool:
    path = asset_path(asset_id)
    if path.exists():
        path.unlink()
        return True
    return False


def release_path(project_id: str, release_id: str) -> Path:
    directory = ensure_dirs() / "releases" / project_id
    directory.mkdir(parents=True, exist_ok=True)
    return directory / f"{release_id}.json"


def save_release_document(project_id: str, release_id: str, document: dict) -> str:
    """发布产物原子落盘，返回相对路径；发布失败不会留下半截文件。"""
    target = release_path(project_id, release_id)
    tmp = target.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as handle:
        json.dump(document, handle, ensure_ascii=False)
    os.replace(tmp, target)
    return str(target.relative_to(data_root()))


def read_release_document(project_id: str, release_id: str) -> dict | None:
    target = release_path(project_id, release_id)
    if not target.exists():
        return None
    return json.loads(target.read_text(encoding="utf-8"))


def backup_snapshot(name: str, payload: dict) -> str:
    directory = ensure_dirs() / "backups"
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    target = directory / f"{stamp}-{name}.json"
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False)
    return str(target)


def disk_usage():
    return shutil.disk_usage(ensure_dirs())
