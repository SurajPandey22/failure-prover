from main import load_config
def test_load_config():
    cfg = load_config()
    assert cfg is not None