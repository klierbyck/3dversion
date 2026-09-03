from fastapi import APIRouter, HTTPException, WebSocket

try:
    from ..common import response
    from ..models import RuntimeErrorPayload
    from ..store import new_project, persist_projects, projects
    from ..security import sanitize_scene
except ImportError:
    from common import response
    from models import RuntimeErrorPayload
    from store import new_project, persist_projects, projects
    from security import sanitize_scene

router = APIRouter(prefix="/api")


@router.get("/runtime/{project_id}")
def runtime(project_id: str):
    project = projects.get(project_id)
    if not project or not project.get("currentReleaseId"):
        raise HTTPException(404, "项目尚未发布")
    release = next(
        item for item in project["releases"] if item["id"] == project["currentReleaseId"]
    )
    public_release = dict(release)
    public_release["scene"] = sanitize_scene(project_id, release["scene"], update_secrets=True)
    if public_release["scene"] != release["scene"]:
        release["scene"] = public_release["scene"]
        persist_projects()
    return response(public_release)


@router.post("/runtime/errors")
def report_error(payload: RuntimeErrorPayload):
    # 错误归属到 payload 指定的项目；未知项目自动建档，避免错误在所有项目间重复扩散。
    project = projects.get(payload.projectId)
    if not project:
        project = new_project(payload.projectId, "未命名项目", "", False)
        projects[payload.projectId] = project
    project["errors"].append(payload.model_dump())
    persist_projects()
    return response({"received": True})


@router.get("/projects/{project_id}/errors")
def list_errors(
    project_id: str,
    version: str | None = None,
    type: str | None = None,
    level: str | None = None,
    start: str | None = None,
    end: str | None = None,
    page: int = 1,
    pageSize: int = 50,
):
    """错误日志查询：支持版本/类型/级别/时间区间筛选与分页，按时间倒序。"""
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    items = list(reversed(project["errors"]))
    if version:
        items = [item for item in items if item.get("version") == version]
    if type:
        items = [item for item in items if item.get("type") == type]
    if level:
        items = [item for item in items if item.get("level", "error") == level]
    if start:
        items = [item for item in items if (item.get("createdAt") or "") >= start]
    if end:
        items = [item for item in items if (item.get("createdAt") or "") <= end]
    total = len(items)
    page = max(1, page)
    pageSize = min(200, max(1, pageSize))
    paged = items[(page - 1) * pageSize : page * pageSize]
    return response({
        "total": total,
        "page": page,
        "pageSize": pageSize,
        "items": paged,
    })


@router.delete("/projects/{project_id}/errors/{error_id}")
def delete_error(project_id: str, error_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    before = len(project["errors"])
    project["errors"] = [item for item in project["errors"] if item.get("id") != error_id]
    persist_projects()
    return response({"deleted": before - len(project["errors"])})


@router.delete("/projects/{project_id}/errors")
def clear_errors(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    count = len(project["errors"])
    project["errors"] = []
    persist_projects()
    return response({"cleared": count})


@router.websocket("/runtime/{project_id}/ws")
async def runtime_ws(websocket: WebSocket, project_id: str):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "projectId": project_id})
    try:
        while True:
            message = await websocket.receive_text()
            await websocket.send_json({"type": "echo", "payload": message})
    except Exception:
        await websocket.close()
