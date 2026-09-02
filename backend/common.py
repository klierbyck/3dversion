from uuid import uuid4


def response(data):
    return {"code": 0, "message": "ok", "data": data, "requestId": str(uuid4())}
