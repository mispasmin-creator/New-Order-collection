Mujhe ek React web app banani hai: "Campaign Life FMS". Sponge-iron plants ke kilns ka refractory campaign track hota hai. Pehle repo ka existing stack aur styling dekho aur usi ko follow karo. Agar repo me kuch nahi hai to React + Vite + React Router + Tailwind use karo.

Reference: repo me `campaign-life-ui-samples.html` hai (5 screens ka working mockup). Layout, flow aur labels ke liye usi ko follow karo.

## 1. Architecture (koi backend nahi, koi Google Sheet nahi)
- Sirf frontend. Saara data browser ke localStorage me
- Data access ek hi file me: `src/services/storage.js`. Baaki poori app sirf isi ke functions use kare. Har function async (Promise return kare), taaki baad me backend aasaani se jude
- Pehli baar khulne par seed data: 6 companies, kilns, 12 orders alag-alag steps me (kuch late, kuch on time), 2 campaign ki purani history, 4 KYC contacts, kuch call logs
- Settings me: Export data (JSON), Import data (JSON), Reset demo data
- Light/dark theme, mobile-first (inspector phone par use karta hai)

## 2. Workflow: 5 steps (poori app isi ke around hai, sabse pehle yahi banao)
Har Service Order No. (CN-01, CN-02...) is order me chalta hai. Har step ka apna form/screen aur status hona chahiye:

1. **Company Visit**
   - Kaun: Sales Co-ordinator. Kab: form ke hisaab se (fixed offset nahi)
   - Form: company, kiln no., kiln size, campaign no., date of campaign starting, visited by
   - Submit par: naya order (CN auto) banta hai, visit task done, step 2 ka task banta hai
2. **Running Kiln Inspection**
   - Kaun: Sanjay (Inspector Incharge). Kab: campaign start date + 7 din
   - Form: service order, visit date, inspector, inner temp, inner temp photo, 9 zones ka outer temp, expected shutdown date
   - Auto: avg temp, days since kiln start. Submit par step 3 ka task banta hai
3. **Take Shut Down Date**
   - Kaun: Sanjay. Kab: expected shutdown se 3 din pehle (N-3)
   - Party ko call karke shutdown date lena. Har call ek Call Log hai (section 4 dekho)
4. **Shutdown Inspection**
   - Kaun: Sanjay. Kab: shutdown wale din (N + 0)
   - Form: service order, inspection date, inspector, 9 zones ka refractory distance (mm), har zone ka photo
   - Auto: avg thickness. Submit par step 5 ka task banta hai
5. **Restart the Process**
   - Kaun: CRM. Kab: shutdown date + 2 din
   - Yeh step bhi wahi Company Visit form use karta hai (CRM bharta hai): company chunke naya campaign no. aur naya start date daalta hai
   - Submit par purana order closed, naya order (naya campaign no.) banta hai aur uska step 2 task schedule hota hai. Cycle repeat hota hai

Har step ke liye Planned date, Actual date aur Delay (din) store karo.

## 3. Date aur delay rules (original Google Sheet jaise, pure functions me, `src/utils/workflow.js`)
- Offsets ek config object me rakho (hardcode mat karo): visit = none, running = +7, call = -3, shutdown = 0, restart = +2
- Din **working days** me gine jaate hain, **sirf Sunday off**. Isse Excel ke `WORKDAY.INTL(date, n, "0000001")` jaisa maano: n working days aage, Sunday skip. n = 0 ho to wahi date
- Delay sirf tab dikhao jab **late** ho:
  - Actual hai: delay = actual - planned, agar actual > planned, warna koi delay nahi
  - Actual nahi hai: delay = aaj - planned, sirf agar planned guzar chuka ho
- Koi step Actual hote hi agle step ka Planned automatic calculate ho
- Ek order ka ek step do baar submit na ho sake
- In sab ke Vitest unit tests likho, Sunday skip ke cases ke saath

## 4. Call Tracker (Step 3 ka page, original sheet ka logic)
Shutdown date lene ke liye party ko baar-baar call hoti hai. Har call ek **Call Log** entry hai: timestamp, serviceOrderNo, personCalled, designation, mobile, status, expectedShutdownDate, nextCallDate.

**Status ki exactly 3 values** (sirf yes/no nahi):
- `yes` = "Yes, shut down date taken": expectedShutdownDate bharna zaruri
- `no` = "No, shut down date not taken": nextCallDate bharna zaruri, aur aaj ke baad ki ho
- `forgot` = "Forget to take"

