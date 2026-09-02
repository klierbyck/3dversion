"""3D Vision MVP 后端。

V1 使用内存数据存储，便于开发环境零依赖启动；生产部署时将仓储层替换为 PostgreSQL，
并把文件存储实现替换为本地数据盘 StorageBackend。

跨域策略：默认不启用 CORS（生产走 Nginx 同源反代 /api 即可）；
开发中若前端与 API 不同源，设置环境变量 ALLOWED_ORIGINS（逗号分隔）按需放开。
"""

import os
import mimetypes
from urllib.parse import unquote
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="3D Vision API", version="1.0.0")
allowed_origins = [
    origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()
]
if allowed_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


class DraftPayload(BaseModel):
    scene: dict
    revision: int = Field(ge=0)


class ReleasePayload(BaseModel):
    scene: dict


class RuntimeErrorPayload(BaseModel):
    id: str | None = None
    projectId: str
    type: str
    message: str
    createdAt: str | None = None


class ProjectPayload(BaseModel):
    name: str
    description: str = ""


class DataSourcePayload(BaseModel):
    type: str
    url: str | None = None
    method: str = "GET"
    headers: dict[str, str] = {}
    json: str | None = None
    timeout: int = Field(default=10, ge=1, le=60)


def _new_project(project_id: str, name: str, description: str, is_demo: bool) -> dict:
    return {
        "id": project_id,
        "name": name,
        "description": description,
        "icon": "🌐",
        "isDemo": is_demo,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "draft": {"schemaVersion": "1.1.0", "nodes": []},
        "revision": 0,
        "releases": [],
        "errors": [],
        "assets": [],
        "asset_content": {},
    }


# 预置示例项目：场景内容由前端 demo 目录提供，后端只保存元信息与用户后续编辑的草稿。
projects: dict[str, dict] = {
    "demo-park": _new_project(
        "demo-park",
        "智慧园区态势中心",
        "办公研发、道路绿化、低碳停车与园区交通的三维态势场景",
        True,
    ),
    "demo-energy": _new_project(
        "demo-energy",
        "风光储一体化电站",
        "风机、光伏阵列与储能系统的发电监控示范场景",
        True,
    ),
    "demo-factory": _new_project(
        "demo-factory",
        "智能工厂数字孪生",
        "车间产线、物流输送与设备状态的数字孪生场景",
        True,
    ),
    "demo-logistics": _new_project(
        "demo-logistics",
        "智慧物流园运营中心",
        "仓库月台、车辆调度与吞吐数据的三维运营视图",
        True,
    ),
}


def response(data):
    return {"code": 0, "message": "ok", "data": data, "requestId": str(uuid4())}


@app.get("/api/health")
def health():
    return response({"status": "ok"})


@app.get("/api/projects")
def list_projects():
    items = [
        {
            "id": p["id"],
            "name": p["name"],
            "description": p.get("description", ""),
            "icon": p.get("icon", "🌐"),
            "isDemo": p.get("isDemo", False),
            "updatedAt": p.get("updatedAt"),
            "nodeCount": len(p.get("draft", {}).get("nodes", [])),
        }
        for p in projects.values()
    ]
    return response(items)


@app.post("/api/projects")
def create_project(payload: ProjectPayload):
    project_id = str(uuid4())
    project = _new_project(
        project_id,
        payload.name.strip() or "未命名项目",
        payload.description.strip(),
        False,
    )
    projects[project_id] = project
    return response(
        {key: project[key] for key in ("id", "name", "description", "icon", "isDemo", "updatedAt")}
    )


@app.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    if projects.pop(project_id, None) is None:
        raise HTTPException(404, "项目不存在")
    return response({"deleted": project_id})


