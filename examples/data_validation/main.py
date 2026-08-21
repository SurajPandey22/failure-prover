def register_user(email):
    if "@" not in email:
        raise ValueError("Invalid email")
    return True