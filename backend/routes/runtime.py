import json

from fastapi import APIRouter, HTTPException, WebSocket

try:
    from ..common import response
    from ..models import DataSourcePayload, RuntimeErrorPayload
    from ..store import new_project, projects
except ImportError:
    from common import response
    from models import DataSourcePayload, RuntimeErrorPayload
    from store import new_project, projects

router = APIRouter(prefix="/api")


@router.get("/runtime/{project_id}")
def runtime(project_id: str):
    project = projects.get(project_id)
    if not project or not project.get("currentReleaseId"):
        raise HTTPException(404, "项目尚未发布")
    release = next(
        item for item in project["releases"] if item["id"] == project["currentReleaseId"]
    )
    return response(release)


@router.post("/runtime/errors")
def report_error(payload: RuntimeErrorPayload):
    # 错误归属到 payload 指定的项目；未知项目自动建档，避免错误在所有项目间重复扩散。
    project = projects.get(payload.projectId)
    if not project:
        project = new_project(payload.projectId, "未命名项目", "", False)
        projects[payload.projectId] = project
    project["errors"].append(payload.model_dump())
    return response({"received": True})


@router.post("/data-sources/test")
async def test_data_source(payload: DataSourcePayload):
    if payload.type == "json":
        try:
            return response({"ok": True, "data": json.loads(payload.json or "{}")})
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"JSON 数据无效: {exc.msg}") from exc
    if payload.type not in {"rest", "websocket"} or not payload.url:
        raise HTTPException(400, "数据源类型或地址无效")
    # 网络访问由浏览器端执行；后端接口负责校验配置并返回可用状态。
    return response({"ok": True, "message": "数据源配置有效，请在浏览器端读取快照"})


@router.get("/projects/{project_id}/errors")
def list_errors(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project["errors"][-100:])


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
