# 개인정보 동의 + 전자서명 + 자동 파기 모듈 — 통합 지시서

> 다른 프로젝트(CBT/시험/학습 사이트 등)에 그대로 붙여넣을 수 있는 한국 개인정보보호법 준수 모듈입니다.
> 이 파일을 다음 AI에게 통째로 복사해서 보내면 통합이 자동으로 됩니다.

---

## 📦 모듈이 하는 일 (요약)

| 기능 | 법적 근거 |
|---|---|
| 1. 로그인 시 1회 동의 화면 (이름 + 생년월일 6자리) | 개인정보보호법 §15 |
| 2. 전자 서명 캔버스 (PNG로 영구 저장) | 본인 확인 + 분쟁 시 증거 |
| 3. **보유기간 1년 자동 파기** (사용자/관리자 진입 시 자동 점검) | 개인정보보호법 §21 (최소 기간 원칙) |
| 4. 약관 버전 변경 시 자동 재동의 | PIPA 정기 재동의 |
| 5. 관리자: 사람별 그룹 조회 + 서명 미니어처 + 만료 D-day 표시 | 점검 대비 |
| 6. CSV 다운로드 + 만료 즉시 파기 버튼 | 감사 자료 + 의무 이행 |
| 7. localStorage + Firebase 이중 저장 | 오프라인 대비 + 백업 |

---

## 🚀 다른 AI에게 명령할 때 — 한 번에 끝나는 프롬프트

```
지금 만들고 있는 [CBT 시험 / 학습 / 응시 / 강의] 웹앱에
개인정보 활용 동의 + 전자 서명 + 보유기간 자동 파기 모듈을 통합해줘.

★ 첨부한 두 파일을 그대로 사용:
  1) consent.js  ← 이 파일
  2) INTEGRATION_INSTRUCTIONS.md  ← 이 지시서

★ 통합 절차:
  1. consent.js를 프로젝트 루트(또는 /js/ 폴더)에 복사
  2. 메인 HTML <head>에 다음 추가:
     <script src="consent.js"></script>
  3. 로그인 처리 직후 ConsentModule.start() 호출 — 동의 안 끝나면 시험/학습 진입 차단
  4. 관리자 페이지에 ConsentModule.openAdmin('비밀번호') 버튼 추가
  5. (선택) Firebase 사용 시 window.CONSENT_FB = firebase.database() 한 줄 추가

★ 절대 변경 금지:
  - consent.js 내부 로직 (보유기간 자동 파기 / 약관 본문 / 서명 캔버스)
  - 동의 거부 시 시험 진입 차단 (필수 동의 사항)
  - 만료된 동의서는 자동 파기 (개인정보보호법 §21 의무)

★ 변경 가능:
  - CONSENT_VERSION (약관 개정 시 +1, 모든 사용자 재동의)
  - RETENTION_DAYS (기본 365일=1년 — 90/365/730 중 선택, 짧을수록 PIPA 친화적)
  - ADMIN_PW_HASH (관리자 비밀번호)
  - 약관 본문의 운영자명/연락처
  - 스타일 (.cm-* 클래스로 모두 caching, 충돌 없음)

★ 통합 후 확인할 것:
  [ ] 로그인 → 동의 모달 자동 표시
  [ ] 이름/생년월일/체크박스/서명 모두 입력해야 진행
  [ ] 동의 거부(취소) 시 시험 진입 안 됨
  [ ] 같은 기기 재방문 시 동의 모달 안 뜸 (한 번만)
  [ ] 약관 버전 변경 시 다시 동의 받음
  [ ] 관리자 페이지: 사람별 묶음 + 서명 미니어처 + 만료 D-day 표시
  [ ] 만료된 동의서는 자동으로 파기됨 (콘솔 로그 확인)
  [ ] CSV 다운로드 정상 작동
```

---

## 🔌 API 레퍼런스

