from main import build_path
def test_build_path():
    assert build_path('c:\\dir', 'file.txt') == 'c:\\dir/file.txt'