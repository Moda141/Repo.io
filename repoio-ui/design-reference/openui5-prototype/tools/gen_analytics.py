import json, random
random.seed(7)
import os
OUT=os.path.join(os.path.dirname(__file__), '..', 'webapp', 'model', 'analytics.json')
reports=[
 ("RPT_CUSTOMER_GOLDEN","Customer golden records","السجلات الذهبية للعملاء","alp","customers","golden.customer","published","سارة عادل","2026-11-09 14:20",412,True,2),
 ("STY_MDM_OVERVIEW","MDM governance overview","نظرة عامة على حوكمة البيانات الرئيسية","story","customers","mdm.governance_kpis","published","محمد","2026-11-10 09:05",655,True,3),
 ("RPT_VENDOR_GOLDEN","Vendor golden records","السجلات الذهبية للموردين","alp","vendors","golden.vendor","published","هالة سمير","2026-11-06 11:40",188,True,1),
 ("RPT_BOOK_CATALOGUE","Book catalogue completeness","اكتمال كتالوج الكتب","alp","products","golden.product","published","كريم فوزي","2026-11-07 16:02",241,False,1),
 ("STY_DQ_SCORECARD","Data quality scorecard","بطاقة أداء جودة البيانات","story","customers","dq.results","published","أحمد ناصر","2026-11-08 08:30",377,True,2),
 ("RPT_OPEN_CR","Open change requests","طلبات التغيير المفتوحة","alp","customers","cr.change_requests","published","سارة عادل","2026-11-10 07:45",520,True,1),
 ("RPT_MATCH_QUEUE","Potential duplicates queue","قائمة التكرارات المحتملة","alp","customers","matched.customer","published","سارة عادل","2026-11-05 13:10",163,False,0),
 ("STY_STEWARD_WORKLOAD","Stewardship workload","عبء عمل أمناء البيانات","story","vendors","cr.change_requests","draft","محمد","2026-11-09 18:25",0,False,0),
 ("RPT_AUTHOR_CONTRACTS","Authors without active contract","مؤلفون بدون عقد سارٍ","alp","authors","golden.author","published","نور الدين","2026-10-30 10:00",74,False,0),
 ("RPT_EMPLOYEE_SYNC","Employee sync exceptions","استثناءات مزامنة الموظفين","alp","employees","golden.employee","inReview","منى حسن","2026-11-04 12:35",0,False,0),
 ("STY_STORE_NETWORK","Store network coverage","تغطية شبكة المتاجر","story","stores","golden.store","published","ياسر جمال","2026-10-28 15:50",96,True,1),
 ("RPT_WRITEBACK_LOG","C4C / ERP write-back results","نتائج الكتابة العكسية إلى C4C / ERP","alp","customers","wb.writeback_log","published","أحمد ناصر","2026-11-08 19:15",132,False,1),
 ("RPT_VENDOR_BANK","Vendor bank data changes","تغييرات البيانات البنكية للموردين","alp","vendors","audit.vendor_bank","published","عمر طارق","2026-11-03 09:20",58,False,1),
 ("STY_SOURCE_HEALTH","Source system health","سلامة الأنظمة المصدر","story","products","ops.pipeline_runs","draft","أحمد ناصر","2026-11-10 11:55",0,False,0),
 ("RPT_ISBN_ISSUES","ISBN validation issues","مشكلات التحقق من ISBN","alp","products","dq.results","published","كريم فوزي","2026-11-02 14:05",87,True,0),
 ("RPT_CUSTOMER_BLOCKED","Blocked customers","العملاء الموقوفون","alp","customers","golden.customer","retired","سارة عادل","2026-09-21 10:30",3,False,0),
]
R=[dict(id=r[0],en=r[1],ar=r[2],type=r[3],domain=r[4],source=r[5],status=r[6],owner=r[7],changed=r[8],views30=r[9],shared=r[10],broadcasts=r[11]) for r in reports]

