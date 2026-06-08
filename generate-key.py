#!/usr/bin/env python3
"""
Generate a secure random access key for tavily-mcp-proxy.
Produces a 64-character string of mixed uppercase, lowercase, and digits.
"""
import secrets
import string

KEY_LENGTH = 64
ALPHABET = string.ascii_uppercase + string.ascii_lowercase + string.digits


def generate_key(length: int = KEY_LENGTH) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(length))


if __name__ == "__main__":
    key = generate_key()
    print(key)