Ek order ki **latest call ka status** decide karta hai ki aage kya hoga:
- `no`: order Call Tracker list me bana rehta hai. Calls made +1, last call aur next call update
- `yes`: order list se hat jaata hai. Shutdown date = di gayi date. **Shutdown inspection planned = shutdown date** (working-day rule). **Restart planned = shutdown date + 2 working days**
- `forgot`: order list se hat jaata hai. Shutdown date = call wali date. **Shutdown inspection planned NAHI banta** (sirf restart planned banta hai = call date + 2 working days)

Call Tracker list me sirf woh orders: jinka call step planned hai aur shutdown date abhi set nahi hui. Sort: expected shutdown date ke hisaab se.
Columns: service order, company, expected shutdown, campaign no., kiln size, kiln no., last call, next call (overdue = laal, aaj = peela), calls made, shutdown given status, "Log call" button.
Log call form: service order, person called, designation, mobile, status dropdown (3 options), status ke hisaab se expected shutdown date ya next call date field, validation, aur us order ki call history.

## 5. KYC (customer contacts)
- Contact **order (CN) ka hota hai, company ka nahi**. Ek company ke 2 CN hon to 2 alag contacts dikhao (original sheet sirf pehla dikhati thi, woh limit mat rakho)
- Data: `kycContacts`: serviceOrderNo, siteIncharge, mobile. Company ka naam order se lookup hota hai, KYC form me nahi bharna
- KYC page: table (KYC no. = CN, company, shift incharge, mobile, status Done / KYC pending), search, aur "Add KYC" form (CN dropdown, name, 10-digit mobile validation, existing CN ho to update)
- Isi page par "Kiln size by company" grid: har company ke liye Kiln 1 se 6 ka size (jaise 100 TPD), orders/kilns data se bana hua

## 6. Data model
- companies: id, name
- kilns: id, companyId, kilnNo (1-6), size
- orders: serviceOrderNo, companyId, kilnId, campaignNo, campaignStartDate, expectedShutdownDate, shutdownDate, status (open/closed)
- stepTasks: id, serviceOrderNo, step (visit/running/call/shutdown/restart), owner (Sales/Sanjay/CRM), plannedDate, actualDate, delayDays, status (pending/done)
- visits: serviceOrderNo, date, visitedBy
- runningInspections: serviceOrderNo, visitDate, inspector, innerTemp, innerTempPhoto, zoneTemps[9], avgTemp, expectedShutdownDate, daysSinceStart
- shutdownInspections: serviceOrderNo, inspectionDate, inspector, zoneThickness[9], zonePhotos[9], avgThickness
- callLogs: timestamp, serviceOrderNo, personCalled, designation, mobile, status (yes/no/forgot), expectedShutdownDate, nextCallDate
- kycContacts: serviceOrderNo, siteIncharge, mobile
Dates ISO (YYYY-MM-DD). Photos base64 me store karo par pehle max 800px tak resize karo, aur storage full hone par saaf error dikhao. Average sirf bhare hue zones ka nikalo.

## 7. Screens
1. **Task Board (home)**: summary strip (open orders, due today, delayed, avg delay, pending calls) aur 5 columns: Company Visit, Running Kiln Inspection, Take Shut Down Date, Shutdown Inspection, Restart. Card: CN no., company, kiln, campaign no., planned date, delay pill, "Open form" button. Late card par laal left border, 2 din ke andar due par warning rang. Filters: owner (Sales/Sanjay/CRM), delayed only, search. Neeche "Calls due today" panel
2. **Step Forms** (mobile-first): Visit, Running, Shutdown ka toggle. Restart Visit form ko reuse karta hai. Live average, photo upload, submit par toast aur board refresh, aur "submit ke baad kya hoga" ki short list
3. **Campaign Dashboard**: company aur kiln select, summary (campaigns, latest campaign ke din, avg thickness, sabse patla zone), Zone 1-9 line chart (thickness mm / temp C toggle, har campaign ki alag line), latest zone bars (160 mm se kam = laal), history table
4. **Call Tracker**: section 4 jaisa
5. **KYC**: section 5 jaisa
6. **Masters aur Settings**: companies aur kilns add/edit/delete, offsets edit, Export, Import, Reset demo data

## 8. Code expectations
- Folders: pages/, components/, hooks/, services/, utils/
- Loading, empty aur error states har screen me. Form validation (required, numeric range, date). Submit button par double-click guard
- Light aur dark theme dono me contrast sahi ho
- README: app kaise chalayein, data kahan store hota hai, backup kaise lein, baad me backend kaise jodein (`storage.js` replace)

## 9. Kaam ka order
1. Pehle plan dikhao aur mere approval ka wait karo
2. Phir pehle workflow banao: `storage.js` + `workflow.js` (tests ke saath) + Task Board + Step Forms (Visit, Running, Shutdown)
3. Phir Call Tracker (3 status ke saath)
4. Phir KYC, Campaign Dashboard, Masters, Settings
5. Har screen ke baad mujhe dikhao
