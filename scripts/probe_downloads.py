import csv,io,re,json,requests
pages={"bus":"https://www.data.go.kr/data/15138095/fileData.do","stops":"https://www.data.go.kr/data/15045129/fileData.do","admissions":"https://www.data.go.kr/data/15094385/fileData.do","stores":"https://www.data.go.kr/data/15083033/fileData.do"}
for tag,url in pages.items():
 try:
  sess=requests.Session()
  page=sess.get(url,timeout=30)
  links=re.findall(r'https://www\.data\.go\.kr/cmm/cmm/fileDownload\.do\?[^"\s<]+',page.text)
  print(tag,"page",page.status_code,"links",len(links),"first",links[:1])
  if not links:continue
  u=links[0].replace('&amp;','&')
  with sess.get(u,timeout=60,stream=True,headers={"Referer":url,"User-Agent":"Mozilla/5.0"}) as r:
   chunk=next(r.iter_content(chunk_size=8192),b"")
   print(tag,"file",r.status_code,"type",r.headers.get('content-type'),"bytes",r.headers.get('content-length'),"disposition",r.headers.get('content-disposition'),"head",repr(chunk[:300]))
   for enc in ["utf-8-sig","cp949"]:
    try:print(tag,"sample-"+enc,repr(chunk[:2400].decode(enc)[:400]));break
    except UnicodeDecodeError:pass
 except Exception as ex: print(tag,"error",repr(ex)[:300])
