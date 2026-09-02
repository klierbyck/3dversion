import mimetypes
from datetime import datetime, timezone
from urllib.parse import unquote
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

try:
    from ..common import response
    from ..store import projects
except ImportError:
    from common import response
    from store import projects

router = APIRouter(prefix="/api")


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
    allowed = {
        "model/gltf-binary",
        "model/gltf+json",
        "application/octet-stream",
        "image/png",
        "image/jpeg",
        "image/webp",
    }
    filename = unquote(request.headers.get("x-file-name", "asset"))
    content_type = (
        request.headers.get("content-type", "") or mimetypes.guess_type(filename)[0] or ""
    )
    if content_type not in allowed:
        raise HTTPException(415, "仅支持 GLB、GLTF、PNG、JPG、WebP 资源")
    content = await request.body()
    if len(content) > 100 * 1024 * 1024:
        raise HTTPException(413, "资源大小不能超过 100MB")
    asset_id = str(uuid4())
    kind = "image" if content_type.startswith("image/") else "model"
    asset = {
        "id": asset_id,
        "projectId": project_id,
        "name": filename,
        "mimeType": content_type,
        "size": len(content),
        "kind": kind,
        "url": f"/api/assets/{asset_id}/content",
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    project.setdefault("assets", []).append(asset)
    project.setdefault("asset_content", {})[asset_id] = content
    return response(asset)


@router.get("/assets/{asset_id}/content")
def asset_content(asset_id: str):
    for project in projects.values():
        content = project.get("asset_content", {}).get(asset_id)
        if content is not None:
            asset = next(
                (item for item in project.get("assets", []) if item["id"] == asset_id), None
            )
            return Response(
                content=content,
                media_type=(asset or {}).get("mimeType", "application/octet-stream"),
            )
    raise HTTPException(404, "资源不存在")


@router.get("/assets/{asset_id}")
def get_asset(asset_id: str):
    for project in projects.values():
        asset = next((item for item in project.get("assets", []) if item["id"] == asset_id), None)
        if asset:
            return response(asset)
    raise HTTPException(404, "资源不存在")
