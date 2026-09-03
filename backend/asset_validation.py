"""上传资源的同步轻量校验，确保进入资源库的文件可被前端直接使用。"""

import json
import struct
from pathlib import PurePosixPath


class AssetValidationError(ValueError):
    pass


def _validate_gltf_json(data: bytes) -> None:
    try:
        document = json.loads(data.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise AssetValidationError("glTF 文件不是合法 JSON") from exc
    if not isinstance(document, dict) or not isinstance(document.get("asset"), dict):
        raise AssetValidationError("glTF 文件缺少 asset 元数据")
    if not str(document["asset"].get("version", "")).startswith("2"):
        raise AssetValidationError("仅支持 glTF 2.x")
    for collection in ("buffers", "images"):
        for item in document.get(collection, []):
            uri = item.get("uri") if isinstance(item, dict) else None
            if isinstance(uri, str) and uri and not uri.startswith("data:"):
                raise AssetValidationError(
                    "当前为单文件上传，glTF 的外部 .bin 或纹理不可用；请上传自包含 GLB 或 data URI glTF"
                )


def _validate_glb(data: bytes) -> None:
    if len(data) < 20 or data[:4] != b"glTF":
        raise AssetValidationError("GLB 文件头不正确")
    _, version, declared_length = struct.unpack("<4sII", data[:12])
    if version != 2:
        raise AssetValidationError("仅支持 GLB 2.x")
    if declared_length != len(data):
        raise AssetValidationError("GLB 声明长度与文件大小不一致")
    chunk_length, chunk_type = struct.unpack("<II", data[12:20])
    if chunk_type != 0x4E4F534A or 20 + chunk_length > len(data):
        raise AssetValidationError("GLB 缺少有效 JSON 场景块")


def validate_asset(data: bytes, filename: str, content_type: str) -> tuple[str, str]:
    """返回标准化的 (mimeType, kind)，失败时抛出可直接展示的错误。"""
    if not data:
        raise AssetValidationError("资源文件不能为空")
    suffix = PurePosixPath(filename.lower()).suffix
    if suffix == ".glb" or data[:4] == b"glTF":
        _validate_glb(data)
        return "model/gltf-binary", "model"
    if suffix == ".gltf" or content_type == "model/gltf+json":
        _validate_gltf_json(data)
        return "model/gltf+json", "model"
    if suffix == ".png" or content_type == "image/png":
        if not data.startswith(b"\x89PNG\r\n\x1a\n"):
            raise AssetValidationError("PNG 文件签名不正确")
        return "image/png", "image"
    if suffix in {".jpg", ".jpeg"} or content_type == "image/jpeg":
        if len(data) < 4 or not data.startswith(b"\xff\xd8\xff") or not data.endswith(b"\xff\xd9"):
            raise AssetValidationError("JPEG 文件结构不完整")
        return "image/jpeg", "image"
    if suffix == ".webp" or content_type == "image/webp":
        if len(data) < 12 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
            raise AssetValidationError("WebP 文件签名不正确")
        return "image/webp", "image"
    raise AssetValidationError("仅支持 GLB、GLTF、PNG、JPG、WebP 资源")
