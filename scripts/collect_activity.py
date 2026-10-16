#!/usr/bin/env python3
"""Collect authentic Chuncheon activity statistics. Never fabricate people counts."""
import collections
import csv
import io
import json
import pathlib
import re
import time
from datetime import datetime
from html import unescape

import requests

OUT = pathlib.Path("public/data/activity.json")
BASE = "https://www.data.go.kr/data/"
PAGES = {
    "bus": "15138095",
    "stops": "15045129",
    "sales": "15153903",
    "facility": "15094385",
}
UA = {"User-Agent": "Mozilla/5.0 (Chuncheon-mobility-public-data; source attribution retained)"}
session = requests.Session()
session.headers.update(UA)

def fetch_rows(which):
    source = BASE + PAGES[which] + "/fileData.do"
    page = session.get(source, timeout=24)
    page.raise_for_status()
    matches = re.findall(r'https://www\.data\.go\.kr/cmm/cmm/fileDownload\.do\?[^"\s<]+', page.text)
    if not matches:
        raise ValueError(f"{which}: source page has no official public CSV download")
    url = unescape(matches[0])
    result = session.get(url, timeout=75, headers={"Referer": source})
    result.raise_for_status()
    payload = result.content
    if not payload or payload[:150].lstrip().startswith(b"<"):
        raise ValueError(f"{which}: download returned an HTML page rather than CSV")
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            s = payload.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise ValueError(f"{which}: unknown CSV encoding")
    rows = list(csv.DictReader(io.StringIO(s)))
    if not rows:
        raise ValueError(f"{which}: file has no records")
    print(f"{which}: downloaded {len(rows)} rows; columns: {list(rows[0])}")
    return rows

def get(r,*keys):
    for key in keys:
        value = str(r.get(key, "")).strip()
        if value:
            return value
    return ""
def coord(r,k):
    try:
        return float(get(r,k))
    except (ValueError,TypeError):
        return float("nan")
def integer(v):
    try:
        return int(float(str(v).replace(",","")))
    except (ValueError,TypeError):
        return 0
def valid_point(lat,lon):
    return 37.55 < lat < 38.12 and 127.35 < lon < 128.2
def normalize_name(s):
    return re.sub(r"\s+|\([^)]*\)|[·\-]","",s).lower()

data={
 "generatedAt":datetime.now().astimezone().isoformat(),
 "bus":[], "sales":[], "facility":[],
 "metadata":{},
 "sources":{
   "bus":BASE+PAGES["bus"]+"/fileData.do",
   "stops":BASE+PAGES["stops"]+"/fileData.do",
   "sales":BASE+PAGES["sales"]+"/fileData.do",
   "facility":BASE+PAGES["facility"]+"/fileData.do",
 }
}

try:
    stops=fetch_rows("stops")
    by_id={}
    by_name=collections.defaultdict(list)
    for r in stops:
        la,lo=coord(r,"위도"),coord(r,"경도")
        if not valid_point(la,lo): continue
        point=(la,lo,get(r,"정류장명"))
        for key in ("정류장 번호","관리번호"):
            s=get(r,key)
            if s: by_id[s]=point
        by_name[normalize_name(point[2])].append(point)
    bus=fetch_rows("bus")
    grouped=collections.defaultdict(lambda: [0,0,set(),set()])
    for r in bus:
        identifier=get(r,"정류장아이디")
        name=get(r,"정류장명")
        date=get(r,"수집일자")
        board=integer(get(r,"승차건수"))
        alight=integer(get(r,"하차건수"))
        g=grouped[(identifier,name)]
        g[0]+=board;g[1]+=alight
        if re.match(r"20\d\d-\d\d-\d\d",date):g[2].add(date[:10])
        g[3].add(get(r,"이용시간대"))
    found=0; idmatches=0; namematches=0
    for (identifier,name),(board,alight,days,hours) in grouped.items():
        point=by_id.get(identifier)
        if point:idmatches+=1
        if not point:
            choices=by_name.get(normalize_name(name),[])
            if len(choices)==1:
                point=choices[0]
                namematches+=1
        if not point:continue
        found+=1
        data["bus"].append({
            "id":identifier, "name":name, "lat":point[0],"lon":point[1],
            "board":board,"alight":alight,
            "start":min(days) if days else "", "end":max(days) if days else "",
            "observedDays":len(days), "hoursCount":len(hours)
        })
    all_dates=[get(r,"수집일자") for r in bus if re.match(r"20\d\d-",get(r,"수집일자"))]
    data["metadata"]["bus"]={"rawRows":len(bus),"matchedStops":found,"totalStops":len(grouped),
      "idMatched":idmatches,"nameMatched":namematches,
      "periodStart":min(all_dates) if all_dates else None,
      "periodEnd":max(all_dates) if all_dates else None,
      "truncatedPossible":len(bus)==65535,
      "note":"정류장 명칭이 단독으로 유일한 경우에만 위치를 연결. 승하차 합계는 중복 방문자가 포함될 수 있음."
    }
    print("bus: geocoded",found,"of",len(grouped),"id",idmatches,"unique-name",namematches)
except Exception as ex:
    data["metadata"]["bus"]={"error":str(ex)}
    print("bus: failed",repr(ex))

try:
    sales=fetch_rows("sales")
    by_dong=collections.defaultdict(lambda: [set(),0,collections.Counter()])
    date_values=set()
    for r in sales:
        dong=get(r,"읍면동")
        sector=get(r,"업종구분")
        band=get(r,"매출액")
        dt=get(r,"기준일자")
        if dt:date_values.add(dt)
        if not dong:continue
        by_dong[dong][0].add(sector)
        by_dong[dong][1]+=1
        if band:by_dong[dong][2][band]+=1
    data["sales"]=[{"name":k,"sectorCount":len(v[0]),"records":v[1],
                   "bands":v[2].most_common(5)} for k,v in by_dong.items()]
    data["metadata"]["sales"]={
        "rawRows":len(sales),"districts":len(data["sales"]),
        "dates":sorted(date_values)[:8],"note":"방문자 수가 아니라 2023년까지 공개된 상권 매출액 범주입니다. 좌표 없이 행정동 이름으로 제공됨."
    }
    print("sales: parsed",len(data["sales"]),"districts")
except Exception as ex:
    data["metadata"]["sales"]={"error":str(ex)}
    print("sales: failed",repr(ex))

try:
    facility=fetch_rows("facility")
    groups=collections.defaultdict(lambda:[0,0])
    for r in facility:
        name=get(r,"시설코드")
        year=integer(get(r,"년도"))
        month=integer(get(r,"월"))
        n=integer(get(r,"인원"))
        if name and 2000<=year<=2030 and 1<=month<=12:
            g=groups[(name,year,month)]
            g[0]+=n
            g[1]+=1
    data["facility"]=[
        {"name":name,"year":year,"month":month,"visitors":v[0]}
        for (name,year,month),v in groups.items()
    ]
    years=sorted({p["year"] for p in data["facility"]})
    data["metadata"]["facility"]={"rawRows":len(facility),"years":years,
        "note":"춘천도시공사의 시설 입장객 수(관광·체육·복지시설 혼재). 춘천 전체 관광객 수 아님."
    }
    print("facility: parsed",len(data["facility"]),"months",years)
except Exception as ex:
    data["metadata"]["facility"]={"error":str(ex)}
    print("facility: failed",repr(ex))

OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
print("activity stats:",{key:len(data[key]) for key in ("bus","sales","facility")})
