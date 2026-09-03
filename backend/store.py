import json
import os
from datetime import datetime, timezone

try:
    from . import storage
except ImportError:
    import storage


def new_project(project_id: str, name: str, description: str, is_demo: bool) -> dict:
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
    }


def _builtin_projects() -> dict[str, dict]:
    """场景内容由前端 demo 提供，后端保存元信息与用户后续编辑的草稿。"""
    return {
    "demo-park": new_project(
        "demo-park",
        "智慧楼宇与园区安防",
        "融合 BIM 楼宇、园区 GIS、门禁视频与消防感知的综合安防场景",
        True,
    ),
    "demo-factory": new_project(
        "demo-factory",
        "智能工厂产线监控",
        "覆盖数控加工、机器人作业、输送与厂内物流的工业数字孪生场景",
        True,
    ),
    "demo-showroom": new_project(
        "demo-showroom",
        "3D 数字化展厅",
        "面向汽车与零售商品的沉浸式展销、热点讲解和虚拟定制场景",
        True,
    ),
    "demo-logistics": new_project(
        "demo-logistics",
        "智慧仓储 WMS 中心",
        "展示库位、托盘、AGV、叉车与出入库输送协同的数字仓储场景",
        True,
    ),
    "demo-energy": new_project(
        "demo-energy",
        "智慧城市与能源基建",
        "城市建筑、交通桥梁、风光电网与基础设施的宏观态势感知场景",
        True,
    ),
    "demo-datacenter": new_project(
        "demo-datacenter",
        "数据中心 DCIM 运维",
        "覆盖服务器机柜、制冷、UPS 配电与动环监控的数据中心基础设施场景",
        True,
    ),
    }


def _projects_path():
    return storage.ensure_dirs() / "projects.json"


def _load_projects() -> dict[str, dict]:
    builtins = _builtin_projects()
    path = _projects_path()
    if path.exists():
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                builtins.update(
                    (project_id, project)
                    for project_id, project in loaded.items()
                    if isinstance(project_id, str) and isinstance(project, dict)
                )
        except (OSError, json.JSONDecodeError):
            # 保留损坏文件供排查，以内置项目恢复启动。
            corrupt = path.with_suffix(".json.corrupt")
            try:
                os.replace(path, corrupt)
            except OSError:
                pass
    return builtins


def persist_projects() -> None:
    """单进程仓储的原子快照，避免服务重启后项目和资源索引丢失。"""
    path = _projects_path()
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(projects, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


projects: dict[str, dict] = _load_projects()
