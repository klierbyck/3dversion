"""部署迁移与目录自检脚本。

职责（V1，文件存储阶段）：
1. 创建 DATA_DIR 下 assets/releases/uploads-tmp/backups 目录；
2. 统计磁盘上的资源与发布产物，校验发布 JSON 可解析；
3. --recheck 时对全部资源做格式校验，输出异常清单。

用法：
    python migrate.py            初始化目录并输出统计
    python migrate.py --recheck  额外重验全部资源
"""

import argparse
import json
import sys

try:
    from . import storage
    from .worker import validate_asset
except ImportError:
    import storage
    from worker import validate_asset


def collect_asset_meta() -> dict:
    """磁盘级统计；项目与资源元数据索引保存在 projects.json。"""
    assets_dir = storage.ensure_dirs() / "assets"
    files = list(assets_dir.glob("*.bin"))
    return {"assetFiles": len(files), "assetBytes": sum(f.stat().st_size for f in files)}


def check_releases() -> tuple[int, list[str]]:
    root = storage.data_root() / "releases"
    ok = 0
    errors = []
    if not root.exists():
        return ok, errors
    for path in root.rglob("*.json"):
        try:
            doc = json.loads(path.read_text(encoding="utf-8"))
            if not doc.get("id") or "scene" not in doc:
                errors.append(f"{path.name}: 缺少 id/scene 字段")
            else:
                ok += 1
        except json.JSONDecodeError as exc:
            errors.append(f"{path.name}: JSON 解析失败 {exc}")
    return ok, errors


def recheck_assets() -> list[str]:
    """对磁盘资源逐个做签名校验（mimeType 未知时按内容自动识别）。"""
    problems = []
    assets_dir = storage.data_root() / "assets"
    for path in assets_dir.glob("*.bin"):
        head = path.read_bytes()[:16]
        if head[:4] == b"glTF":
            mime = "model/gltf-binary"
        elif head[:4] == b"\x89PNG":
            mime = "image/png"
        elif head[:3] == b"\xff\xd8\xff":
            mime = "image/jpeg"
        elif head[:4] == b"RIFF":
            mime = "image/webp"
        elif head.lstrip().startswith(b"{"):
            mime = "model/gltf+json"
        else:
            problems.append(f"{path.name}: 无法识别的文件签名")
            continue
        try:
            validate_asset(path.stem, mime)
        except Exception as exc:
            problems.append(f"{path.name}: {exc}")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description="3D Vision 部署迁移与目录自检")
    parser.add_argument("--recheck", action="store_true")
    args = parser.parse_args()

    root = storage.ensure_dirs()
    print(f"[migrate] data root: {root}")
    stats = collect_asset_meta()
    print(f"[migrate] assets: {stats['assetFiles']} 个文件, {stats['assetBytes']} 字节")
    release_ok, release_errors = check_releases()
    print(f"[migrate] releases: {release_ok} 份有效")
    for error in release_errors:
        print(f"[migrate][warn] {error}")
    if args.recheck:
        problems = recheck_assets()
        if problems:
            for problem in problems:
                print(f"[migrate][error] {problem}")
            return 1
        print("[migrate] 全部资源签名校验通过")
    print("[migrate] done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
