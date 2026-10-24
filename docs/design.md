# وثيقة تصميم: Master Data Platform (اسم المنتج: Repo.io)

الإصدار: مسودة 0.1 — 22 أكتوبر 2026
الـ Stack المختار: FastAPI (Python) + React + PostgreSQL + Splink + MCP + Docker

---

## 1. الهدف والنطاق

أداة Master Data مفتوحة المصدر وداخلية، بمعمارية قريبة من OpenMetadata، تجمع في مكان واحد:

| Tab | الوظيفة |
|---|---|
| **Catalog** | **مرآة (mirror) للبيانات القادمة من الـ sources**: الأنظمة المصدرية وجداولها وأعمدتها، ونسخة مرآة من بياناتها المسجّلة كمصادر master (`source_record`)، مع حالة المزامنة. الحوكمة الشاملة (lineage على مستوى المنصة، سياسات الـ governance) تبقى في OpenMetadata ونتزامن معها (3.4) |
| **Tasks** | طابور شغل للـ data stewards: مراجعة matches، فشل DQ، موافقات |
| **Customer 360** | عرض موحّد للعميل: golden record + السجلات المصدرية + الـ DQ + التاريخ |
| **Golden Records** | إدارة الـ clusters والـ survivorship والـ merge/unmerge |
| **Data Quality** | قواعد وتشغيل واختبارات، مبنية على Splink للـ matching/duplicates |
| **SQL Editor** | محرر SQL للاستكشاف وكتابة قواعد جودة مخصصة (Custom DQ Rules) وحفظها كاختبارات |
| **Tickets** | طلبات إنشاء جديدة (عميل جديد وغيره) مع فحص تكرار تلقائي ودورة موافقة |
| **Data Insights** | Dashboard وKPIs وتقرير دوري لقياس تغطية الـ descriptions والـ ownership والـ tiers ونشاط المستخدمين (مثل OpenMetadata) |
| **Settings** | **Access Tokens** (PAT وBots)، و**Roles & Policies**، و**Preferences** — مطابقة لمنظومة OpenMetadata v2.0.x (قسم 5.3 و5.4) |

**قرار معماري (22 أكتوبر 2026، مصحّح):** الأداة **لا تحل محل OpenMetadata**. OpenMetadata أداة **Data Governance** (catalog، glossary، lineage، ownership، سياسات)، وهذه الأداة **Master Data Management** (matching، golden records، stewardship، جودة بيانات الـ master). تعملان معاً وفق حدود واضحة (قسم 3.4). وتصبح الـ **Golden Records هي الـ Dimension Tables** للـ data platform (قسم 7.1)، ويُعاد الـ golden إلى **كل الأنظمة المصدرية** عبر write-back (قسم 7.2).

خارج النطاق في النسخة الأولى: الـ real-time matching، multi-tenancy. (الـ write-back **داخل النطاق** لكل المنصات، ويُنفَّذ بعد استقرار الـ matching والـ golden، انظر 7.2 وخارطة الطريق.)

---

### مرجع التصميم (UI)

