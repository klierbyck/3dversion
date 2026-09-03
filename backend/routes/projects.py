import json
import shutil
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

try:
    from ..common import response
    from ..models import DraftPayload, ProjectPayload, ReleasePayload
    from ..store import new_project, persist_projects, projects
    from .. import security, storage
except ImportError:
    from common import response
    from models import DraftPayload, ProjectPayload, ReleasePayload
    from store import new_project, persist_projects, projects
    import security
    import storage

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
    persist_projects()
    return response(
        {key: project[key] for key in ("id", "name", "description", "icon", "isDemo", "updatedAt")}
    )


@router.delete("/projects/{project_id}")
def delete_project(project_id: str):
    project = projects.pop(project_id, None)
    if project is None:
        raise HTTPException(404, "项目不存在")
    for asset in project.get("assets", []):
        storage.remove_asset_file(asset.get("id", ""))
    release_dir = storage.ensure_dirs() / "releases" / project_id
    if release_dir.exists():
        shutil.rmtree(release_dir)
    security.delete_project_secrets(project_id)
    persist_projects()
    return response({"deleted": project_id})


@router.get("/projects/{project_id}/draft")
def get_draft(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    scene = security.sanitize_scene(project_id, project["draft"], update_secrets=True)
    if scene != project["draft"]:
        project["draft"] = scene
        persist_projects()
    return response({"scene": deepcopy(scene), "revision": project["revision"]})


@router.put("/projects/{project_id}/draft")
def save_draft(project_id: str, payload: DraftPayload):
    project = projects.get(project_id)
    if not project:
        project = new_project(project_id, "未命名项目", "", False)
        projects[project_id] = project
    if payload.revision != project["revision"]:
        raise HTTPException(409, "草稿版本冲突，请重新加载")
    project["draft"] = security.sanitize_scene(project_id, payload.scene)
    project["revision"] += 1
    project["updatedAt"] = datetime.now(timezone.utc).isoformat()
    persist_projects()
    return response({"revision": project["revision"]})


@router.get("/system/disk")
def disk_space():
    """数据盘剩余空间，供发布前磁盘空间校验使用。"""
    usage = storage.disk_usage()
    return response({"free": usage.free, "total": usage.total, "used": usage.used})


@router.post("/projects/{project_id}/releases")
def create_release(project_id: str, payload: ReleasePayload):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    # 发布前服务端兜底：父子关系完整性 + 磁盘余量；任何失败都不得改变线上版本。
    clean_scene = security.sanitize_scene(project_id, payload.scene)
    nodes = clean_scene.get("nodes", [])
    ids = {node.get("id") for node in nodes}
    for node in nodes:
        parent_id = node.get("parentId")
        if parent_id and parent_id not in ids:
            raise HTTPException(400, f"节点「{node.get('name', parent_id)}」的父节点不存在，发布中止")
    data_dir = storage.ensure_dirs()
    payload_bytes = len(json.dumps(clean_scene, ensure_ascii=False).encode("utf-8"))
    free = shutil.disk_usage(data_dir).free
    if free < max(50 * 1024 * 1024, payload_bytes * 2):
        raise HTTPException(507, "数据盘剩余空间不足，发布中止（当前线上版本未变更）")
    release_id = str(uuid4())
    version = f"v1.0.{len(project['releases'])}"
    release = {
        "id": release_id,
        "version": version,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "createdBy": "当前用户",
        "scene": clean_scene,
    }
    # 发布产物落盘，内存仅缓存当前副本；路径与 hash 进入元数据，不把产物放入数据库 BLOB。
    release["path"] = storage.save_release_document(project_id, release_id, release)
    project["releases"].insert(0, release)
    project["currentReleaseId"] = release["id"]
    persist_projects()
    return response(release)


@router.get("/projects/{project_id}/releases")
def list_releases(project_id: str):
    project = projects.get(project_id)
    if not project:
        raise HTTPException(404, "项目不存在")
    releases = []
    changed = False
    for release in project["releases"]:
        clean_release = dict(release)
        clean_release["scene"] = security.sanitize_scene(project_id, release["scene"])
        releases.append(clean_release)
        if clean_release != release:
            changed = True
    if changed:
        project["releases"] = releases
        persist_projects()
    return response(releases)


@router.post("/releases/{release_id}/rollback")
def rollback(release_id: str):
    for project in projects.values():
        for release in project["releases"]:
            if release["id"] == release_id:
                project["currentReleaseId"] = release_id
                release["scene"] = security.sanitize_scene(project["id"], release["scene"])
                project["draft"] = deepcopy(release["scene"])
                project["revision"] += 1
                project["updatedAt"] = datetime.now(timezone.utc).isoformat()
                persist_projects()
                return response(dict(release))
    raise HTTPException(404, "发布版本不存在")
