"""3D Vision MVP 后端应用装配。

V1 使用内存数据存储，便于开发环境零依赖启动；生产部署时将仓储层替换为 PostgreSQL，
并把文件存储实现替换为本地数据盘 StorageBackend。
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .routes import assets_router, projects_router, runtime_router
except ImportError:
    from routes import assets_router, projects_router, runtime_router

app = FastAPI(title="3D Vision API", version="1.0.0")

# 生产默认由 Nginx 同源反代 /api；仅显式配置时开放跨域来源。
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

app.include_router(projects_router)
app.include_router(assets_router)
app.include_router(runtime_router)