@app.get("/api/projects/{project_id}/draft")
def get_draft(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response({"scene": deepcopy(project["draft"]), "revision": project["revision"]})


@app.put("/api/projects/{project_id}/draft")
def save_draft(project_id: str, payload: DraftPayload):
    project = projects.get(project_id)
    if not project:
        project = _new_project(project_id, "未命名项目", "", False)
        projects[project_id] = project
    if payload.revision != project["revision"]:
        raise HTTPException(409, "草稿版本冲突，请重新加载")
    project["draft"] = deepcopy(payload.scene)
    project["revision"] += 1
    project["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return response({"revision": project["revision"]})


@app.post("/api/projects/{project_id}/releases")
def create_release(project_id: str, payload: ReleasePayload):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    version = f"v1.0.{len(project['releases'])}"
    release = {
        "id": str(uuid4()),
        "version": version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": "当前用户",
        "scene": deepcopy(payload.scene),
    }
    project["releases"].insert(0, release)
    project["currentReleaseId"] = release["id"]
    return response(release)


@app.get("/api/projects/{project_id}/releases")
def list_releases(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project["releases"])


@app.post("/api/releases/{release_id}/rollback")
def rollback(release_id: str):
    for project in projects.values():
        for release in project["releases"]:
            if release["id"] == release_id:
                project["currentReleaseId"] = release_id
                project["draft"] = deepcopy(release["scene"])
                return response(release)
    raise HTTPException(404, "发布版本不存在")


@app.get("/api/runtime/{project_id}")
def runtime(project_id: str):
    project = projects.get(project_id)
    if not project or not project.get("currentReleaseId"):
        raise HTTPException(404, "项目尚未发布")
    release = next(
        item for item in project["releases"] if item["id"] == project["currentReleaseId"]
    )
    return response(release)


@app.post("/api/runtime/errors")
def report_error(payload: RuntimeErrorPayload):
    # 错误归属到 payload 指定的项目；未知项目自动建档，避免错误在所有项目间重复扩散。
    project = projects.get(payload.projectId)
    if not project:
        project = _new_project(payload.projectId, "未命名项目", "", False)
        projects[payload.projectId] = project
    project["errors"].append(payload.model_dump())
    return response({"received": True})


@app.get("/api/projects/{project_id}/assets")
def list_assets(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project.get("assets", []))


@app.post("/api/projects/{project_id}/assets")
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
    content_type = request.headers.get("content-type", "") or mimetypes.guess_type(filename)[0] or ""
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


@app.get("/api/assets/{asset_id}/content")
def asset_content(asset_id: str):
    for project in projects.values():
        content = project.get("asset_content", {}).get(asset_id)
        if content is not None:
            asset = next((item for item in project.get("assets", []) if item["id"] == asset_id), None)
            from fastapi.responses import Response

            return Response(content=content, media_type=(asset or {}).get("mimeType", "application/octet-stream"))
    raise HTTPException(404, "资源不存在")


@app.get("/api/assets/{asset_id}")
def get_asset(asset_id: str):
    for project in projects.values():
        asset = next((item for item in project.get("assets", []) if item["id"] == asset_id), None)
        if asset:
            return response(asset)
    raise HTTPException(404, "资源不存在")


@app.post("/api/data-sources/test")
async def test_data_source(payload: DataSourcePayload):
    if payload.type == "json":
        import json

        try:
            return response({"ok": True, "data": json.loads(payload.json or "{}")})
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"JSON 数据无效: {exc.msg}") from exc
    if payload.type not in {"rest", "websocket"} or not payload.url:
        raise HTTPException(400, "数据源类型或地址无效")
    # 网络访问由浏览器端执行；后端接口负责校验配置并返回可用状态。
    return response({"ok": True, "message": "数据源配置有效，请在浏览器端读取快照"})


@app.get("/api/projects/{project_id}/errors")
def list_errors(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project["errors"][-100:])


@app.websocket("/api/runtime/{project_id}/ws")
async def runtime_ws(websocket: WebSocket, project_id: str):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "projectId": project_id})
    try:
        while True:
            message = await websocket.receive_text()
            await websocket.send_json({"type": "echo", "payload": message})
    except Exception:
        await websocket.close()
