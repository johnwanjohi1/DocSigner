"""Checks the Play Store text in PLAYSTORE.md against Google Play's character limits."""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
text = open(os.path.join(ROOT, "PLAYSTORE.md"), encoding="utf-8").read()


def block_after(heading):
    i = text.index(heading)
    m = re.search(r"( *)```\n(.*?)\n *```", text[i:], re.S)
    indent = len(m.group(1))
    return "\n".join(line[indent:] for line in m.group(2).split("\n"))


checks = [
    ("App name", "### App name (max 30)", 30),
    ("Short description", "### Short description (max 80)", 80),
    ("Full description", "### Full description (max 4000)", 4000),
    ("Release notes", "### Release notes, version 1.0.0", 500),
    ("Swahili name", "**App name (max 30): copy**", 30),
    ("Swahili short description", "**Short description (max 80): copy**", 80),
    ("Swahili full description", "**Full description: copy**", 4000),
]
ok = True
for name, heading, limit in checks:
    n = len(block_after(heading))
    flag = "OK " if n <= limit else "TOO LONG"
    ok &= n <= limit
    print(f"{flag} {name}: {n}/{limit}")

benefit_headings = re.findall(r"\*\*[^*\n]*Benefits[^*\n]*: copy\*\*", text)
for heading in benefit_headings:
    lines = block_after(heading).splitlines()
    if len(lines) > 4:
        ok = False
        print(f"TOO MANY {heading}: {len(lines)} lines (max 4)")
    for b in lines:
        flag = "OK " if len(b) <= 40 else "TOO LONG"
        ok &= len(b) <= 40
        print(f"{flag} {heading.strip('*')} '{b}': {len(b)}/40")
if not benefit_headings:
    ok = False
    print("No benefit blocks found")

descs = re.findall(r"- (Monthly|Yearly): `([^`]+)`", text)
descs += re.findall(r"\| `docsigner_pro_(lifetime)` \|[^|]*\|\s*([^|]+?)\s*\|", text)
for pid, desc in descs:
    flag = "OK " if len(desc) <= 200 else "TOO LONG"
    ok &= len(desc) <= 200
    print(f"{flag} {pid} description: {len(desc)}/200")

print("ALL WITHIN LIMITS" if ok else "SOME FIELDS ARE TOO LONG")