# ALP sample: customer golden records
lines=[("schools","Schools","مدارس"),("bookstores","Bookstores","مكتبات"),("distributors","Distributors","موزعون"),("government","Government","جهات حكومية"),("ecommerce","E-commerce","تجارة إلكترونية")]
regions=[("cairo","Cairo","القاهرة"),("giza","Giza","الجيزة"),("alex","Alexandria","الإسكندرية"),("delta","Delta","الدلتا"),("upper","Upper Egypt","الصعيد"),("gcc","GCC export","تصدير الخليج")]
srcs=[("c4c","SAP C4C"),("erp","SAP ERP"),("both","C4C + ERP"),("sql","SQL Server")]
pre_ar={"schools":["مدرسة","مدارس"],"bookstores":["مكتبة","مكتبة"],"distributors":["شركة","مؤسسة"],"government":["مديرية","إدارة"],"ecommerce":["متجر","منصة"]}
pre_en={"schools":["School","Schools"],"bookstores":["Bookstore","Library"],"distributors":["Co.","Trading"],"government":["Directorate","Authority"],"ecommerce":["Store","Online"]}
names=[("النور","Al Nour"),("الأمل","Al Amal"),("المستقبل","El Mostakbal"),("الفجر","El Fagr"),("الرواد","El Rowad"),("النيل","El Nile"),("الحكمة","El Hekma"),("السلام","El Salam"),("الأزهار","El Azhar"),("الشروق","El Shorouk"),("المعرفة","El Maarefa"),("الإبداع","El Ebdaa"),("الياسمين","El Yasmin"),("الهدى","El Hoda"),("القمة","El Qemma"),("الندى","El Nada"),("الأوائل","El Awael"),("التميز","El Tamayoz"),("الرسالة","El Resala"),("الكوثر","El Kawthar")]
rows=[]
for i in range(132):
    bl=random.choices(lines,weights=[40,25,12,10,13])[0]
    rg=random.choices(regions,weights=[34,18,16,14,10,8])[0]
    sr=random.choices(srcs,weights=[30,22,38,10])[0]
    nm=random.choice(names)
    dq=max(48,min(100,int(random.gauss(88,9))))
    m=random.randint(1,10)*0+random.choice([9,10,10,11,11,11])
    d=random.randint(1,28 if m!=11 else 9)
    rows.append(dict(id="GR-C-%06d"%(104200+i*37), ar=pre_ar[bl[0]][i%2]+" "+nm[0], en=nm[1]+" "+pre_en[bl[0]][i%2],
        line=bl[0], region=rg[0], source=sr[0], sources=2 if sr[0]=="both" else 1, dq=dq,
        changed="2026-%02d-%02d %02d:%02d"%(m,d,random.randint(7,19),random.randint(0,59)), status="blocked" if random.random()<0.05 else "active"))
alp=dict(dims=dict(line=[dict(key=a,en=b,ar=c) for a,b,c in lines], region=[dict(key=a,en=b,ar=c) for a,b,c in regions], source=[dict(key=a,en=b,ar=b) for a,b in srcs],
   dq=[dict(key="lt70",en="< 70",ar="< 70"),dict(key="70",en="70–84",ar="70–84"),dict(key="85",en="85–94",ar="85–94"),dict(key="95",en="95+",ar="95+")]), rows=rows)

