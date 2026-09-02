from datetime import datetime, timezone


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
        "asset_content": {},
    }


# 预置示例项目：场景内容由前端 demo 目录提供，后端只保存元信息与用户后续编辑的草稿。
projects: dict[str, dict] = {
    "demo-park": new_project(
        "demo-park",
        "智慧园区态势中心",
        "办公研发、道路绿化、低碳停车与园区交通的三维态势场景",
        True,
    ),
    "demo-energy": new_project(
        "demo-energy",
        "风光储一体化电站",
        "风机、光伏阵列与储能系统的发电监控示范场景",
        True,
    ),
    "demo-factory": new_project(
        "demo-factory",
        "智能工厂数字孪生",
        "车间产线、物流输送与设备状态的数字孪生场景",
        True,
    ),
    "demo-logistics": new_project(
        "demo-logistics",
        "智慧物流园运营中心",
        "仓库月台、车辆调度与吞吐数据的三维运营视图",
        True,
    ),
}
