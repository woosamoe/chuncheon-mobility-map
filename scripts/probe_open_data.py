import re,requests
urls={"bus":"https://www.data.go.kr/data/15138095/fileData.do","stops":"https://www.data.go.kr/data/15045129/fileData.do","tour":"https://www.data.go.kr/data/15094385/fileData.do"}
for label,url in urls.items():
 try:
  r=requests.get(url, timeout=20, headers={"User-Agent":"Mozilla/5.0"})
  s=r.text
  print(label,r.status_code,len(s),r.url,repr(s[:160]))
  for pat in ["fileDownload","atchFileId","fileDetailSn","fileDataId","fileUrl","fileSn","fn_datasetFileDownload","download","csv"]:
   snippets=[re.sub(r"\s+"," ",s[max(0,m.start()-100):m.end()+175]) for m in list(re.finditer(pat,s,re.I))[:5]]
   print(" ",pat,repr(snippets)[:1200])
 except Exception as e:print(label,"ERR",str(e)[:450])
