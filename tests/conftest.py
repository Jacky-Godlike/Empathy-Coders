import pytest
from fastapi.testclient import TestClient
from src.backend_b.main import app
@pytest.fixture
def client():
    return TestClient(app)
