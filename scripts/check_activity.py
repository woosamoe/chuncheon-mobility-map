#!/usr/bin/env python3
"""Prevent publishing empty/corrupt mobility activity snapshots."""
from pathlib import Path
import json

path=Path("public/data/activity.json")
assert path.is_file(), "Missing activity.json"
data=json.loads(path.read_text(encoding="utf-8"))
bus=data.get("bus") or []
market=data.get("sales") or []
facility=data.get("facility") or []
geocoded=sum(1 for r in market if r.get("lat") is not None and r.get("lon") is not None)
tour_sites={"소양강스카이워크","구곡폭포","삼악산","청평사"}
tour_years={r["name"]:sorted({x["year"] for x in facility if x["name"]==r["name"]})
            for r in facility if r.get("name") in tour_sites}
print("VALIDATE activity:",len(bus),"bus locations,",len(market),"markets,",geocoded,
      "market locations,",len(facility),"admission records; tour sites",tour_years)
assert len(bus)>=100, "Refusing to deploy: bus snapshot lost"
assert len(market)>=20, "Refusing to deploy: sales snapshot lost"
assert geocoded>=20, "Refusing to deploy: market district coordinates unavailable"
assert len(facility)>=500, "Refusing to deploy: facility visitor snapshot lost"
assert len(tour_years)==len(tour_sites), "Refusing to deploy: verified tourist attractions unavailable"
