from main import get_port
import os
def test_port():
    os.environ['PORT'] = 'not-a-number'
    assert get_port() > 0