import pytest
from src.backend_b import config

def test_order(client):
    r=client.post("/analyze",json={"message":"Hi, I want to order 10 notebooks for RM5 each.","message_id":"msg_001"})
    d=r.json()
    assert r.status_code==200 and d["message_type"]=="order" and d["quantity"]==10 and d["unit_price"]==5
    assert d["extraction_method"]=="fallback" and "customer_name" in d["missing_fields"]

def test_inquiry(client):
    assert client.post("/analyze",json={"message":"What is the price of notebooks?"}).json()["message_type"]=="inquiry"

def test_after_sales(client):
    assert client.post("/analyze",json={"message":"I want a refund"}).json()["message_type"]=="after_sales"

def test_uncertain(client):
    assert client.post("/analyze",json={"message":"???"}).json()["message_type"]=="uncertain"

def test_blank(client):
    assert client.post("/analyze",json={"message":"   "}).status_code==422

def test_bad_type(client):
    assert client.post("/analyze",json={"message":123}).status_code==422

def test_chinese(client):
    d=client.post("/analyze",json={"message":"我要订购20本笔记本，每本RM5。"}).json()
    assert d["message_type"]=="order" and d["quantity"]==20 and d["unit_price"]==5

@pytest.mark.parametrize("reply", ["not json", '{"message_type":"order"}', '{"message_type":"order","customer_name":null,"customer_phone":null,"product_name":null,"quantity":"ten","unit_price":null,"delivery_address":null,"requested_delivery_date":null,"confidence":0.9}'])
def test_bad_ai_fallback(client,monkeypatch,reply):
    import httpx
    from src.backend_b import ai_service
    monkeypatch.setattr(config,"AI_PROVIDER","openai_compatible")
    monkeypatch.setattr(config,"AI_API_KEY","test-placeholder")
    monkeypatch.setattr(config,"AI_MODEL","mock-model")
    class MockClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs):
            return httpx.Response(200,json={"choices":[{"message":{"content":reply}}]},request=httpx.Request("POST","https://example.test"))
    monkeypatch.setattr(ai_service.httpx,"AsyncClient",lambda **kw:MockClient())
    d=client.post("/analyze",json={"message":"order 10 notebooks for RM5"}).json()
    assert d["extraction_method"]=="fallback" and d["quantity"]==10

def test_network_fallback(client,monkeypatch):
    from src.backend_b import ai_service
    monkeypatch.setattr(config,"AI_PROVIDER","openai_compatible")
    monkeypatch.setattr(config,"AI_API_KEY","test-placeholder")
    monkeypatch.setattr(config,"AI_MODEL","mock-model")
    class BadClient:
        async def __aenter__(self): return self
        async def __aexit__(self,*args): pass
        async def post(self,*args,**kwargs): raise ai_service.httpx.ConnectError("offline")
    monkeypatch.setattr(ai_service.httpx,"AsyncClient",lambda **kw:BadClient())
    assert client.post("/analyze",json={"message":"order 10 notebooks"}).json()["extraction_method"]=="fallback"