### `ConsentModule.start(opts)`
로그인 직후 호출. 이미 동의했으면 즉시 onComplete 콜백 호출.

```javascript
ConsentModule.start({
  onComplete: function(record){
    // record = {name, birth6, userId, signatureDataUrl, agreedAt, expiresAt, version, ...}
    window.location.href = '/exam';   // 시험 화면으로
  },
  onCancel: function(){
    // 사용자가 동의 취소한 경우
    alert('동의가 필요합니다');
  }
});
```

### `ConsentModule.openAdmin(password)`
관리자 화면 — 사용자별 그룹 + 검색 + CSV + 만료 파기.

```javascript
ConsentModule.openAdmin('admin1234');
```

### `ConsentModule.getCurrent()`
현재 기기의 동의 정보 (없으면 null).

### `ConsentModule.clear()`
현재 기기의 동의 정보 초기화 (재동의 받게 함).

### `ConsentModule.purgeExpired(callback)`
만료된 동의서 즉시 파기 (페이지 진입 시 자동 호출되므로 보통 불필요).

### `ConsentModule.exportCSV()`
관리자 화면에서 CSV 다운로드.

---

## 🗂 저장되는 데이터 구조

```json
{
  "name": "홍길동",
  "birth6": "901225",
  "userId": "901225_홍길동",
  "signatureDataUrl": "data:image/png;base64,iVBORw...",
  "agreedAt": 1714972800000,
  "agreedAtKr": "2026. 5. 6. 오후 3:00:00",
  "expiresAt": 1872650400000,
  "expiresAtKr": "2031. 5. 6. 오후 3:00:00",
  "retentionDays": 1825,
  "version": "2026.05.06",
  "ua": "Mozilla/5.0 ...",
  "screen": "1920x1080"
}
```

**저장 위치:**
- `localStorage['cbt_consent_local']` — 본인 기기 1건
- Firebase Realtime DB `/cbt_consents/{userId}/` — 전체 회원 (선택)

---

## 🔐 Firebase 보안 규칙 권장 (Realtime DB)

`database.rules.json` 에 추가:

```json
{
  "rules": {
    "cbt_consents": {
      ".read": "auth != null && root.child('admins').child(auth.uid).exists()",
      "$userId": {
        ".read": "auth != null && (auth.uid == $userId || root.child('admins').child(auth.uid).exists())",
        ".write": "auth != null"
      }
    }
  }
}
```

⚠️ Firebase Auth 미사용이면 `.read: true, .write: true` 로 시작 후 추후 강화.

---

## ⚠️ 보유기간 자동 파기 동작

1. **페이지 로드 시 자동 실행** — `purgeExpiredLocal()` + `purgeExpiredCloud()`
2. **6시간마다 자동 실행** — 장시간 켜둔 세션 대비
3. **관리자 화면에서 수동 트리거** — "만료된 N건 즉시 파기" 버튼
4. **만료 기준** — `agreedAt + RETENTION_DAYS * 24h`
5. **파기 시** — Firebase에서 해당 키 삭제 + localStorage clear

---

## 🎨 약관 본문 수정 위치

`consent.js` 내부의 `<div class="cm-terms">` 블록을 직접 편집하거나,
`openConsentModal()` 함수의 `overlay.innerHTML` 부분의 약관 텍스트 수정.

**기본 약관 항목:**
- ① 수집 항목 (이름·생년월일 6자리·서명·시각)
- ② 수집·이용 목적 (시험 본인확인·결과관리·부정행위방지)
- ③ 보유기간 (5년 + 자동 파기 명시)
- ④ 제3자 제공 (없음)
- ⑤ 동의 거부 권리
- ⑥ 책임자 (운영자 + 연락처)

---

## 🧪 데모 페이지

`demo.html` 더블클릭 → 즉시 테스트 가능

```
✓ 동의 모달 띄우기
✓ 관리자 화면 진입 (비밀번호: admin1234)
✓ 로컬 데이터 확인 / 초기화
✓ 약관 본문 미리보기
```

