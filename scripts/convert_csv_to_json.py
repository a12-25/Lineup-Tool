import csv
import json
import re
from pathlib import Path


def normalize_key(key):
    return re.sub(r"[^a-zA-Z0-9]+", " ", key or "").strip().lower().replace(" ", " ")


def parse_value(value):
    if value is None:
        return None
    text = str(value).strip()
    if text == "":
        return None
    if text in {"TRUE", "FALSE"}:
        return text == "TRUE"
    if text.startswith("$"):
        return text
    if text.endswith("%"):
        try:
            return float(text.rstrip("%")) / 100.0
        except ValueError:
            return text
    try:
        if "," in text:
            return float(text.replace(",", ""))
        return float(text)
    except ValueError:
        return text


script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent
source_csv = project_root / "Lineup Tool - Players (1).csv"
output_json = script_dir.parent / "private" / "players.json"

if not source_csv.exists():
    raise FileNotFoundError(f"Player CSV not found: {source_csv}")

rows = []
with source_csv.open("r", encoding="utf-8-sig", newline="") as csv_file:
    reader = csv.DictReader(csv_file)
    for row in reader:
        if not row or not row.get("Player"):
            continue
        normalized = {}
        for key, value in row.items():
            if key is None:
                continue
            normalized_key = normalize_key(key)
            normalized[normalized_key] = parse_value(value)
        rows.append({
            "player": normalized.get("player"),
            "position": normalized.get("pos"),
            "raw": normalized,
        })

output_json.parent.mkdir(parents=True, exist_ok=True)
output_json.write_text(json.dumps(rows, indent=2), encoding="utf-8")
print(f"Generated {len(rows)} player records at {output_json}")
