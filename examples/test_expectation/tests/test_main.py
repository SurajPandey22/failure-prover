from main import get_status
def test_status():
    assert get_status() == {"status": "ok", "code": 200}