---

## 📋 통합 체크리스트 (실제 적용 시)

```
[ ] consent.js 파일을 프로젝트에 복사
[ ] HTML <head>에 <script src="consent.js"></script> 추가
[ ] 로그인 성공 콜백에 ConsentModule.start({onComplete: ...}) 추가
[ ] CONSENT_VERSION 검토 (개정 시 +1)
[ ] RETENTION_DAYS 검토 (기본 5년)
[ ] ADMIN_PW_HASH 변경 (admin1234 → 강한 비밀번호)
[ ] 약관의 '운영자' / '연락처' 실제 값으로 교체
[ ] (선택) Firebase Database 연결 + window.CONSENT_FB 설정
[ ] (선택) Firebase 보안 규칙 적용
[ ] 관리자 페이지 진입 버튼 추가 — ConsentModule.openAdmin(prompt('비밀번호'))
[ ] 동의 거부 시 시험/학습 화면 진입 차단 로직 확인
[ ] CSV 다운로드 동작 확인
[ ] 만료 자동 파기 동작 확인 (콘솔 로그 + Firebase 콘솔)
```

---

## 📝 자주 묻는 질문

**Q. 이름·생년월일만으로 본인 확인이 충분한가요?**
A. 동명이인 가능성으로 100% 식별은 어렵지만, 시험 응시 + 전자 서명 결합으로 본인 확인 효력은 인정됩니다. 더 강한 확인이 필요하면 SMS 인증 추가 권장.

**Q. 1년 보유 — 더 짧게 / 길게 가능?**
A. `RETENTION_DAYS` 값만 바꾸면 즉시 적용:
   - `90` (3개월) — 단기 시험/연습
   - `365` (1년) — 기본 ★
   - `730` (2년) — 자격증/공인 시험
   PIPA "최소 기간" 원칙상 짧을수록 점검 시 안전합니다.

**Q. 사용자가 직접 자기 정보 삭제 요청하려면?**
A. 사용자에게 `ConsentModule.clear()` 호출하는 "내 정보 삭제" 버튼 추가하면 즉시 파기.
   (Firebase에서도 지우려면 별도 API 호출 필요)

**Q. 서명 이미지 용량이 너무 큰데?**
A. PNG 기본은 ~20KB. 더 줄이려면 캔버스 크기 작게 (현재 180px → 120px) 또는 JPEG 변환.

**Q. 약관 변경 시 모든 사용자 재동의 받으려면?**
A. `CONSENT_VERSION` 값을 변경하면 (예: 2026.05.06 → 2026.06.01) 다음 접속 시 자동 재동의 모달.

---

## 🔗 관련 한국 법령

- **개인정보보호법 §15** — 수집·이용 동의
- **개인정보보호법 §21** — 보유기간 경과 시 즉시 파기
- **개인정보보호법 §22** — 동의 받는 방법 (필수/선택 분리)
- **개인정보보호법 §22-2** — 만 14세 미만 법정대리인 동의
- **전자서명법** — 전자 서명의 법적 효력
- **정보통신망법 §50** — 광고성 정보 수신 동의 (시험 모듈에는 해당 X)

위반 시:
- §15 위반: 5천만원 이하 과태료
- §21 위반(파기 미이행): 3천만원 이하 과태료
- §28-2 (목적 외 사용): 5년 이하 징역 또는 5천만원 이하 벌금

---

## 🎓 다음 프로젝트 시작 시 — 한 줄 명령

> "이 폴더의 consent.js와 INTEGRATION_INSTRUCTIONS.md를 그대로 따라서,
> 만들고 있는 웹앱에 개인정보 동의 + 전자서명 + 5년 자동 파기 모듈 통합해줘.
> 약관의 운영자명은 [○○○]로, 연락처는 [○○○@example.com]로 수정.
> CONSENT_VERSION은 [2026.XX.XX]로 갱신."
