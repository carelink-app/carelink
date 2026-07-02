/**
 * 개인정보 활용 동의 + 전자서명 모듈 (CBT/시험 웹 전용)
 * ─────────────────────────────────────────────────────────────
 * 사용법:
 *   1) 이 파일을 웹에 포함:
 *      <script src="consent.js"></script>
 *
 *   2) Firebase 연결 (선택, 클라우드 저장 시):
 *      window.CONSENT_FB = firebase.database();   // firebase 8 compat
 *
 *   3) 로그인 후 호출:
 *      ConsentModule.start({
 *        onComplete: function(record){
 *          console.log('동의 완료:', record);
 *          // 시험/학습 화면으로 진입
 *        },
 *        adminMode: false   // 관리자 모드면 true
 *      });
 *
 *   4) 관리자 화면에서 목록 조회:
 *      ConsentModule.openAdmin('관리자비밀번호');
 *
 * 저장 위치:
 *   - localStorage: cbt_consent_local (오프라인 백업)
 *   - Firebase: /cbt_consents/{userId}/  (선택)
 *
 * 수집 항목:
 *   - 이름 (실명)
 *   - 생년월일 앞 6자리 (예: 901225)
 *   - 동의 시각 + 약관 버전
 *   - 전자 서명 이미지 (Base64 PNG)
 *
 * 법적 근거:
 *   - 개인정보보호법 §15(수집·이용 동의)
 *   - 시험 응시자 본인 식별 + 부정행위 방지 목적
 */