# Story (studio) tiles
dom_ids=["customers","products","vendors","authors","employees","stores"]
story=dict(pages=[
 dict(key="overview",tiles=[
  dict(id="t1",title="goldenByDomain",sub="count",chart="column",measure="goldenRecords",dim="domain",data=[48210,26340,3120,1875,1240,388]),
  dict(id="t2",title="crTrend",sub="perWeek",chart="line",measure="openCr",dim="week",data=[64,71,58,82,77,69,54,61]),
  dict(id="t3",title="dqByDomain",sub="pct",chart="bar",measure="dqScore",dim="domain",data=[91.4,86.2,93.8,88.1,95.3,90.6]),
  dict(id="t4",title="bySource",sub="count",chart="donut",measure="sourceRecords",dim="source",data=[61200,38400,7350]),
  dict(id="t5",title="matchRate",sub="pct",chart="column",measure="autoMerge",dim="domain",data=[72,64,81,58,90,77]),
  dict(id="t6",title="cycleTime",sub="hours",chart="kpi",measure="crCycle",dim="none",data=[18.4],delta=-2.1)]),
 dict(key="changeRequests",tiles=[
  dict(id="t7",title="crByStatus",sub="count",chart="stacked",measure="openCr",dim="domain",data=[[22,9,4],[14,6,2],[6,3,1],[3,1,0],[2,1,0],[1,0,0]]),
  dict(id="t8",title="crTrend",sub="perWeek",chart="line",measure="openCr",dim="week",data=[64,71,58,82,77,69,54,61])]),
 dict(key="dataQuality",tiles=[
  dict(id="t9",title="dqByDomain",sub="pct",chart="bar",measure="dqScore",dim="domain",data=[91.4,86.2,93.8,88.1,95.3,90.6]),
  dict(id="t10",title="dqTrend",sub="pct",chart="line",measure="dqScore",dim="week",data=[87.2,87.9,88.4,88.1,89.0,89.6,90.2,90.8])])
])
broadcasts=[
 ("BC-0012","Weekly MDM governance pack","حزمة حوكمة البيانات الأسبوعية","story","STY_MDM_OVERVIEW","overview","pdf",False,"weekly","Sun 08:00","active","sent","2026-11-08 08:00","2026-11-15 08:00",["محمد","سارة عادل","هالة سمير","كريم فوزي"],"محمد"),
 ("BC-0011","Open change requests – daily","طلبات التغيير المفتوحة – يومي","report","RPT_OPEN_CR","byDomain","xlsx",False,"daily","07:30","active","sent","2026-11-10 07:30","2026-11-11 07:30",["سارة عادل","هالة سمير","عمر طارق"],"سارة عادل"),
 ("BC-0010","Customer golden records – monthly","السجلات الذهبية للعملاء – شهري","report","RPT_CUSTOMER_GOLDEN","standard","xlsx",True,"monthly","1st 06:00","active","partial","2026-11-01 06:00","2026-12-01 06:00",["محمد","نور الدين","ياسر جمال"],"سارة عادل"),
 ("BC-0009","DQ scorecard to stewards","بطاقة الجودة لأمناء البيانات","story","STY_DQ_SCORECARD","overview","pdf",False,"weekly","Thu 09:00","paused","sent","2026-10-30 09:00","",["سارة عادل","كريم فوزي","هالة سمير","عمر طارق","منى حسن"],"أحمد ناصر"),
 ("BC-0008","Vendor bank changes – audit","تغييرات بنوك الموردين – تدقيق","report","RPT_VENDOR_BANK","standard","csv",True,"weekly","Mon 07:00","active","failed","2026-11-09 07:00","2026-11-16 07:00",["عمر طارق","هالة سمير"],"عمر طارق"),
 ("BC-0007","Write-back results","نتائج الكتابة العكسية","report","RPT_WRITEBACK_LOG","failedOnly","xlsx",False,"daily","18:00","active","sent","2026-11-09 18:00","2026-11-10 18:00",["أحمد ناصر","سارة عادل"],"أحمد ناصر"),
 ("BC-0006","Book catalogue – one-off","كتالوج الكتب – مرة واحدة","report","RPT_BOOK_CATALOGUE","standard","xlsx",True,"none","","completed","sent","2026-11-03 12:10","",["كريم فوزي","نور الدين"],"كريم فوزي"),
 ("BC-0005","Store network – quarterly","شبكة المتاجر – ربع سنوي","story","STY_STORE_NETWORK","overview","pdf",False,"monthly","1st 08:00","draft","","","",["ياسر جمال"],"ياسر جمال"),
]
B=[dict(id=b[0],en=b[1],ar=b[2],objType=b[3],object=b[4],view=b[5],format=b[6],zip=b[7],schedule=b[8],at=b[9],status=b[10],last=b[11],lastRun=b[12],nextRun=b[13],recipients=b[14],owner=b[15]) for b in broadcasts]
json.dump(dict(reports=R,alp=alp,story=story,broadcasts=B),open(OUT,'w'),ensure_ascii=False,indent=1)
print(len(R),len(rows),len(B))
