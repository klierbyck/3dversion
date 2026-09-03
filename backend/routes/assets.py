import mimetypes
from datetime import datetime, timezone
from urllib.parse import unquote
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

try:
    from ..asset_validation import AssetValidationError, validate_asset
    from ..common import response
    from ..store import persist_projects, projects
    from .. import storage
except ImportError:
    from asset_validation import AssetValidationError, validate_asset
    from common import response
    from store import persist_projects, projects
    import storage

router = APIRouter(prefix="/api")

ALLOWED_CONTENT_TYPES = {
    "model/gltf-binary",
    "model/gltf+json",
    "application/octet-stream",
    "image/png",
    "image/jpeg",
    "image/webp",
}
MAX_ASSET_BYTES = 100 * 1024 * 1024


def _find_asset(asset_id: str):
    for project in projects.values():
        asset = next(
            (item for item in project.get("assets", []) if item["id"] == asset_id), None
        )
        if asset:
            return project, asset
    return None, None


@router.get("/projects/{project_id}/assets")
def list_assets(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project.get("assets", []))


@router.post("/projects/{project_id}/assets")
async def upload_asset(project_id: str, request: Request):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    filename = unquote(request.headers.get("x-file-name", "asset"))
    content_type = (
        request.headers.get("content-type", "") or mimetypes.guess_type(filename)[0] or ""
    )
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(415, "仅支持 GLB、GLTF、PNG、JPG、WebP 资源")
    content = await request.body()
    if len(content) > MAX_ASSET_BYTES:
        raise HTTPException(413, "资源大小不能超过 100MB")
    try:
        content_type, kind = validate_asset(content, filename, content_type)
    except AssetValidationError as exc:
        raise HTTPException(422, str(exc)) from exc
    asset_id = str(uuid4())
    # 二进制落盘，元数据只保留路径/hash/大小（需求 8：模型文件不得放入数据库 BLOB）。
    stored = storage.save_asset_bytes(asset_id, content)
    asset = {
        "id": asset_id,
        "projectId": project_id,
        "name": filename,
        "mimeType": content_type,
        "size": stored["size"],
        "sha256": stored["sha256"],
        "path": stored["path"],
        "kind": kind,
        "url": f"/api/assets/{asset_id}/content",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "validationStatus": "validated",
    }
    project.setdefault("assets", []).append(asset)
    persist_projects()
    return response(asset)


@router.get("/assets/{asset_id}/content")
def asset_content(asset_id: str):
    _, asset = _find_asset(asset_id)
    if not asset:
        raise HTTPException(404, "资源不存在")
    content = storage.read_asset_bytes(asset_id)
    if content is None:
        # 兼容改造前残留在进程内存中的资源。
        for project in projects.values():
            legacy = project.get("asset_content", {}).get(asset_id)
            if legacy is not None:
                content = legacy
                break
    if content is None:
        raise HTTPException(404, "资源文件缺失")
    return Response(
        content=content,
        media_type=asset.get("mimeType", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )


@router.get("/assets/{asset_id}")
def get_asset(asset_id: str):
    _, asset = _find_asset(asset_id)
    if not asset:
        raise HTTPException(404, "资源不存在")
    return response(asset)


@router.delete("/assets/{asset_id}")
def delete_asset(asset_id: str):
    project, asset = _find_asset(asset_id)
    if not project or not asset:
        raise HTTPException(404, "资源不存在")
    project["assets"] = [item for item in project.get("assets", []) if item["id"] != asset_id]
    storage.remove_asset_file(asset_id)
    persist_projects()
    return response({"deleted": asset_id})
