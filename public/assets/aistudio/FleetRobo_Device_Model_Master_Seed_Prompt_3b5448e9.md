# FleetRobo — Device Model Category Master | Prototype Seed Prompt

## Copy-paste prompt for Google AI Studio / existing prototype

You are modifying the **existing FleetRobo prototype**, not building a new app. Locate the existing **Device Model Category Master / Device Model Master** page and seed its table with the exact dataset below. This is a **frontend prototype only**: no backend, API, Supabase, database migrations, authentication changes, or production integrations.

### Required implementation

1. Preserve the existing page layout, design system, navigation, forms, and other masters. Do not redesign unrelated screens.
2. Seed all **78 rows** below as initial master data. Keep them in a local TypeScript/JavaScript data constant or local JSON fixture that the page can read. The table must show seeded data on first load.
3. Display columns **Sr No | Device Category | Brand | Model | Bluetooth Support** only. Do **not** show Device Type, Status, Created Date, or any legacy internal codes.
4. Sort/group rows by **Device Category**, then **Brand**, then **Model**. Provide category filter, brand filter, and a text search for model/brand. Maintain stable sequential Sr No after filtering if appropriate.
5. Use category names exactly as in seed: GPS, AIS GPS, Portable GPS, E-Lock, Video Telematics. Category and Brand should be selectable when adding/editing.
6. Support prototype-only **Add Model**, **Edit Model**, **Delete Model** with confirmation, and optionally import/export CSV. Store local edits in browser localStorage so they persist in the same browser; use seed data as fallback. Add **Reset to Seed Data** action with confirmation.
7. Prevent duplicate records using a case-insensitive, whitespace-normalized composite key **category + brand + model**. Never remove different models of the same brand.
8. Treat `Model Not Specified` as a **review placeholder**, not a confirmed hardware model. Do not guess or invent missing models. Keep original combined or ambiguous model strings as supplied; flag them for later review rather than silently splitting or changing them.
9. Bluetooth Support is metadata, not a device category. Preserve Yes / BLE / Not specified values; do not infer capabilities.
10. If there is an existing Add Device / Asset Store form with Device Category, Brand, Model selection, connect the prototype dropdown options to this seeded master: **Category → Brand → Model**; changes to the master should update those dropdown options in the same prototype.
11. Ensure all seeded rows are visible and correctly grouped. Show a total count of **78**, with category totals derived dynamically from data, not hardcoded.
12. Do not alter existing device-to-code mappings, APIs, business logic, or other modules. This seed is for UI demonstration only.

### Exact seed dataset (CSV)

