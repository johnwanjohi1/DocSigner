"""Checks the Play Store text in store/LISTING.md against Google Play's character limits."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(ROOT, "store", "LISTING.md"), encoding="utf-8").read()


def block_after(heading):
    i = text.index(heading)
    m = re.search(r"```\n(.*?)\n```", text[i:], re.S)
    return m.group(1)


checks = [
    ("App name", "## 1. App name", 30),
    ("Short description", "## 2. Short description", 80),
    ("Full description", "## 3. Full description", 4000),
    ("Release notes", "## 4. What's new", 500),
    ("Swahili name", "**Jina (max 30):**", 30),
    ("Swahili short description", "**Maelezo mafupi (max 80):**", 80),
    ("Swahili full description", "**Maelezo kamili:**", 4000),
]
ok = True
for name, heading, limit in checks:
    n = len(block_after(heading))
    flag = "OK " if n <= limit else "TOO LONG"
    ok &= n <= limit
    print(f"{flag} {name}: {n}/{limit}")

benefits = block_after("Benefits for both subscriptions:").splitlines()
for b in benefits:
    flag = "OK " if len(b) <= 40 else "TOO LONG"
    ok &= len(b) <= 40
    print(f"{flag} benefit '{b}': {len(b)}/40")

for row in re.findall(r"\| `(docsigner_pro_\w+)` \|[^|]*\|\s*([^|]+?)\s*\|", text):
    pid, desc = row
    flag = "OK " if len(desc) <= 200 else "TOO LONG"
    ok &= len(desc) <= 200
    print(f"{flag} {pid} description: {len(desc)}/200")

print("ALL WITHIN LIMITS" if ok else "SOME FIELDS ARE TOO LONG")
