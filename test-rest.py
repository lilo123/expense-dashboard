import os
import urllib.request
import json

env = {}
with open(".env.local") as f:
    for line in f:
        if line.strip() and not line.startswith("#"):
            key, val = line.strip().split("=", 1)
            env[key] = val.strip(" \"\x27")

url = env["NEXT_PUBLIC_SUPABASE_URL"]
key = env["SUPABASE_SERVICE_ROLE_KEY"]

req = urllib.request.Request(f"{url}/rest/v1/rpc/test_auth_role", headers={"apikey": key, "Authorization": f"Bearer {key}"}, method="POST")
with urllib.request.urlopen(req) as response:
    print("ROLE IS:", response.read().decode())

