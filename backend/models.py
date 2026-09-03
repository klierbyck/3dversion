from pydantic import BaseModel, Field


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
    level: str = "error"
    version: str | None = None
    source: str | None = None
    browser: str | None = None
    traceId: str | None = None
    createdAt: str | None = None


class ProjectPayload(BaseModel):
    name: str
    description: str = ""


class DataSourcePayload(BaseModel):
    projectId: str | None = None
    sourceId: str | None = None
    type: str
    url: str | None = None
    method: str = "GET"
    headers: dict[str, str] = {}
    params: dict[str, str] = {}
    body: str | None = None
    jsonData: str | None = Field(default=None, alias="json")
    refreshInterval: int | None = Field(default=None, ge=1, le=86400)
    timeout: int = Field(default=10, ge=1, le=60)
    authType: str = "none"
    authValue: str | None = None
    useProxy: bool = True