```csv
Sr No,Device Category,Brand,Model,Bluetooth Support
1,GPS,Acumen,G20,Not specified
2,GPS,Acumen,M04,Not specified
3,GPS,Acumen,M1,Not specified
4,GPS,Acumen TOPFLY,Solar X120,BLE
5,GPS,Amit,SK05,Not specified
6,GPS,Atlanta,AL100,Not specified
7,GPS,Atlanta,CW-100,Not specified
8,GPS,Atlanta,E101,Not specified
9,GPS,Atlanta,L400,Not specified
10,GPS,Atlanta,LC100,Not specified
11,GPS,Atlanta,WP30L,Not specified
12,GPS,Bharat 101,Bharat 101,Not specified
13,GPS,Binary,FR Lite,Not specified
14,GPS,Binary,FR5,Not specified
15,GPS,G-trophy,AIS 140,Not specified
16,GPS,Map my India,MMI350758,Not specified
17,GPS,Map my India,MT 100,Not specified
18,GPS,Pictor,Model Not Specified,Not specified
19,GPS,Pictor,P06,Not specified
20,GPS,Pictor,PS03,Not specified
21,GPS,Pictor,PS10C,Not specified
22,GPS,Pictor,V5,Not specified
23,GPS,Pictor,"XYZ,PT06 lite",Not specified
24,GPS,Pictor/Telemologix,"XYZ,PT06/G5B/G61/GH02/",Not specified
25,GPS,Road Pin,AT200,Not specified
26,GPS,Road Pin,ET300,Not specified
27,GPS,Road Pin,GAGAN 101,Not specified
28,GPS,Road Pin,JV07,Not specified
29,GPS,Road Pin,RP06,Not specified
30,GPS,Teltonika,ATRM50,Yes
31,GPS,Teltonika,FMB120,Yes
32,GPS,Teltonika,FMB125,Yes
33,GPS,Teltonika,FMB207,Yes
34,GPS,Teltonika,FMB209,Not specified
35,GPS,Teltonika,FMB910,Yes
36,GPS,Teltonika,FMB920,Yes
37,GPS,Teltonika,FMC920,Not specified
38,GPS,Teltonika,Model Not Specified,Not specified
39,GPS,Teltonika,TF100,Not specified
40,GPS,TOPFLY,PioneerX100,Yes
41,GPS,Transight,Discovery 2G,Not specified
42,GPS,Transight,TSB101,Not specified
43,GPS,Unknown,Model Not Specified,Not specified
44,GPS,Volty,Volty-AIS 140,Not specified
45,AIS GPS,Acute,AIS 140,Not specified
46,AIS GPS,Track now,AIS 140,Not specified
47,Portable GPS,Pictor,GS21,Not specified
48,Portable GPS,Pictor,PT002,Not specified
49,Portable GPS,Pictor,X10,Not specified
50,Portable GPS,Pictor/Road pin,S20,Not specified
51,Portable GPS,Road Pin,GT03A,Not specified
52,Portable GPS,Road Pin,JV200,Not specified
53,Portable GPS,Teltonika,FMB003,Not specified
54,Portable GPS,Teltonika,FMC003,Not specified
55,Portable GPS,Teltonika/Atlanta,OBD 400/FMB003,Yes
56,E-Lock,Atlanta,LC100+Digital Lock,Not specified
57,E-Lock,Atlanta,WP30L,Not specified
58,E-Lock,Dhanuka,310P,BLE
59,E-Lock,G Trac,GL400,BLE
60,E-Lock,Galvanic,IoT (model unspecified),BLE
61,E-Lock,I Triangle,TS101,Not specified
62,E-Lock,IMZ,GL400,Not specified
63,E-Lock,IMZ,JT701,Not specified
64,E-Lock,IMZ,JT701D,Not specified
65,E-Lock,IMZ,TraQ310,Not specified
66,E-Lock,IMZ,Traqloc508,Not specified
67,E-Lock,IMZ/Pictor,Traqloc310P,Not specified
68,E-Lock,IMZ/Road Pin,Model Not Specified,Not specified
69,E-Lock,Pictor,GL-600,BLE
70,E-Lock,Pictor,PL200,BLE
71,E-Lock,Pictor,PL610,BLE
72,E-Lock,Proxgy,Lockator,BLE
73,E-Lock,Road Pin,Traqloc508,Not specified
74,Video Telematics,Pictor/Metta,MC202L,Not specified
75,Video Telematics,Pictor/Metta,MC202N,Not specified
76,Video Telematics,Pictor/Metta,Model Not Specified,Not specified
77,Video Telematics,Star link,Model Not Specified,Not specified
78,Video Telematics,Streamax,C6D (V7.0) AD lite/AD plus,Not specified
```

### Acceptance checks

- 78 seed rows loaded without duplicates by category + brand + model.
- Categories appear together; brands/models sorted within each category.
- No Device Type, Status, Created Date fields.
- Add/Edit/Delete and filtering work in the prototype without a backend.
- Missing/ambiguous models remain explicitly marked for review.
- Dependent Category → Brand → Model dropdowns read the same master dataset, if that flow exists.

**Implementation instruction:** Make these changes directly in the existing prototype page and show the populated table; do not stop after generating a plan.