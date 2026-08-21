from parser import parse_header
import pytest

def test_parse_header_normal():
    res = parse_header("1,Alice,30")
    assert res["age"] == 30

def test_parse_header_auto():
    # This will fail with a ValueError
    res = parse_header("2,Bob,AUTO")
    assert res["age"] == "AUTO"