(function(global){
  'use strict';

  var CONSENT_VERSION = '2026.05.06';
  // ★ 실제 운영 시 반드시 강한 비밀번호로 변경하고 서버사이드 인증 사용
  // 간이 해시 비교 (SHA-256 등으로 교체 권장)
  var ADMIN_PW_HASH = 'carelink2026!secure';   // ★ 반드시 변경 필요 — Firebase Custom Claims 권장

  // ────────────────────────────────────────────────────────────
  //  보유기간 — 개인정보보호법 §21 (목적 달성 시 즉시 파기 + 최소 기간 원칙)
  // ────────────────────────────────────────────────────────────
  //  수집 항목이 적음(이름+생년월일 6자리+서명)이므로 짧게 설정.
  //  용도별 권장:
  //   ·  90일 — 단기 시험/연습 (가장 가벼움)
  //   · 365일 — 정식 시험 결과 증빙 (기본)  ★ 현재 설정
  //   · 730일 — 자격증/공인 시험 (2년)
  //  분쟁 대비로 길게 잡지 않는 것이 PIPA 정신에 부합 — 점검 시 짧을수록 안전.
  var RETENTION_DAYS = 365;            // 기본: 1년 (필요 시 90/365/730 중 선택)
  var ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // ────────────────────────────────────────────────────────────
  //  스타일 (한 번만 주입)
  // ────────────────────────────────────────────────────────────
  function injectStyles(){
    if(document.getElementById('consent-module-styles')) return;
    var style = document.createElement('style');
    style.id = 'consent-module-styles';
    style.textContent = `
      .cm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px;animation:cmFadeIn .2s ease-out}
      @keyframes cmFadeIn{from{opacity:0}to{opacity:1}}
      .cm-sheet{background:#fff;width:100%;max-width:520px;max-height:92vh;border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.25)}
      .cm-header{padding:20px 22px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between}
      .cm-title{font-size:18px;font-weight:800;color:#222}
      .cm-close{font-size:24px;color:#999;cursor:pointer;padding:4px}
      .cm-body{flex:1;overflow-y:auto;padding:20px 22px}
      .cm-footer{padding:14px 22px;border-top:1px solid #eee;display:flex;gap:10px}
      .cm-input{width:100%;padding:13px 14px;border:2px solid #ddd;border-radius:10px;font-size:16px;outline:none;transition:border .15s}
      .cm-input:focus{border-color:#1976D2}
      .cm-label{font-size:14px;font-weight:700;color:#555;margin-bottom:6px;display:block}
      .cm-row{margin-bottom:14px}
      .cm-btn{padding:13px 18px;border-radius:10px;border:none;font-size:15px;font-weight:700;cursor:pointer;transition:transform .1s}
      .cm-btn:active{transform:scale(.97)}
      .cm-btn-primary{background:#1976D2;color:#fff;flex:1}
      .cm-btn-outline{background:#fff;color:#666;border:1.5px solid #ddd;flex:1}
      .cm-btn-danger{background:#E53935;color:#fff}
      .cm-terms{background:#f5f5f5;border-radius:10px;padding:14px 16px;font-size:13px;color:#444;line-height:1.7;max-height:220px;overflow-y:auto;border:1px solid #e0e0e0}
      .cm-terms b{color:#222;display:block;margin-top:8px}
      .cm-checkrow{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:10px;background:#FFF8E1;border-radius:8px;cursor:pointer}
      .cm-checkrow input{width:20px;height:20px;margin-top:2px;flex-shrink:0;accent-color:#1976D2}
      .cm-checkrow label{font-size:14px;font-weight:700;color:#222;cursor:pointer;flex:1}
      .cm-sig-wrap{border:2px dashed #1976D2;border-radius:10px;background:#fafafa;position:relative}
      .cm-sig-canvas{display:block;width:100%;height:180px;cursor:crosshair;touch-action:none}
      .cm-sig-hint{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#bbb;font-size:14px;pointer-events:none}
      .cm-sig-actions{display:flex;gap:8px;margin-top:8px;justify-content:flex-end}
      .cm-sig-clear{background:#fff;color:#E53935;border:1.5px solid #E53935;padding:8px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
      .cm-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.85);color:#fff;padding:12px 20px;border-radius:10px;font-size:14px;z-index:100000;animation:cmToast .3s}
      @keyframes cmToast{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}
      /* 관리자 테이블 */
      .cm-admin-table{width:100%;border-collapse:collapse;font-size:13px}
      .cm-admin-table th{background:#1976D2;color:#fff;padding:10px;text-align:left;font-weight:700;position:sticky;top:0}
      .cm-admin-table td{padding:10px;border-bottom:1px solid #eee}
      .cm-admin-table tr:hover{background:#f9f9f9}
      .cm-sig-thumb{width:80px;height:36px;border:1px solid #ddd;border-radius:4px;cursor:pointer;background:#fff}
    `;
    document.head.appendChild(style);
  }

  // ────────────────────────────────────────────────────────────
  //  토스트
  // ────────────────────────────────────────────────────────────
  function toast(msg){
    var t = document.createElement('div');
    t.className = 'cm-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 2000);
  }

  // ────────────────────────────────────────────────────────────
  //  서명 캔버스
  // ────────────────────────────────────────────────────────────
  function makeSigCanvas(canvas){
    var ctx = canvas.getContext('2d');
    var drawing = false, hasInk = false;
    function resize(){
      var rect = canvas.getBoundingClientRect();
      var dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#222';
    }
    setTimeout(resize, 50);

    function pos(e){
      var rect = canvas.getBoundingClientRect();
      var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      var y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      return {x:x, y:y};
    }
    function start(e){ e.preventDefault(); drawing = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e){ if(!drawing) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasInk = true; var hint = canvas.parentNode.querySelector('.cm-sig-hint'); if(hint) hint.style.display='none'; }
    function end(){ drawing = false; }

    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseup', end);
    canvas.addEventListener('mouseleave', end);
    canvas.addEventListener('touchstart', start, {passive:false});
    canvas.addEventListener('touchmove', move, {passive:false});
    canvas.addEventListener('touchend', end);

    return {
      clear: function(){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
        var hint = canvas.parentNode.querySelector('.cm-sig-hint');
        if(hint) hint.style.display = '';
      },
      isEmpty: function(){ return !hasInk; },
      toDataURL: function(){ return canvas.toDataURL('image/png'); }
    };
  }

  // ────────────────────────────────────────────────────────────
  //  메인 동의 화면
  // ────────────────────────────────────────────────────────────
  function openConsentModal(opts){
    opts = opts || {};
    injectStyles();

    // 이미 로컬에 저장된 동의서가 있는지 확인
    var existing = readLocalConsent();
    if(existing && existing.version === CONSENT_VERSION){
      // 이미 동의함 — 바로 다음 단계
      if(typeof opts.onComplete === 'function') opts.onComplete(existing);
      return;
    }

    var overlay = document.createElement('div');
    overlay.className = 'cm-overlay';
    overlay.innerHTML = `
      <div class="cm-sheet">
        <div class="cm-header">
          <div class="cm-title">📝 응시자 본인 확인 + 개인정보 동의</div>
        </div>
        <div class="cm-body">
          <div class="cm-row">
            <label class="cm-label">이름 (실명) *</label>
            <input id="cm-name" class="cm-input" type="text" placeholder="홍길동" maxlength="30"/>
          </div>
          <div class="cm-row">
            <label class="cm-label">생년월일 앞 6자리 * <span style="font-weight:400;color:#999">(예: 901225)</span></label>
            <input id="cm-birth" class="cm-input" type="tel" inputmode="numeric" placeholder="901225" maxlength="6"/>
          </div>

          <div class="cm-row">
            <label class="cm-label">📋 개인정보 수집·이용 동의서 (개인정보보호법 §15)</label>
            <div class="cm-terms" id="cm-terms-text">
              <b>① 수집 항목</b>
              이름, 생년월일 앞 6자리, 전자서명 이미지, 동의 시각

              <b>② 수집·이용 목적</b>
              · CBT 시험 응시자 본인 식별
              · 시험 결과 관리 및 학습 이력 저장
              · 부정행위 방지 및 분쟁 시 본인 확인 자료

              <b>③ 보유 및 이용기간</b>
              <b style="color:#1976D2">동의일로부터 1년</b> (시험 결과 증빙에 필요한 최소 기간)
              · 만료일 도래 시 시스템에서 <b>자동으로 즉시 파기</b>됩니다 (개인정보보호법 §21)
              · 본인이 삭제 요청 시 보유기간과 무관하게 즉시 파기
              · 회원 탈퇴 시 즉시 파기

              <b>④ 제3자 제공</b>
              없음 (단, 법령상 의무가 있을 경우 제외)

              <b>⑤ 동의 거부 권리</b>
              위 항목 동의를 거부하실 수 있으나, 동의 거부 시 시험 응시가 불가합니다.

              <b>⑥ 책임자</b>
              운영자: (시험 운영자 명)
              연락처: (이메일)
            </div>
          </div>

          <div class="cm-checkrow" onclick="document.getElementById('cm-agree').click()">
            <input type="checkbox" id="cm-agree"/>
            <label for="cm-agree">위 개인정보 수집·이용에 동의합니다 (필수)</label>
          </div>

          <div class="cm-row" style="margin-top:14px">
            <label class="cm-label">✍️ 전자 서명 *</label>
            <div class="cm-sig-wrap">
              <canvas id="cm-sig" class="cm-sig-canvas"></canvas>
              <div class="cm-sig-hint">손가락 또는 마우스로 서명해 주세요</div>
            </div>
            <div class="cm-sig-actions">
              <button type="button" id="cm-sig-clear" class="cm-sig-clear">↻ 다시 서명</button>
            </div>
          </div>
        </div>
        <div class="cm-footer">
          <button class="cm-btn cm-btn-outline" id="cm-cancel">취소</button>
          <button class="cm-btn cm-btn-primary" id="cm-submit">제출하고 시험 시작</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    var sigPad = makeSigCanvas(overlay.querySelector('#cm-sig'));

    overlay.querySelector('#cm-sig-clear').onclick = function(){ sigPad.clear(); };

    overlay.querySelector('#cm-cancel').onclick = function(){
      if(confirm('동의를 취소하면 시험에 응시할 수 없습니다. 정말 취소하시겠습니까?')){
        document.body.removeChild(overlay);
        if(typeof opts.onCancel === 'function') opts.onCancel();
      }
    };

    overlay.querySelector('#cm-submit').onclick = function(){
      var name = overlay.querySelector('#cm-name').value.trim();
      var birth = overlay.querySelector('#cm-birth').value.replace(/[^0-9]/g, '');
      var agreed = overlay.querySelector('#cm-agree').checked;

      if(name.length < 2){ toast('이름을 입력해 주세요'); return; }
      if(birth.length !== 6){ toast('생년월일 앞 6자리를 정확히 입력해 주세요'); return; }
      if(!agreed){ toast('개인정보 수집·이용에 동의해 주세요'); return; }
      if(sigPad.isEmpty()){ toast('전자 서명을 해 주세요'); return; }

      var now = Date.now();
      var expiresAt = now + (RETENTION_DAYS * ONE_DAY_MS);
      var record = {
        name: name,
        birth6: birth,
        userId: birth + '_' + name.replace(/\s/g, ''),    // 식별자
        signatureDataUrl: sigPad.toDataURL(),
        agreedAt: now,
        agreedAtKr: new Date(now).toLocaleString('ko-KR'),
        expiresAt: expiresAt,                              // 보유기간 만료 시각
        expiresAtKr: new Date(expiresAt).toLocaleString('ko-KR'),
        retentionDays: RETENTION_DAYS,
        version: CONSENT_VERSION,
        ua: navigator.userAgent,
        screen: window.screen.width + 'x' + window.screen.height
      };

      // 로컬 저장
      saveLocalConsent(record);

      // Firebase 저장 (있으면)
      if(global.CONSENT_FB){
        try {
          global.CONSENT_FB.ref('cbt_consents/' + record.userId).set(record);
        } catch(e){ console.warn('Firebase 저장 실패:', e); }
      }

      toast('✅ 동의 완료! 시험을 시작합니다.');
      setTimeout(function(){
        if(overlay.parentNode) document.body.removeChild(overlay);
        if(typeof opts.onComplete === 'function') opts.onComplete(record);
      }, 600);
    };
  }

  // ────────────────────────────────────────────────────────────
  //  로컬 저장/로드
  // ────────────────────────────────────────────────────────────
  function saveLocalConsent(record){
    try { localStorage.setItem('cbt_consent_local', JSON.stringify(record)); } catch(e){}
  }
  function readLocalConsent(){
    try { return JSON.parse(localStorage.getItem('cbt_consent_local') || 'null'); } catch(e){ return null; }
  }
  function clearLocalConsent(){
    try { localStorage.removeItem('cbt_consent_local'); } catch(e){}
  }

  // ────────────────────────────────────────────────────────────
  //  보유기간 만료 자동 파기 (개인정보보호법 §21)
  //  - 페이지 진입 시 자동 실행
  //  - localStorage 본인 기록 + Firebase 전체 기록 둘 다 점검
  // ────────────────────────────────────────────────────────────
  function purgeExpiredLocal(){
    try {
      var rec = readLocalConsent();
      if(rec && rec.expiresAt && Date.now() > rec.expiresAt){
        clearLocalConsent();
        console.log('[ConsentModule] 보유기간 만료 — 로컬 동의서 자동 파기됨');
      }
    } catch(e){}
  }

  function purgeExpiredCloud(callback){
    if(!global.CONSENT_FB){ if(callback) callback({purged:0, kept:0}); return; }
    try {
      global.CONSENT_FB.ref('cbt_consents').once('value').then(function(snap){
        var purged = 0, kept = 0, now = Date.now();
        var updates = {};
        snap.forEach(function(c){
          var v = c.val() || {};
          if(v.expiresAt && now > v.expiresAt){
            updates[c.key] = null;   // Firebase 키 삭제
            purged++;
          } else {
            kept++;
          }
        });
        if(purged > 0){
          global.CONSENT_FB.ref('cbt_consents').update(updates).then(function(){
            console.log('[ConsentModule] Firebase 만료 동의서 ' + purged + '건 자동 파기');
            if(callback) callback({purged:purged, kept:kept});
          });
        } else {
          if(callback) callback({purged:0, kept:kept});
        }
      });
    } catch(e){ if(callback) callback({purged:0, kept:0, error:e}); }
  }

  // 페이지 로드 시 자동 실행
  purgeExpiredLocal();
  if(global.CONSENT_FB){ purgeExpiredCloud(); }
  // 자정마다 한 번 더 (장시간 켜둔 세션 대비)
  setInterval(function(){
    purgeExpiredLocal();
    if(global.CONSENT_FB) purgeExpiredCloud();
  }, 6 * 60 * 60 * 1000);   // 6시간마다

  // ────────────────────────────────────────────────────────────
  //  관리자 조회 화면
  // ────────────────────────────────────────────────────────────
  function openAdminPanel(pw){
    if(pw !== ADMIN_PW_HASH){
      toast('관리자 비밀번호가 올바르지 않습니다');
      return;
    }
    injectStyles();

    var overlay = document.createElement('div');
    overlay.className = 'cm-overlay';
    overlay.innerHTML = `
      <div class="cm-sheet" style="max-width:900px;max-height:90vh">
        <div class="cm-header">
          <div class="cm-title">🔐 관리자 — 동의서 조회</div>
          <span class="cm-close" id="cm-admin-close">✕</span>
        </div>
        <div class="cm-body" id="cm-admin-body">
          <div style="text-align:center;color:#999;padding:40px">⏳ 로드 중...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#cm-admin-close').onclick = function(){
      document.body.removeChild(overlay);
    };

    // Firebase에서 데이터 로드
    if(global.CONSENT_FB){
      global.CONSENT_FB.ref('cbt_consents').once('value').then(function(snap){
        var rows = [];
        snap.forEach(function(c){
          var v = c.val() || {};
          v._id = c.key;
          rows.push(v);
        });
        rows.sort(function(a,b){ return (b.agreedAt||0) - (a.agreedAt||0); });
        renderAdminTable(overlay.querySelector('#cm-admin-body'), rows);
      }).catch(function(e){
        overlay.querySelector('#cm-admin-body').innerHTML = '<div style="color:#E53935;padding:40px;text-align:center">서버 연결 실패: ' + e.message + '</div>';
      });
    } else {
      // 로컬 데이터만
      var local = readLocalConsent();
      var rows = local ? [local] : [];
      renderAdminTable(overlay.querySelector('#cm-admin-body'), rows);
      overlay.querySelector('#cm-admin-body').insertAdjacentHTML('afterbegin',
        '<div style="background:#FFF8E1;border-radius:8px;padding:12px;margin-bottom:14px;font-size:13px;color:#7C5500">⚠️ Firebase 미연결 — 이 기기의 로컬 데이터만 표시됩니다.</div>'
      );
    }
  }

  function renderAdminTable(container, rows){
    if(!rows.length){
      container.innerHTML = '<div style="color:#999;padding:60px;text-align:center"><div style="font-size:48px;margin-bottom:14px">📋</div>아직 동의서가 없습니다</div>';
      return;
    }

    // 사용자별 그룹핑 (점검 시 사람별 모아서 보기)
    var byUser = {};
    rows.forEach(function(r){
      var key = r.userId || (r.birth6 + '_' + r.name);
      if(!byUser[key]) byUser[key] = { name: r.name, birth6: r.birth6, records: [] };
      byUser[key].records.push(r);
    });
    var users = Object.values(byUser).sort(function(a,b){
      var aLatest = Math.max.apply(null, a.records.map(function(x){return x.agreedAt||0;}));
      var bLatest = Math.max.apply(null, b.records.map(function(x){return x.agreedAt||0;}));
      return bLatest - aLatest;
    });

    var now = Date.now();
    var totalRecords = rows.length;
    var expiredCount = rows.filter(function(r){ return r.expiresAt && now > r.expiresAt; }).length;
    var validCount = totalRecords - expiredCount;

    // 검색 + 액션 + 통계
    var html =
      '<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">' +
        '<input id="cm-admin-search" type="text" placeholder="이름·생년월일 검색..." class="cm-input" style="flex:1;min-width:180px;padding:9px 12px;font-size:13px" oninput="ConsentModule._filterAdmin(this.value)"/>' +
        '<button class="cm-btn cm-btn-outline" style="padding:8px 14px;font-size:13px" onclick="ConsentModule.exportCSV()">📥 CSV 다운로드</button>' +
        '<button class="cm-btn cm-btn-danger" style="padding:8px 14px;font-size:13px" onclick="ConsentModule._purgeExpiredNow()">🗑 만료된 ' + expiredCount + '건 즉시 파기</button>' +
      '</div>' +
      '<div style="background:#E3F2FD;border-radius:8px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#0D47A1;line-height:1.7">' +
        '👥 <b>사용자 ' + users.length + '명</b> · 동의서 <b>' + totalRecords + '건</b> ' +
        '(유효 ' + validCount + ' / 만료 ' + expiredCount + ')' +
        '<br>📌 보유기간: <b>' + RETENTION_DAYS + '일 (' + Math.round(RETENTION_DAYS/365*10)/10 + '년)</b> 경과 시 자동 파기 — 개인정보보호법 §21' +
      '</div>' +
      '<div id="cm-admin-list">';

    users.forEach(function(u, idx){
      var latest = u.records.reduce(function(a,b){ return (a.agreedAt||0) > (b.agreedAt||0) ? a : b; });
      var hasExpired = u.records.some(function(r){ return r.expiresAt && now > r.expiresAt; });
      var allSigned = u.records.every(function(r){ return r.signatureDataUrl; });
      var statusBadge = hasExpired
        ? '<span style="background:#E53935;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px">만료포함</span>'
        : '<span style="background:#2E7D32;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px">유효</span>';
      var signedBadge = allSigned
        ? '<span style="background:#1976D2;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px">✓ 서명완료</span>'
        : '<span style="background:#FB8C00;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:6px">⚠ 서명누락</span>';

      html += '<div class="cm-user-block" data-search="' + escapeHtml((u.name||'') + ' ' + (u.birth6||'')).toLowerCase() + '" style="background:#fff;border:1px solid #e0e0e0;border-radius:10px;margin-bottom:10px;overflow:hidden">' +
        '<div onclick="ConsentModule._toggleUser(' + idx + ')" style="display:flex;align-items:center;gap:10px;padding:14px;cursor:pointer;background:#f9f9f9;border-bottom:1px solid #eee">' +
          '<div style="font-size:18px">👤</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:15px;font-weight:800;color:#222">' + escapeHtml(u.name||'') + ' <span style="font-size:13px;color:#666;font-weight:600">(' + escapeHtml(u.birth6||'') + ')</span></div>' +
            '<div style="font-size:11px;color:#888;margin-top:2px">동의 <b>' + u.records.length + '회</b> · 최근: ' + escapeHtml(latest.agreedAtKr || '-') + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px">' + signedBadge + statusBadge + '</div>' +
          '<div id="cm-arrow-' + idx + '" style="font-size:14px;color:#999;width:14px">▾</div>' +
        '</div>' +
        '<div id="cm-user-' + idx + '" style="display:none">' +
          '<table class="cm-admin-table">' +
            '<thead><tr><th>동의 시각</th><th>만료일</th><th>약관버전</th><th>서명</th><th>상태</th></tr></thead>' +
            '<tbody>';

      u.records.sort(function(a,b){ return (b.agreedAt||0) - (a.agreedAt||0); }).forEach(function(r){
        var isExpired = r.expiresAt && now > r.expiresAt;
        var daysLeft = r.expiresAt ? Math.ceil((r.expiresAt - now) / ONE_DAY_MS) : null;
        var statusCell = isExpired
          ? '<span style="color:#E53935;font-weight:700">만료됨</span>'
          : (daysLeft !== null
              ? (daysLeft <= 30
                  ? '<span style="color:#FB8C00;font-weight:700">D-' + daysLeft + '</span>'
                  : '<span style="color:#2E7D32;font-weight:700">D-' + daysLeft + '</span>')
              : '<span style="color:#999">-</span>');
        html += '<tr>' +
          '<td>' + escapeHtml(r.agreedAtKr||'') + '</td>' +
          '<td>' + escapeHtml(r.expiresAtKr||'-') + '</td>' +
          '<td>' + escapeHtml(r.version||'') + '</td>' +
          '<td>' + (r.signatureDataUrl ? '<img class="cm-sig-thumb" src="' + r.signatureDataUrl + '" onclick="window.open(\''+r.signatureDataUrl+'\')"/>' : '<span style="color:#E53935">없음</span>') + '</td>' +
          '<td>' + statusCell + '</td>' +
        '</tr>';
      });

      html += '</tbody></table></div></div>';
    });

    html += '</div>';
    container.innerHTML = html;

    // CSV export 데이터 준비
    global._cmRows = rows;
    global._cmUsers = users;
  }

  function exportCSV(){
    var rows = global._cmRows || [];
    if(!rows.length){ toast('내보낼 데이터가 없습니다'); return; }
    var csv = '﻿이름,생년월일,동의시각,약관버전\r\n';
    rows.forEach(function(r){
      csv += '"' + (r.name||'') + '","' + (r.birth6||'') + '","' + (r.agreedAtKr||'') + '","' + (r.version||'') + '"\r\n';
    });
    var blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'cbt_consents_' + Date.now() + '.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  function escapeHtml(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ────────────────────────────────────────────────────────────
  //  공개 API
  // ────────────────────────────────────────────────────────────
  // 사용자 블록 토글 (점검 시 펼쳐 보기)
  function _toggleUser(idx){
    var el = document.getElementById('cm-user-' + idx);
    var arrow = document.getElementById('cm-arrow-' + idx);
    if(!el) return;
    if(el.style.display === 'none'){ el.style.display = ''; if(arrow) arrow.textContent = '▴'; }
    else { el.style.display = 'none'; if(arrow) arrow.textContent = '▾'; }
  }

  // 검색 필터
  function _filterAdmin(query){
    var q = String(query||'').toLowerCase().trim();
    document.querySelectorAll('.cm-user-block').forEach(function(el){
      var key = el.getAttribute('data-search') || '';
      el.style.display = (!q || key.indexOf(q) >= 0) ? '' : 'none';
    });
  }

  // 만료 즉시 파기 버튼
  function _purgeExpiredNow(){
    if(!confirm('만료된 동의서를 즉시 파기하시겠습니까?\n(개인정보보호법 §21 — 보유기간 경과 시 즉시 파기 의무)')) return;
    purgeExpiredLocal();
    if(global.CONSENT_FB){
      purgeExpiredCloud(function(res){
        toast('🗑 ' + (res.purged||0) + '건 파기 완료');
        // 패널 새로고침
        var body = document.querySelector('.cm-overlay .cm-body');
        if(body){
          body.innerHTML = '<div style="text-align:center;color:#999;padding:40px">⏳ 새로고침 중...</div>';
          global.CONSENT_FB.ref('cbt_consents').once('value').then(function(snap){
            var rows = [];
            snap.forEach(function(c){ var v = c.val()||{}; v._id = c.key; rows.push(v); });
            renderAdminTable(body, rows);
          });
        }
      });
    } else {
      toast('🗑 로컬 파기 완료');
    }
  }

  global.ConsentModule = {
    start: openConsentModal,
    openAdmin: openAdminPanel,
    getCurrent: readLocalConsent,
    clear: clearLocalConsent,
    exportCSV: exportCSV,
    purgeExpired: function(cb){ purgeExpiredLocal(); if(global.CONSENT_FB) purgeExpiredCloud(cb); },
    _toggleUser: _toggleUser,
    _filterAdmin: _filterAdmin,
    _purgeExpiredNow: _purgeExpiredNow,
    VERSION: CONSENT_VERSION,
    RETENTION_DAYS: RETENTION_DAYS
  };

})(window);
