#!/usr/bin/env python3
"""Attach identifiable Chuncheon administrative-dong locations to market statistics.
Coordinates are derived from census/administrative boundaries, NOT from foot traffic.
Source: https://github.com/vuski/admdongkor (SGIS boundary processing), 2026-07-01.
"""
import json
import math
import pathlib
import re
import requests

DATA=pathlib.Path("public/data/activity.json")
GEO="https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson"

def normalize(s):
    return re.sub(r"[\s\-·]+", "", str(s or "")).replace("춘천시","")

def rings(geometry):
    if geometry.get("type")=="Polygon":
        return [poly[0] for poly in [geometry.get("coordinates", [])] if poly]
    if geometry.get("type")=="MultiPolygon":
        return [poly[0] for poly in geometry.get("coordinates",[]) if poly]
    return []

def center(geom):
    # Area-weighted exterior-ring centroid. The location represents the district,
    # never a measured concentration of pedestrians.
    weighted_x=weighted_y=weighted=0.0
    for ring in rings(geom):
        if len(ring)<3:continue
        area=mx=my=0.0
        for i in range(len(ring)):
            ax,ay=ring[i][:2]
            bx,by=ring[(i+1)%len(ring)][:2]
            d=ax*by-bx*ay
            area+=d
            mx+=(ax+bx)*d
            my+=(ay+by)*d
        if abs(area)<1e-12:continue
        x,y=mx/(3*area),my/(3*area)
        weight=abs(area)
        weighted_x+=x*weight
        weighted_y+=y*weight
        weighted+=weight
    if weighted==0:return None
    return [weighted_y/weighted,weighted_x/weighted,weighted]

def valid(p):
    return p and 37.5<p[0]<38.2 and 127.3<p[1]<128.3

activity=json.loads(DATA.read_text(encoding="utf-8"))
features=requests.get(GEO,timeout=110,headers={"User-Agent":"chuncheon-mobility-map/1.0 (public static project; source credited)"}).json()["features"]
print("ADMIN-GEO features",len(features),"sample",features[0].get("properties",{}))
reference=[]
for feat in features:
    p=feat.get("properties",{})
    name=normalize(p.get("adm_nm") or p.get("ADM_NM"))
    if name in ("석사동","퇴계동"):
        c=center(feat.get("geometry",{}))
        if valid(c):reference.append((name,str(p.get("adm_cd","")),c))
print("ADMIN-GEO Chuncheon references",reference[:10])
# Infer locality from verifiable local administrative neighborhoods, instead of
# blindly accepting same-named 읍·면·동 elsewhere in the country.
prefixes={p[1][:5] for p in reference if p[1] and len(p[1])>=5}
print("ADMIN-GEO district prefixes",sorted(prefixes))
byname={}
for feat in features:
    p=feat.get("properties",{})
    adm=str(p.get("adm_cd",""))
    if prefixes and adm[:5] not in prefixes:continue
    name=normalize(p.get("adm_nm") or p.get("ADM_NM"))
    if not name:continue
    c=center(feat.get("geometry",{}))
    if not valid(c):continue
    byname.setdefault(name,[]).append(c)
matched=missing=0
for row in activity.get("sales",[]):
    key=normalize(row.get("name"))
    found=byname.get(key,[])
    if not found:
        missing+=1
        print("ADMIN-GEO unmatched market district:",row.get("name"))
        continue
    total=sum(p[2] for p in found)
    if not total:continue
    row["lat"]=round(sum(p[0]*p[2] for p in found)/total,7)
    row["lon"]=round(sum(p[1]*p[2] for p in found)/total,7)
    row["locationSource"]="행정동 경계 중심(통계청 기반 재가공, 2026-07-01)"
    matched+=1
activity.setdefault("metadata",{}).setdefault("sales",{})["districtsGeocoded"]=matched
activity["metadata"]["sales"]["locationReference"]=GEO
activity["metadata"]["sales"]["locationNote"]="읍면동 행정경계의 대략적인 중심 좌표이며 인구 밀집 위치가 아님"
print("ADMIN-GEO matched",matched,"unmatched",missing)

from collections import defaultdict
places=defaultdict(lambda:defaultdict(int))
for p in activity.get("facility",[]):
    places[p["name"]][p["year"]]+=p["visitors"]
for key in ("소양강스카이워크","구곡폭포","삼악산","강촌","구곡폭포관광지"):
    print("FACILITY-MARKER",key,[(name,dict(years)) for name,years in places.items() if key in name][:8])
print("FACILITY-sample",[(k,sorted(ys)) for k,ys in list(places.items())[:48]])

DATA.write_text(json.dumps(activity,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
