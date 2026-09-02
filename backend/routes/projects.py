from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

try:
    from ..common import response
    from ..models import DraftPayload, ProjectPayload, ReleasePayload
    from ..store import new_project, projects
except ImportError:
    from common import response
    from models import DraftPayload, ProjectPayload, ReleasePayload
    from store import new_project, projects

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return response({"status": "ok"})


@router.get("/projects")
def list_projects():
    items = [
        {
            "id": project["id"],
            "name": project["name"],
            "description": project.get("description", ""),
            "icon": project.get("icon", "🌐"),
            "isDemo": project.get("isDemo", False),
            "updatedAt": project.get("updatedAt"),
            "nodeCount": len(project.get("draft", {}).get("nodes", [])),
        }
        for project in projects.values()
    ]
    return response(items)


@router.post("/projects")
def create_project(payload: ProjectPayload):
    project_id = str(uuid4())
    project = new_project(
        project_id,
        payload.name.strip() or "未命名项目",
        payload.description.strip(),
        False,
    )
    projects[project_id] = project
    return response(
        {key: project[key] for key in ("id", "name", "description", "icon", "isDemo", "updatedAt")}
    )


@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    if projects.pop(project_id, None) is None:
        raise HTTPException(404, "项目不存在")
    return response({"deleted": project_id})


@router.get("/projects/{project_id}/draft")
def get_draft(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response({"scene": deepcopy(project["draft"]), "revision": project["revision"]})


@router.put("/projects/{project_id}/draft")
def save_draft(project_id: str, payload: DraftPayload):
    project = projects.get(project_id)
    if not project:
        project = new_project(project_id, "未命名项目", "", False)
        projects[project_id] = project
    if payload.revision != project["revision"]:
        raise HTTPException(409, "草稿版本冲突，请重新加载")
    project["draft"] = deepcopy(payload.scene)
    project["revision"] += 1
    project["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return response({"revision": project["revision"]})


@router.post("/projects/{project_id}/releases")
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


@router.get("/projects/{project_id}/releases")
def list_releases(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    return response(project["releases"])


@router.post("/releases/{release_id}/rollback")
def rollback(release_id: str):
    for project in projects.values():
        for release in project["releases"]:
            if release["id"] == release_id:
                project["currentReleaseId"] = release_id
                project["draft"] = deepcopy(release["scene"])
                return response(release)
    raise HTTPException(404, "发布版本不存在")
