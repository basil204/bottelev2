import re

text = open("input.txt", "r", encoding="utf-8").read()

# Bỏ các dòng ━━━━━━━━━━━━━
text = re.sub(r'^\s*━+\s*$', '', text, flags=re.MULTILINE)

# Bỏ số thứ tự 1. ... 30.
text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)

# Bỏ dòng trống
text = "\n".join(
    line.strip()
    for line in text.splitlines()
    if line.strip()
)

open("output.txt", "w", encoding="utf-8").write(text)

print(text)