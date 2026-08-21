from main import calculate_discount
def test_discount():
    assert calculate_discount(100, 20) == 80
    assert calculate_discount(100, 110) >= 0  # Should not be negative