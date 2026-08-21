import os
def get_port():
    return int(os.environ.get('PORT', '8080')) + 1