الواجهة تتبع تصميم OpenMetadata كمرجع: [github.com/open-metadata/OpenMetadata](https://github.com/open-metadata/OpenMetadata) (مجلد `openmetadata-ui/src/main/resources/ui`). المأخوذ منه: التخطيط (قائمة جانبية + منطقة محتوى)، وألوان الـ theme الافتراضية (Primary `#1570EF`، Selected `#175CD3`، Hover `#D1E9FF`، Info `#84CAFF`، Success `#039855`، Warning `#DC6803`، Error `#D92D20`)، وتقسيم Settings إلى Preferences وRoles & Policies وBots/Tokens. والهوية البصرية (اللوجو والاسم **Repo.io**) خاصة بنا.

> ملاحظة ترخيص: OpenMetadata مرخّص Apache 2.0. نستلهم التصميم ولا ننسخ الكود حرفياً، وأي نقل مباشر لكود يحتاج الإبقاء على إشعار الترخيص.

## 2. المعمارية العامة

```
        ┌──────────────────────────── React UI ───────────────────────────┐
        │ Catalog│Tasks│Cust.360│Golden│DQ│SQL│Tickets│Insights│Settings  │
        └───────────────────────────────┬─────────────────────────────────┘
                                        │ REST / OpenAPI
┌───────────────┐   ┌───────────────────▼────────────────┐   ┌──────────────┐
│  MCP Server   ├──►│          API Server (FastAPI)      │◄──┤  Auth (OIDC) │
└───────────────┘   │  entities · rbac · workflows       │   └──────────────┘
                    └───┬──────────┬──────────┬──────────┘
                        │          │          │
               ┌────────▼───┐ ┌────▼─────┐ ┌──▼───────────┐
               │ PostgreSQL │ │  Search  │ │  Job Queue   │
               │ (metadata, │ │(Postgres │ │ (Redis+Arq)  │
               │  MDM store)│ │FTS → OS) │ └──┬───────────┘
               └────────────┘ └──────────┘    │
                                     ┌────────▼─────────────────────┐
                                     │ Workers                      │
                                     │  • Ingestion (connectors)    │
                                     │  • Matching (Splink+DuckDB)  │
                                     │  • DQ runner                 │
                                     └──────────────────────────────┘
```

### المقارنة مع OpenMetadata

| OpenMetadata | هنا |
|---|---|
| Java server (Dropwizard) | FastAPI، لأن Splink والـ connectors كلها Python |
| MySQL/Postgres | PostgreSQL فقط |
| Elasticsearch/OpenSearch | Postgres full-text في النسخة 1، وOpenSearch اختياري لاحقاً |
| Airflow لتشغيل الـ ingestion | **Kafka** كعمود فقري للـ ingestion (قسم 3.5)، مع جدولة الـ pollers بـ Arq + Redis وواجهة workflow YAML مشابهة |
| Ingestion framework: Source → Processor → Sink | نفس النمط حرفياً |
| Entities كـ JSON Schema | Pydantic models مولّدة من JSON Schema |

---

## 3. الـ Connectors

**واقع مهم:** OpenMetadata عنده عشرات الـ connectors (قواعد بيانات، warehouses، BI، pipelines، messaging، storage)، وإعادة كتابتها كلها غير واقعية. الاستراتيجية المقترحة:

1. **Connector SPI** بنفس عقد OpenMetadata:
   - `ServiceConnection` معرّف بـ JSON Schema (يولّد فورم الإعداد تلقائياً في الـ UI).
   - `Source` يبني topology: service → database → schema → table → column.
   - `test_connection()` وخطوات `ingest()` و`sample_data()` و`lineage()`.
2. **Adapter layer:** تشغيل connectors الـ `openmetadata-ingestion` الموجودة (مرخّصة Apache 2.0، وتحقق من نسخة الترخيص قبل الاعتماد) وتحويل مخرجاتها لنموذج بياناتنا بدل إعادة كتابتها.
3. **Connectors مخصصة** للي مش موجود: SAP C4C (عندك كود جاهز في الـ pipeline الحالي) وأي مصدر داخلي.
4. **SAP S/4HANA** و**REST Connector عام** (تفاصيلهم في 3.1 و3.2).

**ترتيب الموجات:**
- الموجة 1: PostgreSQL، MySQL، SQL Server، Oracle، CSV/Excel، SAP C4C (custom)، SAP S/4HANA، Generic REST
- الموجة 2: Databricks، Snowflake، BigQuery، Power BI
- الموجة 3: باقي الأنواع حسب الطلب

### 3.1 SAP S/4HANA Connector

مصدر رئيسي للـ master data (Business Partner / Customer / Vendor / Material)، ويدعم ثلاثة أنماط اتصال:

| النمط | الاستخدام | ملاحظات |
|---|---|---|
| **OData (SAP API Business Hub / Gateway)** | الافتراضي لقراءة الـ master data | مثل `API_BUSINESS_PARTNER`، يدعم paging و`$filter` و`$expand`، وسهل في الـ incremental عبر `LastChangeDate` |
| **SQL على HANA (عبر `hdbcli`)** | الـ metadata الكاملة وسحب الأحجام الكبيرة | قراءة من الـ views (CDS views) أو الجداول، ويتطلب user قراءة فقط وفتح الـ port من الشبكة |
| **RFC/BAPI (عبر `pyrfc`)** | اختياري لو OData مش مفعّل | يحتاج SAP NW RFC SDK، مش بيتضمن في الـ image افتراضياً بسبب ترخيصه |

**ما يستخرجه:**
- **Metadata:** الـ OData services والـ entity sets والـ properties كأنها tables/columns (أو الـ tables وCDS views لو SQL)، مع الـ keys والأنواع والـ descriptions.
- **MDM source records:** Business Partner (general data، roles، addresses، emails، phones، tax numbers) تتحول إلى `source_record` بالصيغة الموحدة.
- **Incremental sync:** على `LastChangeDate` أو `ChangedOn`، مع full reconciliation دورية للكشف عن الحذف.
- **Lineage:** من CDS view إلى الجداول الأساسية حيث تتوفر.

**Connection config (مثال):**

```yaml
serviceType: SapS4Hana
connection:
  mode: odata            # odata | hana_sql | rfc
  baseUrl: https://s4.example.com/sap/opu/odata/sap
  auth:
    type: basic          # basic | oauth2_client_credentials | x509
    username: ${S4_USER}
    password: ${S4_PASSWORD}
  client: "100"
  services: [API_BUSINESS_PARTNER, API_CUSTOMER]
  pageSize: 1000
```

> كلمات السر تقرأ من الـ secrets (env/Vault) ولا تخزن في قاعدة البيانات كنص صريح.

### 3.2 Generic REST Connector

للأنظمة اللي ما لها connector جاهز، ويتعرف بـ **config فقط من غير كود**:

```yaml
serviceType: GenericRest
connection:
  baseUrl: https://api.example.com
  auth: { type: bearer, token: ${API_TOKEN} }   # none | basic | bearer | api_key | oauth2_client_credentials
  headers: { Accept: application/json }
  rateLimit: { requestsPerSecond: 5 }
  retry: { max: 5, backoff: exponential }
entities:
  - name: customers
    request: { method: GET, path: /v1/customers }
    pagination: { type: cursor, cursorParam: after, nextPath: "$.meta.next" }   # offset | page | cursor | link_header
    recordsPath: "$.data[*]"
    primaryKey: id
    incremental: { param: updated_since, field: "$.updated_at" }
    mapping:                         # تحويل إلى الـ schema الموحد
      source_id: "$.id"
      name: "$.full_name"
      phone: "$.contact.phone"
      email: "$.contact.email"
```

**القدرات:** JSONPath للمسارات، أنواع الـ pagination الأربعة، incremental sync، rate limiting وretry، ومعاينة (`test_connection` و`preview`) من الـ UI قبل الحفظ. الـ schema يتم استنتاجه من عينة الاستجابة ثم يعدّله الـ user.

### 3.3 Custom Connectors (Plugin SDK)

لما REST العام لا يكفي (بروتوكول خاص، SOAP، ملفات معقدة...):

- الـ connector عبارة عن Python package يحمل `entry_point` باسم `mdm.connectors`، ويُثبّت في الـ image أو يُحمّل من volume اسمه `/plugins`.
- يرث من `BaseSource` وينفذ: `test_connection()`, `get_services()`, `iterate_entities()`, واختيارياً `sample_data()` و`lineage()`.
- يرفق الـ `connection.schema.json` فيتولد فورم الإعداد في الـ UI تلقائياً.
- يوجد `mdm-connector-template` (cookiecutter) و`mdm connector test` للاختبار المحلي قبل التركيب.
- الـ plugins تعمل في الـ worker فقط ولا تُحمّل داخل الـ API process، وتخضع لـ resource limits وtimeout.
- الـ C4C connector الحالي يكون أول مثال حي على هذا الـ SDK.

### 3.4 العلاقة مع OpenMetadata (تكامل لا استبدال)

**تقسيم المسؤوليات:**

| OpenMetadata (حوكمة) | هذه الأداة (Master Data) |
|---|---|
| Catalog شامل للـ data platform كله | Catalog مركّز على مصادر الـ master والـ dims المنشورة |
| Glossary، Domains، Tiers، Tags/PII | تستهلكها لتصنيف الـ attributes وقواعد الـ survivorship |
| Lineage على مستوى المنصة | تنتج lineage للـ master (مصادر ← golden ← dim) وتدفعه إلى OpenMetadata |
| Data Quality عام على الجداول | DQ خاص بالـ master: duplicates، completeness، match quality (Splink) |
| سياسات الـ governance والـ ownership | تحترم الـ owners والـ domains القادمة منه |
| لا يحتوي matching ولا golden records ولا write-back | المحرك الأساسي لها |

**اتجاهات التكامل (عبر REST API الخاص بـ OpenMetadata):**
- **من OpenMetadata إلينا (قراءة):** domains، glossary terms، tags/classifications، owners، وقائمة الـ services، فلا نكرر تعريفها.
- **منا إلى OpenMetadata (نشر):** الـ dims المنشورة (`mdm_dim.*`) كـ tables مع وصف وأعمدة وowners، وlineage بين المصادر والـ golden والـ dims، ونتائج اختبارات الـ DQ كـ test results، وglossary term لكل entity type (Customer…).
- يُدار بـ connector داخلي اسمه `openmetadata-sync` وجدول `om_sync_state`، يعمل في الـ worker بـ bot token مخصص بأقل صلاحيات.
- التوثيق والتجربة على نسختكم الفعلية من OpenMetadata قبل تثبيت الـ schema المتبادلة، لأن الـ API تتغير بين الإصدارات.

**ما يبقى مستقلاً:** المستخدمون يدخلون بنفس الـ SSO/IdP، أما الـ Roles & Policies وPreferences وAccess Tokens في هذه الأداة (قسم 5.4) فخاصة بها وتغطي موارد الـ MDM (golden, tickets, write-back…) ولا تتعارض مع سياسات OpenMetadata.

**ما يتغير عن النسخة السابقة من الوثيقة:** لا حاجة لـ importer من OpenMetadata، ولا لمطابقة تغطية كل الـ connectors بنفسها. نحتاج فقط connectors لمصادر الـ master (C4C، S/4HANA، قواعد البيانات، REST)، بينما يبقى باقي الـ ingestion في OpenMetadata.

### 3.5 الـ Ingestion مبني على Kafka

**القرار:** كل بيانات المصادر تمر عبر Kafka قبل أن تصل لقاعدة البيانات. الـ connectors تتحول من "تسحب وتكتب في الـ DB مباشرة" إلى "تنتج events إلى Kafka"، وباقي المنصة (الـ mirror، الـ matching، النشر، الـ write-back) تستهلك منه.

**الفائدة الفعلية:**
- **فصل الإنتاج عن الاستهلاك:** بطء الـ DB أو الـ matching لا يوقف السحب من المصدر، والعكس.
- **Replay:** تغيير قواعد التطبيع أو الـ blocking أو الـ survivorship يعني إعادة معالجة الـ events من الـ offset المطلوب بدل إعادة السحب من SAP.
- **CDC لحظي** لقواعد البيانات (عبر Debezium) بدل الـ polling الدوري.
- **عدة مستهلكين لنفس الـ stream:** الـ mirror، والـ matching، وOpenMetadata sync، والـ Data Insights، دون تحميل إضافي على المصدر.
- يفتح الباب لـ **near-real-time matching** (كان خارج النطاق) خصوصاً لفحص التكرار في الـ Tickets.

**الـ Topics:**

| Topic | المحتوى | الإعدادات |
|---|---|---|
| `mdm.raw.<system>.<entity>` | السجل الخام كما جاء من المصدر (insert/update/delete) | key = `source_id`، `cleanup.policy=compact,delete` (آخر حالة لكل سجل + retention) |
| `mdm.source.normalized` | السجل بعد التطبيع (اسم/تليفون/عنوان) | key = `source_system:source_id` |
| `mdm.match.requests` | طلبات المطابقة (دفعة، أو سجل واحد من Ticket) | |
| `mdm.golden.changes` | تغييرات الـ golden (created/updated/merged/unmerged) | يغذي نشر الـ dims والـ write-back |
| `mdm.writeback.commands` | أوامر الكتابة للأنظمة المصدرية بعد الموافقة | |
| `mdm.dlq` | الأحداث الفاشلة مع سبب الفشل | يظهر كـ Tasks للمراجعة |

**المستهلكون (consumer groups):**
1. `ingest-writer`: يكتب في `source_record` بـ upsert، ويتجاهل الحدث لو `record_hash` لم يتغير.
2. `normalizer`: raw ← normalized.
3. `matcher`: يجمع طلبات المطابقة في دفعات صغيرة ويشغّل Splink (DuckDB، أو Spark للدفعات الكبيرة).
4. `dim-publisher` و`writeback-worker` و`om-sync`: من `mdm.golden.changes` و`mdm.writeback.commands`.

**ضمانات التسليم (بصدق):** Kafka يعطي **at-least-once** في هذا التصميم، ولا ندّعي exactly-once. التحمّل للتكرار يأتي من أن كل المستهلكين **idempotent**: upsert بالمفتاح و`record_hash`، و`idempotency_key` في الـ write-back. ترتيب الأحداث مضمون لكل سجل فقط (نفس الـ key ينتهي في نفس الـ partition)، وليس عبر السجلات.

**الـ Connectors مع Kafka:**

| المصدر | الطريقة |
|---|---|
| PostgreSQL / MySQL / SQL Server / Oracle | **Debezium** على Kafka Connect (CDC) عند توفر صلاحية الـ log، وإلا JDBC polling |
| SAP C4C / S/4HANA (OData) | الـ connector الخاص بنا (3.1) يعمل **poller** بجدولة، ويقرأ delta بـ `LastChangeDate` وينتج الـ events إلى Kafka |
| Generic REST (3.2) | poller، أو **webhook gateway** صغير يستقبل الـ POST وينتج إلى Kafka |
| CSV / Excel | الرفع من الـ UI ينتج صفوف الملف كـ events (مع `batch_id`) |
| Databricks / Delta | قراءة batch بـ Spark ثم الإنتاج إلى Kafka، أو القراءة المباشرة للـ matching الثقيل |

الـ **Connector SPI** يتغير فقط في طرف الـ sink: `ingest()` ينتج `RawEvent` بدل الكتابة المباشرة، ويظل `test_connection()` وباقي الـ SPI كما هو.

**شكل الـ event (Envelope):** `{event_id, source_system, entity, source_id, op: c|u|d, ts_source, ts_ingested, batch_id, payload, schema_version}`. نوصي بـ **Schema Registry** (JSON Schema أو Avro) ليتحقق الـ producers والـ consumers من توافق الـ schema. أي تغيير في الـ schema يمر بقواعد التوافق (backward compatible) وإلا يُرفض.

**الأعطال والـ DLQ:** حدث فشل بعد عدد محاولات محدد ينتقل إلى `mdm.dlq` مع الخطأ، ولا يوقف باقي الـ partition، ويُفتح Task للـ steward. ومراقبة الـ **consumer lag** تظهر في Health Check وData Insights.

**الـ Docker:** خدمة `kafka` بنمط **KRaft** (بدون ZooKeeper) مع `schema-registry` و`kafka-ui` اختياريين، وخدمة `kafka-connect` (Debezium) ضمن profile اسمه `cdc`. بدائل خفيفة متوافقة مع Kafka API مثل **Redpanda** ممكنة للتطوير. وللإنتاج: إما Kafka مُدار عندكم، أو خدمة مُدارة حسب الـ cloud المستخدم، وهذا قرار يحتاج مدخل فريق الـ infrastructure.

**الأثر على باقي التصميم:**
- **Spark:** يقرأ من Kafka (batch أو Structured Streaming) بدل قراءة الـ DB، لكن يظل للمعالجة الثقيلة فقط (6.1).
- **Arq/Redis:** تبقى لجدولة الـ pollers والمهام الخلفية الصغيرة، ولا تحمل بيانات الـ ingestion.
- **جدول `source_record`:** يظل مرآة الحالة الأخيرة، ويُملأ بواسطة `ingest-writer`، ويحمل `last_offset` و`last_event_id` للتتبع.
- **جدول جديد `ingest_batch`:** (batch_id، source، mode، started/finished، events_produced، events_failed، status).

**متى يكون Kafka زائداً عن الحاجة؟** لحجم ~950K سجل وسحب ليلي دوري، يكفي الـ batch المباشر، وKafka يضيف تعقيد تشغيل (broker، تخزين، مراقبة، فريق يتقنه). يستحق التكلفة لو: (أ) تريد CDC لحظي، أو (ب) عدة أنظمة تستهلك نفس البيانات، أو (ج) تحتاج replay بعد تعديل قواعد المطابقة، أو (د) الوصول لـ near-real-time matching. إذا كان الهدف غير ذلك، فالبديل الأبسط هو الـ batch ingestion بـ Arq مع نفس الـ envelope، ويمكن إضافة Kafka لاحقاً دون تغيير الـ consumers لأن الـ envelope واحد.

---

## 4. نموذج البيانات

**Catalog (مرآة المصادر):** `service`, `database`, `schema`, `table`, `column`, `domain`, `glossary_term`, `tag`, `lineage_edge`, `owner`، و`sync_run` (service/table، mode، started/finished، rows added/updated/deleted، status، error)، و`schema_drift_event` (table، change_type، before/after، detected_at، task_id)

**MDM:**
- `source_record` — سجل عميل خام (system, source_id, payload JSONB, normalized fields, ingested_at, hash)
- `match_pair` — (record_a, record_b, match_probability, match_weight, model_version, comparison_vector)
- `cluster` — مجموعة سجلات تمثل كياناً واحداً
- `golden_record` — (cluster_id, durable `customer_id`, attributes, per-attribute provenance, version, status)
- `dim_spec` — (entity_type, attribute, scd_type 1|2, dim_column) تعريف أعمدة الـ dimension المنشورة
- `publish_run` — (entity_type, sink, mode full|incremental, watermark, rows_added/closed, checksum, status, started/finished)
- `writeback_policy` — (connector, entity_type, field_map, mode: create|update|enrich|notify_only, requires_approval, dry_run_default)
- `writeback_job` — (golden_id, target_system, target_id, operation, payload, idempotency_key, status, attempts, error, approved_by, executed_at)
- `om_sync_state` — (om_entity_fqn, local_ref, direction in|out, last_synced, hash)
- `survivorship_rule` — (attribute, strategy, source_priority, params)
- `merge_event` — سجل تدقيق لكل merge/unmerge/override يدوي

**Workflow / DQ:**
- `task` — (type, subject_ref, assignee, status, priority, due, resolution)
- `ticket` — (type, form_data JSONB, requester, status, duplicate_candidates, approval_stage, sla_due, resulting_golden_id)
- `ticket_comment`, `ticket_attachment`, `approval_step`
- `saved_query` — (name, sql, service_ref, owner, visibility)
- `query_run` — (query text, user, service, duration, row_count, status) للـ audit
- `dq_test_definition`, `dq_test_case` (يشمل `custom_sql` مع rule_type وthreshold)، `dq_test_result`

**Access / Settings:**
- `user`, `team` (هرمية: Organization ← Business Unit ← Division ← Department ← Group؛ الـ Groups فقط تملك assets)، `team_membership`
- `role`, `policy`, `rule` (name, description, resources[], operations[], condition, effect)، `role_policy`, `team_policy`, `user_role`, `team_role` (مع `end_date` اختياري للوصول المؤقت)
- `bot` (مرتبط بـ role)، `access_token` (token_type: `BOT` | `PERSONAL_ACCESS`، hash فقط، expires_at، owner)
- `setting` — (key, value JSONB, updated_by) لكل إعدادات Preferences

**Data Insights:**
- `insight_metric_snapshot` (يومي: totals, description/owner/tier coverage per entity type/service/team/tier)
- `kpi` — (display_name, chart, metric_type: percentage|number, start_date, end_date, description)
- `usage_event` — (user, entity, event_type, ts) لـ App Analytics
- `audit_log` — كل تغيير بمن ومتى

---

## 5. تفاصيل الـ Tabs

### Catalog
التاب **مرآة للبيانات القادمة من الـ sources**، ليس نسخة من كتالوج OpenMetadata:
- **مرآة الـ metadata:** لكل service (C4C, S/4HANA, قواعد بيانات, REST…) تُسحب الـ databases والـ schemas والـ tables والـ columns وأنواعها ومفاتيحها.
- **مرآة البيانات:** الجداول المسجَّلة كمصادر master تُسحب سجلاتها إلى `source_record` (payload خام + حقول مطبّعة + hash)، فتكون هي الأساس للـ matching والـ golden، ولا يُستعلم المصدر الحي في كل مرة.
- **حالة المزامنة لكل مصدر:** آخر مزامنة، النمط (full/incremental)، عدد السجلات المضافة/المعدلة/المحذوفة، الأخطاء، والـ freshness.
- **اكتشاف الـ drift:** تغيّر الـ schema في المصدر (عمود جديد/محذوف/تغير نوع) يظهر كتنبيه ويفتح Task قبل أن يكسر الـ mapping.
- **التصفح والبحث:** بحث وتصفح هرمي وصفحة asset (schema، sample data، profiler، owners، tags، glossary)، وربط الجدول بالـ golden records عندما يكون مصدر عملاء.
- الـ lineage هنا يخص الـ master فقط (مصدر ← golden ← dim)، والشامل في OpenMetadata.
- **الحدود:** تُنسخ بيانات الجداول المسجّلة كمصادر master فقط، لا كل جداول النظام المصدري، حفاظاً على الحجم والخصوصية.

### Tasks
- أنواع: `match_review`, `dq_failure`, `missing_attribute`, `approval`.
- كل task فيه سياق كامل (الـ pair مع comparison vector الذي يوضح سبب التشابه)، وأزرار Merge / Not a match / Escalate.
- إنشاء تلقائي من الـ matching والـ DQ، وإسناد حسب الـ domain/owner.

### Customer 360
Search ثم صفحة عميل: golden attributes (مع مصدر كل قيمة)، السجلات المصدرية المرتبطة، الـ DQ score، الـ tasks المفتوحة، timeline للتغييرات.

### Golden Records
قائمة الـ clusters، مقارنة side-by-side، تعديل survivorship يدوياً (override مع سبب)، Merge/Unmerge، تاريخ الإصدارات.

### Data Quality
- **اختبارات عامة:** nulls, uniqueness, regex, ranges, freshness، بصيغة test definitions قابلة للتوسع.
- **اختبارات مبنية على Splink:** نسبة الـ duplicates المحتملة، حجم الـ clusters غير الطبيعي، تغير توزيع match weights بين التشغيلات.
- Score لكل asset وكل مصدر، بأوزان قابلة للإعداد.
- **Custom rules:** تنشأ من الـ SQL Editor (5.1) وتظهر هنا كأي اختبار آخر.

### 5.1 SQL Editor

**الاستخدام:** استكشاف البيانات، وكتابة قواعد جودة مخصصة تتحول إلى اختبارات مجدولة.

**الواجهة:**
- محرر Monaco بـ syntax highlighting وauto-complete من الـ Catalog (أسماء الجداول والأعمدة).
- اختيار الـ service/connection المستهدف، ومتصفح schema جانبي.
- نتائج في جدول مع تصدير CSV، وسجل استعلامات (history) وقائمة saved queries مع مشاركة.
- زر **Save as DQ Rule** يفتح فورم القاعدة.

**أنواع الـ Custom DQ Rule:**

| النوع | شرط النجاح |
|---|---|
| **Failing rows** | الاستعلام يرجّع الصفوف المخالفة، والنجاح لو العدد = 0 (أو أقل من threshold) |
| **Scalar metric** | الاستعلام يرجّع رقماً يُقارن بـ min/max أو نسبة |
| **Reconciliation** | مقارنة رقمين من مصدرين مختلفين بفارق مسموح |

**إعدادات القاعدة:** الاسم والوصف، الـ asset المرتبط، الـ severity، الـ owner، الجدولة، الـ threshold، وخيار "افتح Task تلقائياً عند الفشل" مع عينة الصفوف الفاشلة.

**ضوابط الأمان (إلزامية، لأن الـ editor يفتح باب تنفيذ SQL):**
1. **اتصال read-only فقط:** يستخدم DB user بصلاحية SELECT، ولا يعتمد على فحص النص وحده.
2. **تحليل بالـ parser** (مثل `sqlglot`): يُقبل SELECT/CTE فقط، ويُرفض DDL/DML وتعدد statements والدوال الخطرة.
3. **Timeout وحد أقصى للصفوف والذاكرة** لكل استعلام، وطابور تنفيذ منفصل عن الـ API.
4. **RBAC على مستوى الـ service/schema:** المستخدم لا يرى أو يستعلم إلا ما يملك صلاحيته.
5. **PII masking** افتراضياً للأعمدة الموسومة حساسة، حسب صلاحية المستخدم.
6. **Audit كامل:** كل استعلام بنصه ومن شغّله ومتى وعدد الصفوف.
7. **تشغيل القواعد المجدولة في الـ worker** بحساب خدمة مخصص، لا بحساب المستخدم.
8. **MDM schema:** نعرض الجداول الداخلية (golden/clusters) كـ read-only views فقط.

### 5.2 Tickets (طلبات الإنشاء)

الـ **Tickets** طلبات يقدّمها المستخدمون (مثل طلب إنشاء عميل جديد)، بينما الـ **Tasks** شغل يولّده النظام للـ stewards.

**أنواع الطلبات:** `new_customer` أولاً، وقابلة للتوسع (`new_vendor`, `new_product`, `update_request`...) عبر **form schema** لكل نوع تُعرَّف بـ config.

**دورة الحياة:**

```
Draft → Submitted → Auto-checks → Pending Approval → Approved → Created
                        │               │
                        ▼               ▼
                 Needs Info / Blocked   Rejected
```

**الفحوصات التلقائية عند الإرسال:**
1. **Standardization** للاسم والتليفون والعنوان (نفس خط الـ matching).
2. **Duplicate check** بـ Splink: تقييم السجل الجديد مقابل الـ golden records والسجلات المصدرية (inference لسجل واحد)، وعرض أقرب المرشحين مع الأسباب.
3. **قواعد DQ** المعرّفة على هذا النوع (حقول إلزامية، رقم ضريبي صالح، إلخ).
4. **النتيجة:**
   - تطابق عالٍ ← يُحجز الطلب (Blocked) مع اقتراح استخدام العميل الموجود.
   - تطابق متوسط ← يُسمح بالمتابعة مع تحذير وإظهار المرشحين للـ approver.
   - لا تطابق ← يمر لمرحلة الموافقة.

**Ticket Templates (Create template):** الـ steward أو الـ admin ينشئ template لكل نوع طلب من خلال زر **Create template** في تاب Tickets:
- يختار **الـ Domain** (Customer, Vendor, Product… أو domain جديد) الذي يتبعه الـ template.
- يعرّف الحقول، ولكل حقل: label، وkey (حروف لاتينية صغيرة وأرقام و`_`)، ونوع (`text, textarea, number, email, phone, date, select, boolean`)، وخيارات لو النوع `select`، وعلامة **Mandatory** (إلزامي) أو Optional (اختياري).
- قواعد: حقل إلزامي واحد على الأقل، وkeys غير مكررة، وكل `select` له خيارات.
- عند تقديم الطلب يتحقق الـ API من الحقول الإلزامية ومن نوع كل قيمة ويرفض أي حقل غير معرّف، وترجع الأخطاء لكل حقل على حدة.
- الـ ticket يحفظ **snapshot** من الـ template وقت التقديم، فتعديل الـ template لاحقاً لا يغيّر الطلبات القديمة.
- الـ template يمكن تعطيله (`is_active=false`) فيختفي من القوائم ولا يقبل طلبات جديدة.
- المستخدم العادي يرى الـ templates الفعّالة ويقدّم طلباته ويشاهد طلباته فقط، أما الـ admin والـ steward فيديران الـ templates ويشاهدون كل الطلبات.
- الجداول: `domain`, `ticket_template` (domain_id، request_type، fields JSON، is_active)، و`ticket` (template_id، template_snapshot، data، status).
- الـ Endpoints: `GET/POST /api/v1/domains`، و`GET/POST /api/v1/ticket-templates`، و`GET/PUT /api/v1/ticket-templates/{id}`، و`GET/POST /api/v1/tickets`.

**الموافقات:** workflow قابل للإعداد (approver واحد أو مرحلتان حسب نوع الطلب/الـ domain)، مع SLA وتذكيرات وتصعيد.

**عند الموافقة (Created):** ينشأ `source_record` وgolden record في المنصة. أما الإنشاء الفعلي في SAP C4C أو S/4HANA فخطوة اختيارية عبر write-back (قرار مفتوح، قسم 12).

**المميزات:** تعليقات ومرفقات، سجل تاريخ كامل، إشعارات (إيميل/Webhook)، فلاتر "طلباتي / بانتظار موافقتي"، وربط الـ ticket بالـ golden record الناتج.

### 5.3 Data Insights (مطابق لـ OpenMetadata v2.0.x)

**الهدف:** قياس استخدام المنصة وصحة الـ metadata، وتحديد KPIs وأهداف لتبنّي المنصة (توثيق، ownership، tiering). المصدر: [Data Insights](https://docs.open-metadata.org/v2.0.x/how-to-guides/data-insights).

**الـ Dashboard** — 4 أقسام، وأغلب الرسوم تقبل فلاتر **Teams** و**Data Tiers** و**Time Filter**، ومعها بحث لكل chart على مستوى الـ service:

| القسم | الرسوم / المقاييس |
|---|---|
| **Data Assets** | Total Data Assets (حسب النوع)؛ % Data Assets with Description (الجدول يُحتسب لما يكون هو وأعمدته موصوفة)؛ % Data Assets with Owners (تُستبعد الأنواع التي لا تقبل owner)؛ % Service with Description؛ % Service with Owners؛ Total Data Assets by Tier (الـ assets بلا tier مستبعدة) |
| **App Analytics** | Most Viewed Data Assets (أعلى 10)؛ Page Views by Data Assets؛ Daily Active Users؛ Most Active Users |
| **KPIs** | تتبع نسبة الـ assets الموصوفة والمملوكة مقابل الأهداف |
| **Cost Analysis** | Used vs Unused (عدد، حجم بالـ TB، نسب عبر الزمن)، Unused Assets، Frequently Used Assets. **في OpenMetadata متاح للـ SaaS فقط**، فهو اختياري ومؤجل عندنا |

**KPIs:**
- الحقول: **Chart** (من الرسوم المتاحة)، **Display Name**، **Metric Type** (Percentage للتغطية النسبية أو Number للتغطية المطلقة)، **Start / End Date**، **Description**.
- الفئات: **Completed Description** و**Completed Ownership**. تُحتسب الـ data assets فقط (tables, dashboards, pipelines…)، وتُستثنى glossary terms وtags وdata products.
- الخطوات: Insights ← **Add KPI** ← تعبئة الحقول ← **Submit**. بعدها يظهر line graph للتقدم اليومي والأيام المتبقية والتغطية المحققة.
- لا يظهر تقدم إلا بعد تشغيل Data Insights مرة على الأقل (يعمل يومياً افتراضياً).

**Service Insights** (تاب داخل كل service): ست رسوم — Total Data Assets، Description Coverage، PII Coverage، Tier Coverage، Ownership Coverage، Data Quality — وجداول: PII Distribution، Tier Distribution، Most Used Data Assets (أعلى 5 بالـ usage percentile)، Most Expensive Queries (لو الـ connector يدعم query cost). جدول "Generated Data with AI" وAuto Tiering خاصان بـ OpenMetadata ولا يدخلان في النسخة الأولى.

**التقرير الدوري (Data Insights Report):** تطبيق يُثبَّت من **Settings ← Applications ← Add Apps**، يُرسل بالإيميل إلى **Admins** و/أو **Teams** بجدول زمني يُختار، ويُظهر الأداء مقابل KPIs ونشاط المستخدمين. ويحتوي زر **Configure** لتغيير الجدول والمستلمين وعرض **History** لآخر إرسال. يتطلب إعداد SMTP (5.4).

**الاعتماد على الـ ingestion:** يحتاج الـ Data Insights pipeline ليعمل يومياً، وبعض الرسوم تحتاج pipelines إضافية (metadata, usage, auto-classification, data quality). والرسم الفارغ يعني أن أحد هذه الـ pipelines لم يعمل بنجاح.

**مقاييس خاصة بالـ MDM (إضافة منا فوق OpenMetadata):** عدد golden records، نسبة duplicates المحتملة، زمن حسم الـ match tasks، عدد/زمن الـ tickets، ونسبة الـ DQ pass لكل مصدر.

### 5.4 Settings (مطابق لـ OpenMetadata v2.0.x)

يصل إليها الـ Admin فقط ما عدا **Access Tokens** الشخصية. تنقسم إلى:

#### 5.4.1 Access Tokens (Users & Bots)

| النوع | الإنشاء | الصلاحيات | الانتهاء |
|---|---|---|---|
| **Personal Access Token (PAT)** | أيقونة البروفايل ← **Access Tokens** ← **Generate New Token** ← تحديد تاريخ الانتهاء | ترث صلاحيات المستخدم | يحدده المستخدم عند الإنشاء |
| **Bot (JWT) Token** | **Settings ← Bots** ← اختيار/إضافة bot ← **Generate Token** (الـ Admin فقط) | صلاحيات الـ role المرتبط بالـ bot | بلا انتهاء افتراضياً (`exp` = null) ويُنصح بتدويره دورياً |

- الـ JWT يحمل claim `tokenType` بقيمة `BOT` أو `PERSONAL_ACCESS`، وclaim `isBot`.
- التوكن **لا يمكن استرجاعه بعد الإنشاء** (يُعرض مرة واحدة). عندنا يُخزَّن hash فقط.
- المستخدمون البشر يسجلون عبر SSO ويصدر لهم JWT للجلسة، أما الـ bots (مثل الـ ingestion connectors وأداة الـ MCP) فتستخدم JWT جاهزاً يتحقق منه الخادم.
- أفضل الممارسات: bot مخصص لكل integration، وأقل role ممكن، وانتهاء للـ PAT وتدوير للـ bot tokens، وحفظ التوكن في env/secret manager، ومراجعة الـ audit logs.
- ملاحظة: مصدر OpenMetadata لا يشرح خطوات الـ revocation. عندنا نضيف **Revoke** صريحاً لكل توكن (قرار تصميمي مستقل).

#### 5.4.2 Roles & Policies

نفس نموذج OpenMetadata: **RBAC + ABAC هجين**، والقرار يعتمد على ثلاثة عوامل: **من** (مستخدم/bot)، و**أي resource**، و**أي operation**.

**الهرم:** Rule ← Policy (مجموعة rules) ← Role (حزمة policies لوظيفة معينة).

**الـ Rule:**

| الحقل | الوصف |
|---|---|
| Name | معرّف فريد |
| Description | الغرض |
| Resources | نوع محدد (مثل Table) أو All |
| Operations | عملية محددة (مثل EditOwners) أو All |
| Condition | تعبير SpEL يُقيَّم true/false، ويُركَّب بـ `&&` و`\|\|` |
| Effect | **Allow** أو **Deny** |

**الـ Conditions المدعومة:**

| Condition | تتحقق عندما |
|---|---|
| `noOwner()` | الأصل بلا owner |
| `isOwner()` | المستخدم هو الـ owner |
| `matchAllTags(tagFqn, ...)` | الأصل يحمل كل الـ tags المذكورة |
| `matchAnyTag(tagFqn, ...)` | الأصل يحمل tag واحداً على الأقل |
| `matchTeam()` | فريق المستخدم هو مالك الأصل |
| `hasDomain()` | domain المستخدم يطابق domain الأصل |
| `matchAnyDomain('Finance')` | الأصل ضمن الـ domain المذكور (ورد في use case لتحديد role بـ domain) |

**الـ Operations (مع الخطورة):**

| Operation | الخطورة | حامل نموذجي |
|---|---|---|
| ViewBasic | Low | كل الـ roles |
| ViewAll | Low–Medium | Analysts فما فوق |
| ViewUsage | Medium | Analysts, Data Engineers |
| ViewSampleData | High | Senior analysts, Admins |
| ViewTests | Low | Analysts فما فوق |
| ViewQueries | Medium | Data Engineers, Admins |
| ViewDataProfile | Medium | Analysts فما فوق |
| ViewTestCaseFailedRowsSample | High | Data Engineers, Admins |
| Create / BulkCreate | Medium | Data Engineers, Admins |
| Delete | Critical | Admins |
| EditAll | High | Data Engineers, Admins (يتجاوز كل صلاحيات التعديل الأخرى) |
| EditDescription / EditDisplayName | Low | Data Stewards فما فوق |
| EditTags / EditGlossaryTerms | Medium–High | Data Stewards, Admins |
| EditLineage / EditEntityRelationship | Medium | Data Engineers |
| EditOwners / EditTeams / EditUsers | High | Admins |
| EditPolicy / EditRole | Critical | Admins |
| CreateTests / EditTests | Medium | Data Engineers |
| Deploy / Trigger | High | Data Engineers, Admins |
| Kill | High | Data Engineers مع EditAll, Admins |
| GenerateToken / Impersonate | Critical | Admins |
| AuditLogs | High | Admins, Compliance Officers |
| CreateScim / EditScim / DeleteScim / ViewScim | Critical | Admins |

**ViewBasic مقابل ViewAll:** ViewBasic = الوصف والـ tags والـ owner والـ metadata الأساسية فقط. ViewAll يضيف profile data وsample data وdata profile وtests وqueries. وتتدرج الصلاحيات: ViewBasic ← ViewAll ← ViewDataProfile ← ViewUsage ← ViewQueries ← ViewSampleData ← ViewTestCaseFailedRowsSample.

**Resource categories (مع الخطورة):** AI/Agent (High)، APIs & apps (Medium)، Analytics & dashboards (Medium)، Data assets (High)، Data platform services (Critical)، Data governance (Medium–High)، Files & documents (Low–Medium)، Ingestion & pipelines (High)، ML & LLM (High)، Workflow & automation (High)، Data quality & testing (Medium–High)، Collaboration (Low)، User & access control (Critical)، Reporting & monitoring (Medium–High)، Misc (Medium–High). نضيف عندنا resources خاصة بالـ MDM: `GoldenRecord`, `Cluster`, `MatchPair`, `Ticket`, `Task`, `SavedQuery`, `Connector`, `McpServer`.

**قواعد التقييم:**
- عند تعارض rules داخل policy واحدة: **Deny يغلب**.
- الـ Policies تُربط بالـ **Teams** (لا بالأفراد)، ويرث الأعضاء كل policies فريقهم، وتنحدر عبر الهرم: policy على الـ Organization تنطبق على الجميع، وعلى Division تنطبق على أقسامها وفرقها.
- التصميم الموصى به: rules متساهلة في الأعلى، وأدق وأشد في الأسفل.
- الـ Roles تُسند لأفراد أو فرق.
- **Trigger** (منذ 1.12.9 في OpenMetadata): تشغيل ingestion pipeline عبر الـ API يتطلب منح Trigger صراحة، ولا يغطيه EditAll.

**الـ Defaults:**
- **Organization Policy** وقواعدها: `OrganizationPolicy-NoOwner-Rule` (يسمح لأي مستخدم بتعيين owner لأصل بلا owner)، و`OrganizationPolicy-Owner-Rule` (owner الأصل أو أي عضو في الفريق المالك له view وedit كاملان)، و`OrganizationPolicy-ViewAll-Rule`.
- Role **Data Consumer** مع Data Consumer Policy.
- Role **Data Steward**.
- Bot policies: Ingestion, Lineage, Profiler, Quality, Usage.

> ملاحظة أمانة: مصدر OpenMetadata لا يعرض قائمة كاملة بكل الـ roles الجاهزة، وما ورد أعلاه هو ما ذُكر صراحة. نتحقق من الباقي مقابل نسخة OpenMetadata الفعلية عندكم قبل تثبيت الـ seed.

**Starting roles المقترحة (من الدليل):**

| الوظيفة | Role الأساسي | إضافات شائعة |
|---|---|---|
| تصفح الكتالوج | Read-Only Viewer | ViewDataProfile |
| تحليل وتقارير وSQL | Data Analyst | ViewSampleData لو معتمد رسمياً |
| تعريف المصطلحات وفرض الجودة | Data Steward | EditCertification |
| بناء pipelines وingest | Data Engineer | EditAll على الـ services التي يملكها |
| بناء AI agents | AI / ML Engineer | EditAll على AI Governance Policy |
| الامتثال وتصنيف PII | Compliance Officer | AuditLogs |
| إدارة المنصة | Platform Administrator | تقليل Impersonate وGenerateToken |

**Use cases جاهزة تُشحن كـ templates:** (1) ServiceOwner (2) Data Steward (3) تقييد الأصول بالفريق المالك بـ `isOwner()`/`matchTeam()` (4) حماية الـ `PII.Sensitive` (5) Read-Only Viewer (6) Data Analyst (7) Data Engineer (8) role محدد بـ domain (9) Break-Glass مؤقت مع `end_date` ومراجعة Audit Logs (10) عرض كل فريق لأصوله فقط (RBAC Search + حذف `OrganizationPolicy-ViewAll-Rule`). ملاحظة: `matchTeam()` يُتجاهل في RBAC Search فيُستخدم `isOwner()` للتحكم بنتائج Explore.

**Separation of duties (أمثلة):** نشر الـ pipelines (Data engineer ثم Pipeline approver)، وتصنيف PII (Steward ثم Compliance)، وإنشاء المستخدمين (SCIM ثم Admin)، ونشر الـ glossary (Analyst ثم Steward). والأخطاء الشائعة: منح EditAll بدل EditDescription، ومنح ViewSampleData للجميع، واستخدام Delete خارج الـ Admin، ومنح EditPolicy بلا مراجعة تدقيق، وrole عالمي واحد للجميع، ونسيان الـ bots وMCP.

**RBAC Search:** يُفعَّل من **Settings ← Preferences ← Search**، ويصفّي نتائج البحث حسب صلاحيات المستخدم. تأكد من اكتمال الصلاحيات قبل تفعيله.

**واجهة الإدارة:** Settings ← Policies / Roles / Teams / Users، وكل تعديل يدخل الـ `audit_log`. ويطبّق نفس المحرك على الـ API والـ MCP والـ SQL Editor.

#### 5.4.3 Preferences

المسار: **Settings ← Preferences**، للـ Admin فقط، وتنطبق على كل المستخدمين عند تحميل الصفحة التالية. الترتيب مطابق للمنتج:

| الإعداد | الغرض | الحقول / الخيارات |
|---|---|---|
| **Theme** | هوية المنصة | **Custom Logo** (روابط URL لا رفع ملفات): Logo URL (صفحة الدخول، 5:2، 150×60)، Monogram URL (شريط التنقل، 1:1، 30×30)، Favicon URL (1:1، 16×16). **Custom Theme** بـ HEX أو color picker مع preview: Primary `#1570EF`، Selected `#175CD3`، Hover `#D1E9FF`، Info `#84CAFF`، Panel Background (غير مضبوط، ويمكن للمستخدم/persona تجاوزه)، Success `#039855`، Warning `#DC6803`، Error `#D92D20`. زر **Save** وزر **Reset** لاستعادة الافتراضي |
| **Email** | SMTP للدعوات والتنبيهات والتقارير | Username, Password, **Sender Email** (إلزامي)، **Server Endpoint** (إلزامي)، **Server Port** (إلزامي)، Emailing Entity (افتراضي `OpenMetadata`)، **Enable SMTP Server**، Support URL، **Transportation Strategy** (إلزامي). التوافق: 25 ↔ SMTP، 465 ↔ SMTPS، 587 ↔ SMTP_TLS. زر **Test Email** لإرسال رسالة تجريبية |
| **Login Configuration** | الحماية من brute-force ومدة الجلسة | Max Login Fail Attempts (افتراضي 3)، Access Block Time (افتراضي 30 ثانية)، JWT Token Expiry Time (افتراضي 3600 ثانية). تأخذ بضع دقائق لتسري |
| **Health Check** | تشخيص للقراءة فقط مع زر **Refresh** | Infrastructure: Database, Search Instance, Migrations. Search: Search Reindex Status, Semantic Search (إن فُعّل). External: Pipeline Service Client, JWKs, Log Storage (لو S3)، Object Storage |
| **Profiler Configuration** | افتراضيات الـ profiler | مقاييس لكل Data Type (صف واحد لكل نوع) مع **Add Field** وDisable toggle وزر حذف؛ **Enable Storing of Sample Data** (افتراضي On)؛ **Enable Reading of Sample Data** (افتراضي On)؛ مقاييس مثل histogram وcardinalityDistribution وsystem خارج الافتراضي |
| **Search** | ترتيب النتائج وأوزان الحقول لكل نوع asset، وخيار **RBAC Search** | مذكور في الدليل العام للـ Preferences، ولم أجد له صفحة تفصيلية في فهرس v2.0.x |
| **Lineage** | افتراضيات عرض الـ lineage | Upstream Depth (افتراضي 2، من 1 إلى 5)، Downstream Depth (افتراضي 2، من 1 إلى 5)، Lineage Layer (**Entity Lineage** افتراضي / Column Level Lineage / Data Observability)، Pipeline View Mode (**Node** افتراضي / Edge). إعداد Lineage Config داخل صفحة الـ asset يخص العرض الحالي فقط ولا يُحفظ |
| **OpenMetadata URL** | الأساس لروابط الإيميلات | حقل واحد، افتراضي `http://localhost:8585` ويجب تغييره للإنتاج. يُضبط من **Settings ← Preferences ← OpenMetadata URL** ويُخزَّن مع إعدادات Email |
| **Data Asset Rules** | قواعد validation للـ metadata على مستوى المنصة | مذكور في الدليل العام فقط ولم أجد صفحته التفصيلية |
| **Learning Resources** | محتوى تعليمي داخل المنتج | مذكور في الدليل العام فقط ولم أجد صفحته التفصيلية |

> **ما لم يُنقل حرفياً:** صفحات Search وData Asset Rules وLearning Resources التفصيلية غير موجودة في فهرس v2.0.x الذي وصلت إليه، لذلك أدرجتها بما ذُكر عنها في الصفحة العامة فقط. أرسل لي لقطات أو نصوصها لو أردت مطابقتها بالحرف. وحقل "Custom properties" غير مذكور في هذه الصفحة فلم أضفه كإعداد Preferences.

**التنفيذ عندنا:** كل إعداد يُخزَّن في جدول `setting` (key/value) مع `updated_by`، ويُخدَّم عبر `GET/PUT /api/v1/settings/{key}`، وتغييره يدخل الـ audit. وأسرار الـ SMTP تُخزَّن مشفرة أو في secret manager.

---

## 6. خط الـ Matching (Splink)

**Backend (محرك تنفيذ قابل للتبديل):** DuckDB أو Apache Spark، بنفس كود الـ matching وبتغيير الـ linker فقط (انظر 6.1).

**المراحل:**
1. **Standardization:** تطبيع الأسماء العربية (توحيد الألف والياء/الألف المقصورة والتاء المربوطة، حذف التشكيل)، تنظيف التليفونات للصيغة الدولية، توحيد العناوين. مكتبة FuzzyLookup عندك مرشحة لتكون جزء من طبقة التطبيع/الـ blocking.
2. **Blocking:** مثل `phone`، `tax_id`، `(first token of name + city)`، `email domain + name prefix`، مع تجنب blocks ضخمة.
3. **Comparisons:** Jaro-Winkler / Levenshtein للأسماء، exact + term-frequency adjustment للتليفون والرقم الضريبي، مقارنة array للإيميلات.
4. **Training:** `estimate_u_using_random_sampling` ثم EM بـ blocking rules مختلفة، ويفضل تعزيزها بعينة labelled صغيرة من التاسكات المحسومة لاحقاً.
5. **Thresholds (قابلة للضبط):**
   - ≥ 0.95 → auto-cluster
   - بين 0.70 و 0.95 → task مراجعة
   - < 0.70 → تجاهل
6. **Clustering:** `cluster_pairwise_predictions_at_threshold` مع قفل مانع للـ merge بين سجلات اتحددت كـ "Not a match" يدوياً.
7. **Incremental:** سجلات جديدة تقارن بالـ golden/records الحالية بدل إعادة تشغيل كل شيء، وإعادة تدريب دورية.
8. كل تشغيل يحفظ `model_version` ومقاييسه حتى تقدر تتتبع الجودة وترجع لنسخة سابقة.

### 6.1 Apache Spark كمحرك للمعالجة الثقيلة

**القرار:** Spark مدعوم كـ **compute engine** للأحمال الثقيلة، بينما يبقى باقي المنصة (FastAPI، UI، MCP، الـ metadata، الـ tickets/tasks، الـ RBAC) على PostgreSQL. ليس من المناسب بناء الأداة كلها على Spark، لأن الـ stewardship والـ workflows معاملاتية وزمن استجابتها بالثواني، وSpark لا يخدم هذا النوع.

| الحمل | المحرك الافتراضي | مع Spark |
|---|---|---|
| Splink: blocking وتدريب وتنبؤ وclustering | DuckDB | `SparkAPI` (نفس الـ settings والـ comparisons) |
| Ingestion لمصادر كبيرة (JDBC/Delta/Parquet) | Python workers | Spark readers مع partitioning |
| نشر الـ dims إلى Delta | كتابة من الـ worker | `MERGE` أصلي في Delta على Spark |
| Standardization الجماعي | Python/DuckDB | Spark SQL / UDFs (Pandas UDF للتطبيع العربي) |
| الـ Tasks، Tickets، الـ API، الـ UI | PostgreSQL + FastAPI | لا تتغير |

**أماكن التشغيل:**
1. **Docker (تطوير وتجربة):** خدمات `spark-master` و`spark-worker` ضمن profile اسمه `spark`، والـ worker يرسل الـ jobs عبر `spark-submit` أو **Spark Connect**.
2. **Databricks (إنتاج، لو الـ lakehouse عندكم عليها):** الـ jobs تُرسل كـ Jobs/Workflows إلى cluster موجود، فلا نُدير Spark بأنفسنا، ونقرأ ونكتب Delta في Unity Catalog مباشرة.
3. **Spark مستقل (Kubernetes/YARN):** ممكن لاحقاً بنفس الـ job.

**ملاحظات تقنية:**
- clustering في Splink على Spark يحتاج عادة مكتبة **GraphFrames** وcheckpoint directory، فتتأكد من المتطلبات في نسخة Splink المعتمدة قبل التثبيت.
- الـ Pandas UDFs للتطبيع العربي (أو FuzzyLookup) تحتاج تعبئة الـ package على كل executor.
- الـ blocking يبقى العامل الأهم في الأداء بغض النظر عن المحرك.

**متى يستحق Spark فعلاً؟** لحجم ~950K سجل، DuckDB على جهاز واحد مناسب الذاكرة يكفي غالباً وهو أبسط في التشغيل. Spark يكسب عندما: (أ) تتجاوز البيانات عشرات الملايين، أو (ب) تدمج عدة entity types (`dim_vendor`, `dim_product`) في تشغيلات متزامنة، أو (ج) تريد الاشتغال مباشرة على جداول Delta بدون نقل بيانات. لذلك نبدأ **بـ DuckDB**، ونضيف Spark عندما تقيس الحاجة، والكود جاهز للتبديل من البداية.

## 7. الـ Survivorship

استراتيجيات لكل attribute: `source_priority`, `most_recent`, `most_complete`, `most_frequent`, `longest`, `manual_override`. يحفظ الـ golden record مصدر كل قيمة ليعرضها Customer 360.

### 7.1 الـ Golden Records كـ Dimension Tables للـ Data Platform

الـ golden records ليست مجرد شاشة مراجعة، بل هي **الـ conformed dimensions** التي تستهلكها الـ facts وتقارير الـ BI. وتُسجَّل هذه الـ dims في **OpenMetadata** كـ assets (مع lineage: مصادر ← golden ← dim ← الجداول والتقارير التابعة) عبر التكامل في 3.4، لتظهر في الحوكمة العامة بجانب باقي الـ data platform.

**الجداول المنشورة (schema اسمه `mdm_dim`):**

| الجدول | الوظيفة | أهم الأعمدة |
|---|---|---|
| `dim_customer` | الـ dimension بنمط **SCD Type 2** | `customer_sk` (surrogate، يتغير مع كل نسخة)، `customer_id` (durable key ثابت للـ golden)، attributes المعتمدة، `valid_from`, `valid_to`, `is_current`, `record_hash`, `golden_version`, `dq_score` |
| `xref_customer_source` | ربط كل سجل مصدري بالـ golden (crosswalk) | `customer_id`, `source_system`, `source_id`, `match_probability`, `is_active` |
| `customer_merge_map` | تتبع الدمج والفك | `retired_customer_id` ← `survivor_customer_id`, `merged_at`, `event_id` |

- صف **Unknown member** ثابت (`customer_sk = -1`) تربط به الـ facts التي لا يُعرف عميلها بعد، بدل الـ NULLs.
- الـ `customer_id` هو المفتاح الذي تحمله الـ facts، أما `customer_sk` فيُستخدم لو أرادت الـ facts ربط تاريخي دقيق بنسخة الـ dimension.

**التعامل مع Merge / Unmerge:**
- عند دمج golden record في آخر: يبقى المعرّف الأقدم (survivor)، ويُسجَّل القديم في `customer_merge_map`، فتستطيع الـ facts القديمة إعادة الربط بدون فقدان تاريخ.
- عند Unmerge: يُنشأ `customer_id` جديد للجزء المنفصل ويُسجَّل الحدث، ولا يُعاد استخدام معرّف قديم.
- كل تغيير في قيمة attribute معتمدة يُغلق الصف الحالي (`valid_to`) ويفتح صفاً جديداً (SCD2)، مع تحديد attributes التي تُعامل Type 1 (تصحيح بلا تاريخ) وType 2 (احتفاظ بالتاريخ) عبر config لكل عمود.

**ما الذي يُنشر:**
- golden records بحالة `approved` فقط. والمعلّق على مراجعة (match tasks مفتوحة) يظل بنسخته الأخيرة المعتمدة.
- **DQ gate:** يتوقف النشر لو هبطت اختبارات الـ dimension (uniqueness للـ `customer_id`، الحقول الإلزامية، نسبة الـ nulls) عن الحد المضبوط، ويُفتح Task للـ steward.
- لكل نشر سجل في `publish_run` (عدد الصفوف المضافة/المغلقة، checksum، المدة، الحالة).

**قنوات التوصيل (Sinks):**
1. **Databricks / Delta Lake (Unity Catalog):** كتابة في طبقة gold عبر `MERGE` على staging ثم تبديل ذري، وهو المسار الأساسي لو الـ data platform على lakehouse.
2. **PostgreSQL views للقراءة:** لأدوات BI مثل Power BI، بدون الاعتماد على الـ lakehouse.
3. **ملفات Parquet على object storage:** لأي منصة أخرى.
4. **REST وMCP (قراءة):** `get_customer_360` و`resolve_customer_id(source_system, source_id)`.

**جدولة النشر:** (أ) full snapshot مبدئي، (ب) incremental بعد كل دفعة موافقات حسب watermark على `golden_version`، (ج) إعادة بناء كاملة عند الطلب. كل Sink يعمل في الـ worker بـ connection مخصص (نفس الـ connector SPI، لكن اتجاهه **Sink**).

**Data contract:** كل dim له schema موثّق ومُصدَّر (version)، وأي تغيير breaking (حذف/تغيير نوع عمود) يتطلب ticket وموافقة قبل النشر، ويُسجَّل في الـ lineage أي تقارير تتأثر.

**التعميم:** نفس القالب يخدم لاحقاً `dim_vendor` و`dim_product`، فالـ MDM engine يتعامل مع **entity type** قابل للإعداد (attributes، blocking، survivorship، dim spec).

### 7.2 Write-back للأنظمة المصدرية (كل المنصات)

يُعاد الـ golden (أو أجزاء منه) إلى كل نظام متصل، ليبقى الـ master موحداً في المصدر نفسه وليس في الـ data platform فقط.

**المبادئ:**
1. **قدرة الكتابة لكل connector** (capability matrix): كل connector يعلن ما يدعمه (`create`, `update`, `merge/link`, `delete`)، وما لا يدعمه يعمل بنمط `notify_only` (تنبيه/Task للمسؤول عن النظام).
2. **عبر الواجهات المعتمدة فقط:** OData/REST/BAPI للأنظمة مثل C4C وS/4HANA، وجداول staging أو stored procedures معتمدة لقواعد البيانات. **لا تحديث مباشر لجداول SAP الأساسية.**
3. **الموافقة والـ audit:** كل `writeback_policy` يحدد هل يلزم approval (افتراضياً نعم للتحديث والدمج). وكل job يحفظ الـ payload الكامل، ومن وافق، والنتيجة، ويظهر في الـ audit_log.
4. **Dry-run افتراضي** في أول تشغيل لأي connector/entity: نعرض ما *كان* سيُكتب دون تنفيذ.
5. **Idempotency:** `idempotency_key` لكل job، وإعادة المحاولة آمنة (exponential backoff)، مع Dead-letter ويفتح Task عند الفشل المتكرر.
6. **حماية من الحلقات:** التغيير الذي كتبناه نحن يُوسَم (hash/نسخة) فلا يُعاد ingest كأنه تعديل جديد من المصدر.
7. **حسم التعارض:** لو تغير السجل في المصدر بعد أخذ الـ golden، نقارن `last_changed` قبل الكتابة، ولو تعارض يتحول إلى Task مراجعة بدل الكتابة فوقه.
8. **نطاق الحقول:** `field_map` لكل نظام يحدد أي attributes تُكتب وأيها read-only (مثل أرقام ضريبية أو حقول يملكها المصدر).
9. **Rollback:** نحتفظ بالقيمة السابقة لكل حقل مكتوب ليمكن التراجع من الـ UI حيث يدعم النظام ذلك.

**الأنماط (`mode`):**

| النمط | المعنى |
|---|---|
| `enrich` | تحديث حقول محددة فقط بقيم الـ golden (تصحيح الأسماء/العناوين…) |
| `update` | مزامنة كاملة لمجموعة الحقول المحددة |
| `create` | إنشاء السجل في نظام لا يحتويه (مثل نتيجة Ticket معتمد) |
| `link` / `merge` | إبلاغ أو تنفيذ الدمج حيث يدعمه النظام (مثل إشارة لسجلات مكررة) |
| `notify_only` | لا كتابة، فقط Task/إشعار للمالك |

**الربط بالـ Tickets (5.2):** عند الموافقة على طلب إنشاء، يُنشأ السجل في المنصة أولاً، ثم `writeback_job` من نوع `create` للأنظمة المحددة في الـ ticket، ويُرجَع الـ `target_id` ليُسجَّل في `xref_customer_source`.

**الصلاحيات:** resources جديدة في Roles & Policies: `WritebackPolicy` و`WritebackJob` مع operations `Create` و`Approve` و`Execute` و`Rollback`، وهي **Critical**، ولا تُمنح إلا لـ Admin وData Steward معتمد، مع فصل المهام (من يعدّل الـ policy ≠ من يوافق على الـ job).

**التنفيذ:** يعمل في الـ worker بحساب خدمة لكل نظام بأقل صلاحيات، وتُستخدم نفس الـ Connector SPI مع واجهة `Sink` (`write(entity, mode)`).

---

## 8. الـ MCP Server

Tools (قراءة افتراضياً، والكتابة محصورة ومسجلة في الـ audit):

| Tool | وصف |
|---|---|
| `search_assets` | بحث في الكتالوج |
| `get_asset` / `get_lineage` | تفاصيل وlineage |
| `search_customers` | بحث عن عميل |
| `get_customer_360` | الـ golden + المصادر + DQ |
| `list_match_candidates` | pairs قيد المراجعة |
| `get_dq_summary` / `list_dq_failures` | حالة الجودة |
| `list_tasks` / `get_task` | الـ tasks |
| `resolve_task` | يتطلب صلاحية steward وتأكيداً صريحاً |

- Transport: Streamable HTTP، مع توكن لكل مستخدم يطبّق نفس الـ RBAC الخاص بالـ API.
- Resources: schemas وتعريفات الـ glossary.
- الـ PII يتقنّع افتراضياً في ردود MCP حسب الصلاحية (ممكن يتكامل مع prompt_shield عندك).

---

## 9. الـ Docker

`docker-compose.yml` بالخدمات:

| Service | Image/Build |
|---|---|
| `postgres` | postgres:16 |
| `redis` | redis:7 |
| `kafka` | Apache Kafka (KRaft، بدون ZooKeeper) — عمود الـ ingestion الفقري (3.5) |
| `schema-registry`, `kafka-ui` (اختياري) | التحقق من الـ schemas ومراقبة الـ topics |
| `kafka-connect` (profile `cdc`) | Debezium لـ CDC من قواعد البيانات |
| `api` | build ./backend (FastAPI + Uvicorn) |
| `worker` | نفس صورة الـ backend بأمر مختلف (ingestion/matching/dq) |
| `scheduler` | نفس الصورة، يطلق الـ workflows المجدولة |
| `ui` | build ./frontend (Nginx يخدم React) |
| `mcp` | build ./mcp |
| `keycloak` (اختياري) | OIDC SSO |
| `spark-master` + `spark-worker` (profile `spark`) | Apache Spark (مع Delta Lake وGraphFrames) للـ matching والنشر على نطاق كبير |

الـ migrations بـ Alembic عند تشغيل `api`. وهناك profile اسمه `demo` يحمّل بيانات عملاء تجريبية (مع duplicates مقصودة) ليعمل المشروع فوراً.

---

## 10. هيكل الـ Repo

```
mdm-platform/
├─ backend/
│  ├─ app/ (api, models, services, rbac)
│  ├─ ingestion/ (framework, connectors/, adapters/openmetadata/)
│  ├─ matching/ (standardize, blocking, model, cluster, survivorship)
│  ├─ dq/
│  └─ migrations/
├─ frontend/ (React + TS)
├─ mcp/
├─ docker/ 
├─ docker-compose.yml
└─ docs/
```

---

## 11. خارطة الطريق

| المرحلة | المحتوى |
|---|---|
| **M0** | Compose يعمل: API + DB + UI shell + MCP skeleton + auth |
| **M1** ✅ (منفّذ؛ مختبر عبر InlineBus، مسار Kafka لم يُختبر end-to-end) | Connector SPI (ينتج events إلى Kafka) + Postgres/CSV/C4C + `ingest-writer` + صفحة Catalog + Alembic |
| **M1.2** | Schema Registry + الـ DLQ + مراقبة consumer lag + Debezium (profile `cdc`) |
| **M2** | Standardization + Splink pipeline + match_pair + clusters (محرك DuckDB، مع تجريد المحرك ليقبل Spark) |
| **M2.5** | تشغيل نفس الـ pipeline على Spark (profile `spark` أو Databricks) ومقارنة الأداء والنتائج مع DuckDB |
| **M1.5** | تكامل OpenMetadata (3.4): قراءة domains/glossary/owners/tags + نشر الـ assets المصدرية |
| **M3** | Golden Records + survivorship + Customer 360 |
| **M3.5** | نشر الـ dims (`dim_customer` SCD2 + xref + merge map) إلى Delta/Postgres views، مع DQ gate وسجل `publish_run` |
| **M4** | Tasks workflow + Data Quality tab + SQL Editor (Custom DQ Rules) + Tickets |
| **M5** | Roles & Policies (محرك RBAC/ABAC) + Access Tokens (PAT/Bots) + Preferences + MCP كامل + audit + hardening |
| **M5.5** | Data Insights: dashboard + KPIs + Service Insights + التقرير الدوري |
| **M6** | موجة connectors 2، وwrite-back (7.2): أولاً SAP C4C وS/4HANA، ثم باقي الـ connectors حسب الـ capability matrix |

---

## 12. المخاطر وقرارات مفتوحة

1. **تغطية الـ connectors:** هل الـ adapter لـ openmetadata-ingestion كافٍ، أم ستُكتب connectors أصلية؟ يُحسم في M1.
2. **جودة المطابقة العربية:** تحتاج عينة labelled حقيقية من بيانات C4C لضبط الـ thresholds، فلا تعتمد على أرقام نظرية.
3. **Splink على ~950K سجل:** DuckDB مرجح يكفي، لكن الـ blocking هو العامل الحاسم في الأداء. يحتاج قياس مبكر في M2.
4. **PII والصلاحيات:** تحديد من يرى بيانات العملاء الخام وما يظهر عبر MCP.
5. **~~علاقة الأداة بـ OpenMetadata~~ (محسوم):** OpenMetadata = أداة حوكمة، وهذه الأداة = Master Data، وتتكاملان ولا تتبادلان الأدوار (قسم 3.4). وتاب Catalog عندنا **مرآة للبيانات القادمة من الـ sources** (قرار محسوم)، وليس مرآة لـ OpenMetadata.
6. **~~Write-back~~ (محسوم):** مطلوب لكل المنصات المتصلة، لا C4C وS/4HANA فقط. التصميم في 7.2. المخاطر: كل نظام له قيوده (APIs المسموحة، الصلاحيات، مفاتيح الدمج)، وقد يمنع بعضها الكتابة أصلاً، فتُعرَّف **قدرات الكتابة لكل connector** (capability matrix) ولا تُفترض.
