"""3D Vision MVP 后端应用装配。项目索引和资源均持久化到 DATA_DIR。"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

try:
    from .routes import (
        assets_router,
        data_sources_router,
        projects_router,
        runtime_router,
    )
except ImportError:
    from routes import (
        assets_router,
        data_sources_router,
        projects_router,
        runtime_router,
    )

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
app.include_router(data_sources_router)
app.include_router(runtime_router)
