"""数据源测试与服务端代理。

安全约束（需求 4.6 / 9.3）：
- 浏览器只访问 FastAPI 代理，认证凭证仅随请求一次性传入，不在响应与日志中回显；
- 请求超时默认 10 秒，网络错误与 5xx 最多重试 2 次（共 3 次尝试）；
- 仅允许 http/https 协议，拦截云主机元数据地址，防止 SSRF 穿透内网元数据服务。
"""

import base64
import binascii
import ipaddress
import os
import socket
import time
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, HTTPException

try:
    from ..common import response
    from ..models import DataSourcePayload
    from ..security import get_data_source_secret
except ImportError:
    from common import response
    from models import DataSourcePayload
    from security import get_data_source_secret

router = APIRouter(prefix="/api/data-sources")

MAX_ATTEMPTS = 3
RETRY_BACKOFF = (0.3, 0.8)
MAX_FIELDS = 60
SAMPLE_LEN = 40
MAX_RESPONSE_BYTES = 5 * 1024 * 1024
MAX_REDIRECTS = 5

# 云厂商链路本地元数据地址，任何数据源请求都不允许访问。
BLOCKED_HOSTS = {"169.254.169.254", "metadata.google.internal", "fd00:ec2::254"}


def _blocked_ip(value: str) -> bool:
    ip = ipaddress.ip_address(value)
    return any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_multicast,
            ip.is_reserved,
            ip.is_unspecified,
        )
    )


def _guard_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(400, "仅支持 http/https 数据源地址")
    host = (parsed.hostname or "").lower().strip("[]")
    if not host:
        raise HTTPException(400, "数据源地址缺少主机名")
    if host in BLOCKED_HOSTS:
        raise HTTPException(403, "禁止访问云主机元数据地址")
    allow_private = os.getenv("DATA_SOURCE_ALLOW_PRIVATE") == "1"
    try:
        if not allow_private and _blocked_ip(host):
            raise HTTPException(403, "默认禁止访问本机、内网及保留地址")
    except ValueError:
        try:
            resolved = {info[4][0] for info in socket.getaddrinfo(host, None)}
        except OSError:
            resolved = set()
        for item in resolved:
            if item in BLOCKED_HOSTS or (not allow_private and _blocked_ip(item)):
                raise HTTPException(403, "数据源域名解析到了本机、内网或保留地址")


def _auth_headers(auth_type: str, auth_value: str | None) -> dict[str, str]:
    value = (auth_value or "").strip()
    if auth_type == "none" or not value:
        return {}
    if auth_type == "bearer":
        return {"Authorization": f"Bearer {value}"}
    if auth_type == "apiKey":
        return {"X-API-Key": value}
    if auth_type == "basic":
        if ":" not in value:
            raise HTTPException(400, "Basic 认证需填写“用户名:密码”")
        try:
            token = base64.b64encode(value.encode("utf-8")).decode("ascii")
        except (UnicodeEncodeError, binascii.Error) as exc:
            raise HTTPException(400, "Basic 认证编码失败") from exc
        return {"Authorization": f"Basic {token}"}
    raise HTTPException(400, f"不支持的认证方式: {auth_type}")


def _extract_fields(data, prefix: str = "", depth: int = 0) -> list[dict]:
    """提取叶子字段路径、类型与截断样例，供编辑器“获取字段样例”使用。"""
    fields: list[dict] = []
    if len(fields) >= MAX_FIELDS or depth > 3:
        return fields
    if isinstance(data, dict):
        for key, value in list(data.items())[:30]:
            path = f"{prefix}.{key}" if prefix else str(key)
            fields.extend(_extract_fields(value, path, depth + 1))
    elif isinstance(data, list):
        if data:
            fields.extend(_extract_fields(data[0], f"{prefix}[]", depth + 1))
        else:
            fields.append({"path": prefix, "type": "array", "sample": "[]"})
    else:
        if isinstance(data, bool):
            kind, sample = "boolean", str(data)
        elif isinstance(data, (int, float)):
            kind, sample = "number", str(data)
        elif data is None:
            kind, sample = "null", "null"
        else:
            kind = "string"
            sample = str(data)
            if len(sample) > SAMPLE_LEN:
                sample = sample[:SAMPLE_LEN] + "…"
        fields.append({"path": prefix, "type": kind, "sample": sample})
    return fields[:MAX_FIELDS]


