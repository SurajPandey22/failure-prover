from main import get_item
def test_boundary():
    assert get_item([1, 2, 3], 3) == 4