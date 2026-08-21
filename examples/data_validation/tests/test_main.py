from main import register_user
def test_register():
    assert register_user("invalid_email")