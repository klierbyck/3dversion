"""数据源凭证的本地加密仓。接口和项目快照均不保存或回传明文。"""

import base64
import hashlib
import json
import os
from copy import deepcopy

from cryptography.fernet import Fernet, InvalidToken

try:
    from . import storage
except ImportError:
    import storage


def _load_key() -> bytes:
    secret = os.getenv("APP_SECRET_KEY")
    if secret:
        digest = hashlib.sha256(secret.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest)
    path = storage.ensure_dirs() / ".secret-key"
    if path.exists():
        return path.read_bytes().strip()
    key = Fernet.generate_key()
    tmp = path.with_suffix(".tmp")
    tmp.write_bytes(key)
    os.replace(tmp, path)
    return key


_fernet = Fernet(_load_key())


def encrypt_text(plain: str) -> str:
    if not plain:
        return ""
    return _fernet.encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_text(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet.decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        return ""


def _secrets_path():
    return storage.ensure_dirs() / "secrets.json"


def _load_secrets() -> dict[str, str]:
    path = _secrets_path()
    if not path.exists():
        return {}
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


_secrets: dict[str, str] = _load_secrets()


def _persist_secrets() -> None:
    path = _secrets_path()
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(_secrets, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, path)


def _secret_id(project_id: str, source_id: str) -> str:
    return f"{project_id}:{source_id}"


def store_data_source_secret(project_id: str, source_id: str, value: str) -> None:
    _secrets[_secret_id(project_id, source_id)] = encrypt_text(value)
    _persist_secrets()


def get_data_source_secret(project_id: str, source_id: str) -> str:
    return decrypt_text(_secrets.get(_secret_id(project_id, source_id), ""))


def delete_data_source_secret(project_id: str, source_id: str) -> None:
    if _secrets.pop(_secret_id(project_id, source_id), None) is not None:
        _persist_secrets()


def delete_project_secrets(project_id: str) -> None:
    prefix = f"{project_id}:"
    removed = [key for key in _secrets if key.startswith(prefix)]
    for key in removed:
        _secrets.pop(key, None)
    if removed:
        _persist_secrets()


def sanitize_scene(project_id: str, scene: dict, *, update_secrets: bool = True) -> dict:
    """深拷贝并脱敏数据源；仅显式出现 authValue 时更新凭证仓。"""
    result = deepcopy(scene)
    sources = result.get("dataSources")
    if not isinstance(sources, list):
        return result
    for source in sources:
        if not isinstance(source, dict):
            continue
        source_id = source.get("id")
        if not isinstance(source_id, str) or not source_id:
            source.pop("authValue", None)
            continue
        auth_type = source.get("authType", "none")
        if update_secrets and "authValue" in source:
            value = source.get("authValue")
            if isinstance(value, str) and value.strip() and auth_type != "none":
                store_data_source_secret(project_id, source_id, value)
            else:
                delete_data_source_secret(project_id, source_id)
        if update_secrets and auth_type == "none":
            delete_data_source_secret(project_id, source_id)
        source.pop("authValue", None)
        source["hasAuthValue"] = bool(get_data_source_secret(project_id, source_id))
    return result