def _request_once(
    client: httpx.Client,
    method: str,
    url: str,
    params: dict[str, str] | None,
    headers: dict[str, str],
    body: str | None,
) -> httpx.Response:
    current_url = url
    current_method = method
    current_body = body
    current_headers = dict(headers)
    for redirect_count in range(MAX_REDIRECTS + 1):
        _guard_url(current_url)
        request = client.build_request(
            current_method,
            current_url,
            params=params if redirect_count == 0 else None,
            headers=current_headers,
            content=current_body,
        )
        resp = client.send(request, stream=True)
        if resp.status_code not in {301, 302, 303, 307, 308}:
            chunks = []
            size = 0
            try:
                for chunk in resp.iter_bytes():
                    size += len(chunk)
                    if size > MAX_RESPONSE_BYTES:
                        raise HTTPException(413, "数据源响应不能超过 5MB")
                    chunks.append(chunk)
                resp._content = b"".join(chunks)
                return resp
            finally:
                resp.close()
        location = resp.headers.get("location")
        resp.close()
        if not location:
            return resp
        if redirect_count >= MAX_REDIRECTS:
            raise HTTPException(502, "数据源重定向次数过多")
        next_url = urljoin(current_url, location)
        _guard_url(next_url)
        if urlparse(next_url).netloc != urlparse(current_url).netloc:
            current_headers.pop("Authorization", None)
            current_headers.pop("X-API-Key", None)
        if resp.status_code == 303 or (resp.status_code in {301, 302} and current_method == "POST"):
            current_method, current_body = "GET", None
        current_url = next_url
    raise HTTPException(502, "数据源重定向失败")


def _perform_request(payload: DataSourcePayload) -> tuple[int, object, int]:
    """执行带重试的请求，返回 (HTTP 状态码, JSON 数据, 实际尝试次数)。"""
    assert payload.url
    _guard_url(payload.url)
    method = payload.method.upper() if payload.method.upper() in {"GET", "POST"} else "GET"
    headers = dict(payload.headers or {})
    headers.update(_auth_headers(payload.authType or "none", payload.authValue))
    body = payload.body.strip() if method == "POST" and payload.body else None
    if body and not any(key.lower() == "content-type" for key in headers):
        headers["Content-Type"] = "application/json"

    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with httpx.Client(
                timeout=payload.timeout,
                follow_redirects=False,
                trust_env=False,
            ) as client:
                resp = _request_once(
                    client,
                    method,
                    payload.url,
                    payload.params or None,
                    headers,
                    body,
                )
            if resp.status_code >= 500 and attempt < MAX_ATTEMPTS:
                last_error = httpx.HTTPStatusError(
                    f"服务端错误 {resp.status_code}", request=resp.request, response=resp
                )
            else:
                if resp.status_code >= 400:
                    raise HTTPException(502, f"数据源返回 HTTP {resp.status_code}")
                try:
                    return resp.status_code, resp.json(), attempt
                except ValueError as exc:
                    raise HTTPException(400, "数据源返回的不是合法 JSON") from exc
        except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as exc:
            last_error = exc
            if attempt < MAX_ATTEMPTS:
                time.sleep(RETRY_BACKOFF[min(attempt - 1, len(RETRY_BACKOFF) - 1)])
                continue
    raise HTTPException(502, f"数据源请求失败（已重试 2 次）: {last_error}")


def _result(data: object, status: int | None = None, attempts: int | None = None) -> dict:
    result = {"ok": True, "data": data, "fields": _extract_fields(data)}
    if status is not None:
        result["status"] = status
    if attempts is not None:
        result["attempts"] = attempts
    return result


@router.post("/test")
def test_data_source(payload: DataSourcePayload):
    if payload.type == "json":
        import json

        try:
            data = json.loads(payload.jsonData or "{}")
        except json.JSONDecodeError as exc:
            raise HTTPException(400, f"静态 JSON 无效: {exc.msg}") from exc
        return response(_result(data))
    if payload.type == "websocket":
        url = (payload.url or "").strip()
        parsed = urlparse(url)
        if parsed.scheme not in {"ws", "wss"} or not parsed.hostname:
            raise HTTPException(400, "WebSocket 地址需以 ws:// 或 wss:// 开头")
        # V1：WebSocket 为浏览器直连通道，测试连接由前端握手完成；此处只校验地址格式。
        return response({"ok": True, "wsUrlValid": True, "fields": []})
    if payload.type != "rest" or not payload.url:
        raise HTTPException(400, "数据源类型或地址无效")
    auth_value = payload.authValue
    if not auth_value and payload.projectId and payload.sourceId:
        auth_value = get_data_source_secret(payload.projectId, payload.sourceId)
    effective_payload = payload.model_copy(update={"authValue": auth_value})
    status, data, attempts = _perform_request(effective_payload)
    return response(_result(data, status=status, attempts=attempts))


@router.post("/fetch")
def fetch_data_source(payload: DataSourcePayload):
    """运行态数据拉取代理：浏览器不直接接触外部地址与认证凭证。"""
    if payload.type == "json":
        import json

        try:
            data = json.loads(payload.jsonData or "{}")
        except json.JSONDecodeError:
            data = {}
        return response(_result(data))
    if payload.type != "rest" or not payload.url:
        raise HTTPException(400, "数据源类型或地址无效")
    auth_value = ""
    if payload.projectId and payload.sourceId:
        auth_value = get_data_source_secret(payload.projectId, payload.sourceId)
    effective_payload = payload.model_copy(update={"authValue": auth_value or None})
    _, data, _ = _perform_request(effective_payload)
    return response(_result(data))
