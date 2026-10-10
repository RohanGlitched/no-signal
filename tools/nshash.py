"""Check a run saved from the page against the page's hash: python tools/nshash.py file hash"""
import sys
s = open(sys.argv[1], encoding="utf-8").read().strip()
h = 0
for ch in s:
    h = (h * 31 + ord(ch)) % 1000000007
print(len(s), h, "OK" if len(sys.argv) < 3 or str(h) == sys.argv[2] else "MISMATCH")
