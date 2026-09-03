import json
import os
import struct
import tempfile
import unittest
from pathlib import Path


class BackendIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        os.environ["DATA_DIR"] = cls.temp_dir.name
        from fastapi.testclient import TestClient

        from backend.main import app

        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.temp_dir.cleanup()

    def test_project_snapshot_and_credentials_are_persisted_without_plaintext(self):
        source = {
            "id": "secure-source",
            "name": "Secure source",
            "type": "rest",
            "url": "https://example.com/data",
            "authType": "bearer",
            "authValue": "TOP-SECRET",
        }
        scene = {"schemaVersion": "1.1.0", "nodes": [], "dataSources": [source]}
        saved = self.client.put(
            "/api/projects/demo-park/draft", json={"scene": scene, "revision": 0}
        )
        self.assertEqual(saved.status_code, 200)
        draft = self.client.get("/api/projects/demo-park/draft").json()["data"]["scene"]
        self.assertNotIn("authValue", draft["dataSources"][0])
        self.assertTrue(draft["dataSources"][0]["hasAuthValue"])

        released = self.client.post("/api/projects/demo-park/releases", json={"scene": scene})
        self.assertEqual(released.status_code, 200)
        runtime = self.client.get("/api/runtime/demo-park").json()["data"]["scene"]
        self.assertNotIn("authValue", runtime["dataSources"][0])
        self.assertTrue(runtime["dataSources"][0]["hasAuthValue"])

        data_dir = Path(self.temp_dir.name)
        self.assertTrue((data_dir / "projects.json").exists())
        self.assertTrue((data_dir / ".secret-key").exists())
        self.assertNotIn("TOP-SECRET", (data_dir / "projects.json").read_text("utf-8"))
        self.assertNotIn("TOP-SECRET", (data_dir / "secrets.json").read_text("utf-8"))

    def test_asset_validation_and_delete(self):
        invalid = self.client.post(
            "/api/projects/demo-park/assets",
            content=b"not a png",
            headers={"content-type": "image/png", "x-file-name": "bad.png"},
        )
        self.assertEqual(invalid.status_code, 422)

        document = json.dumps({"asset": {"version": "2.0"}, "scenes": [{}]}).encode()
        document += b" " * ((4 - len(document) % 4) % 4)
        glb = (
            struct.pack("<4sII", b"glTF", 2, 20 + len(document))
            + struct.pack("<II", len(document), 0x4E4F534A)
            + document
        )
        uploaded = self.client.post(
            "/api/projects/demo-park/assets",
            content=glb,
            headers={"content-type": "model/gltf-binary", "x-file-name": "valid.glb"},
        )
        self.assertEqual(uploaded.status_code, 200)
        asset = uploaded.json()["data"]
        self.assertEqual(asset["validationStatus"], "validated")
        self.assertEqual(self.client.get(f"/api/assets/{asset['id']}/content").status_code, 200)
        self.assertEqual(self.client.delete(f"/api/assets/{asset['id']}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/assets/{asset['id']}/content").status_code, 404)

    def test_private_data_source_addresses_are_blocked(self):
        from fastapi import HTTPException

        from backend.routes.data_sources import _guard_url

        for url in ("http://127.0.0.1", "http://10.0.0.1", "http://192.168.1.1"):
            with self.subTest(url=url), self.assertRaises(HTTPException) as raised:
                _guard_url(url)
            self.assertEqual(raised.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
