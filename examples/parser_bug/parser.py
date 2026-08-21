def parse_header(header_line: str):
    # Expects "ID,NAME,AGE"
    parts = header_line.split(",")
    if len(parts) != 3:
        raise ValueError("Invalid header format")
    
    # Bug: assumes age is always an integer, but it can be "AUTO" in some files
    age = parts[2] if parts[2] == "AUTO" else int(parts[2])
    return {
        "id": parts[0],
        "name": parts[1],
        "age": age
    }
