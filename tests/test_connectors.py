def test_messages(client):
    d=client.get("/connectors/messages").json()
    assert d["total"]>=8 and len(d["messages"])>=8

def test_filter(client):
    d=client.get("/connectors/messages?source=email&limit=2").json()
    assert len(d["messages"])==2 and all(m["source"]=="email" for m in d["messages"])

def test_suppliers(client):
    d=client.get("/connectors/suppliers").json()
    assert d["total"]>=3 and d["suppliers"][0]["unit_cost"]>0

def test_invalid_params(client):
    assert client.get("/connectors/messages?source=invalid").status_code==422
    assert client.get("/connectors/messages?limit=0").status_code==422
