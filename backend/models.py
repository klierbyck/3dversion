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
