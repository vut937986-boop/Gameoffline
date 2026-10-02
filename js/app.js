(() => {
  const domCache={};
  const $=id=>domCache[id] || (domCache[id]=document.getElementById(id));
  let toastTimer=0,isResetting=false;
  const {saveKey:STORE_KEY,backupSaveKey:BACKUP_SAVE_KEY,offlineCapSeconds:OFFLINE_CAP,uiSettingsKey:UI_SETTINGS_KEY,saveVersion:SAVE_VERSION,exportVersion:EXPORT_VERSION}=window.NEON_BREW_CONFIG;
  const APP_VERSION='1.0.4',UPDATE_NOTICE_KEY='neon-brew-update-notice-version';
  const saveManager=window.NEON_BREW_SAVE_MANAGER;
  function loadUiSettings(){return saveManager.loadUiSettings(localStorage,UI_SETTINGS_KEY)}
  const uiSettings=loadUiSettings();
  const idleRate = () => Date.now()<(state.stalledUntil||0)?0:state.bots*1.25*(1+(state.prestiges||0)*.05)*(state.robotUnion?1.15:1)*(factionBonus('cyborgs')>=10?1.2:1)*Math.pow(1.35,Math.max(0,state.branches-1));
  const format = n => Math.floor(n).toLocaleString(uiSettings.language==='en'?'en-US':'vi-VN');
  const {recipes,ingredients,factions,customers,weathers,decorItems,tracks,storyEvents}=window.NEON_BREW_CATALOG;
  const migration=window.NEON_BREW_MIGRATION;
  const eventRules=window.NEON_BREW_EVENT_RULES;
  const ingredientPalette = {
    meteor:['espresso','plasma'],
    matcha:['espresso','plasma','boba'],
    mocha:['espresso','plasma','syrup'],
    ramen:['espresso'],
    overclock:['espresso','plasma','syrup'],
    bionic:['espresso','boba']
  };
  function recipeIngredientIds(recipeId){
    const recipe = recipeById(recipeId);
    if (recipe && ingredientPalette[recipe.id]) return ingredientPalette[recipe.id];
    const fallback = [...new Set((recipe?.tags || []).map(tag => ({
      caffeine:'espresso',
      bold:'plasma',
      energy:'boba',
      premium:'syrup'
    }[tag])).filter(Boolean))];
    return fallback.length ? fallback : ['espresso'];
  }
  const initialState = () => window.NEON_BREW_INITIAL_STATE.create(ingredients);
  function freshState(){const value=withShiftDefaults(initialState());value.modernCafeVersion=SAVE_VERSION;value.recipeUnlocks=['meteor'];value.customerVisits={};value.currentCustomerId='mai';return value}
  function withShiftDefaults(value){return migration.withShiftDefaults(value,ingredients)}
  function loadState(){
    return saveManager.load({
      storage:localStorage,
      primaryKey:STORE_KEY,
      backupKey:BACKUP_SAVE_KEY,
      createFreshState:freshState,
      migrate:parsed=>migration.migrate(parsed,{initialState,withShiftDefaults,ingredients,recipes,eventRules,saveVersion:SAVE_VERSION})
    });
  }
  let activeBrew=false, brewTimer=0, savingTimer=0, timerNotice='', audioContext=null,sfxContext=null,audioLoop=null,audioStep=0,activeThreat=null,activeStoryEvent=null,sessionStarted=false,tutorialActive=false,guidedOutside=false,tickTimer=null,interactiveBrew=null,tutorialAutoFinishTimer=0,visitorActors=[],visitorSequence=0,serveAnimationStarted=0,tutorialLine=0,neoReaction='😄',neoMessage='Chào! Mình là NEO 👋',neoCompanionHideTimer=0;
  let state=loadState();
  if(!state.customerVisits||typeof state.customerVisits!=='object'||Array.isArray(state.customerVisits))state.customerVisits={};
  for(const [id,record] of Object.entries(state.customerVisits)){if(!record||typeof record!=='object')delete state.customerVisits[id];else state.customerVisits[id]={visits:Math.max(0,Math.floor(Number(record.visits)||0)),loyalty:Math.max(0,Math.min(100,Number(record.loyalty)||0))}}
  if(!customers.some(customer=>customer.id===state.currentCustomerId))state.currentCustomerId=customers.find(customer=>customer.faction===state.orderFaction)?.id||customers[0]?.id;
  if(state.securityScheduleVersion!==1){state.securityNextAt=Date.now()+securityDelay();state.securityScheduleVersion=1}
  if(!Number.isFinite(state.securityNextAt))state.securityNextAt=Date.now()+securityDelay();
  state.audio=false;
  const now=Date.now();
  const awaySeconds=Math.min(OFFLINE_CAP,Math.max(0,(now-(Number(state.lastSeen)||now))/1000));
  const previousRate=idleRate(),lastSeen=Number(state.lastSeen)||now,matrixRemaining=state.matrixCyclesLeft>0?Math.max(0,state.matrixCycleEnds-lastSeen)+Math.max(0,state.matrixCyclesLeft-1)*eventRules.matrixDuration:0,matrixOffline=Math.min(awaySeconds,matrixRemaining/1000),deliveryOffline=state.weatherId==='acid'?Math.min(awaySeconds,Math.max(0,(state.weatherChangedAt-lastSeen)/1000)):0;
  const offlineGain=Math.floor(awaySeconds*previousRate+matrixOffline*previousRate*2+deliveryOffline*deliveryRate());
  const maintenancePeriods=state.robotUnion&&now>=state.maintenanceDueAt?Math.floor((now-state.maintenanceDueAt)/3600000)+1:0,offlineMaintenance=maintenancePeriods*Math.ceil(state.bots*.5);
  if(maintenancePeriods)state.maintenanceDueAt+=maintenancePeriods*3600000;
  while(state.matrixCyclesLeft>0&&state.matrixCycleEnds<=now){state.matrixCyclesLeft--;if(state.matrixCyclesLeft>0)state.matrixCycleEnds+=eventRules.matrixDuration;else{state.matrixCycleEnds=0;state.matrixNextAt=Math.max(state.matrixNextAt,now+180000)}}
  if(offlineGain>0||offlineMaintenance>0){state.money=Math.max(0,state.money+offlineGain-offlineMaintenance);addLog(`Robot kiếm ₫${format(offlineGain)} và tốn ₫${format(offlineMaintenance)} bảo trì khi bạn vắng mặt.`,'OFFLINE');if(offlineGain>0)window.setTimeout(()=>toast(`Trong lúc bạn vắng mặt, robot đã kiếm ₫${format(offlineGain)}.`),500)}
  if(!state.orderId||!allRecipes().some(recipe=>recipe.id===state.orderId)||!Number.isFinite(state.orderExpires)||state.orderExpires<now){if(Number.isFinite(state.orderExpires)&&state.orderExpires<now){state.badOrders++;state.reputation=Math.max(0,state.reputation-1);state.reviewScore=Math.max(0,state.reviewScore-20);state.starRating=Math.max(0,state.starRating-1);if(state.starRating<1){state.inspectionActive=true;state.inspectionProgress=Math.max(state.inspectionProgress,15000);if(!state.gameOver){triggerGameOver('Dưới 1 sao. Kiểm tra thực phẩm và quán bị đóng cửa.');}}}newOrder(false)}
  function saveUiSettings(){saveManager.saveUiSettings(uiSettings,localStorage,UI_SETTINGS_KEY)}
  function vibrate(pattern){if('vibrate' in navigator){navigator.vibrate(pattern)}}
  function updateResponsiveMode(){
    const isPhoneLayout = window.matchMedia('(max-width: 820px)').matches || window.innerWidth <= 820;
    document.body.classList.toggle('phone-mode', isPhoneLayout);
  }
  const responsiveMedia = window.matchMedia('(max-width: 820px)');
  if (responsiveMedia.addEventListener) responsiveMedia.addEventListener('change', updateResponsiveMode);
  else if (responsiveMedia.addListener) responsiveMedia.addListener(updateResponsiveMode);
  window.addEventListener('resize', updateResponsiveMode);
  window.addEventListener('orientationchange', updateResponsiveMode);
  updateResponsiveMode();
  function updateConnectionStatus(){const offline=!navigator.onLine;document.body.classList.toggle('offline',offline);document.body.classList.toggle('online',!offline);const status=$('saveStatus');if(status){status.textContent=offline?'OFFLINE · CACHE LOCAL':`ĐÃ LƯU · ${clockText()}`;}} 
  function syncIntroLanguagePicker(){const select=$('introLanguageSelect'),label=$('introLanguageValue'),menu=$('introLanguageMenu');if(!select||!label||!menu)return;label.textContent=select.value.toUpperCase();menu.querySelectorAll('[data-language]').forEach(option=>{const selected=option.dataset.language===select.value;option.setAttribute('aria-selected',String(selected));option.classList.toggle('is-selected',selected)})}
  function setupIntroLanguagePicker(){const picker=$('introLanguagePicker'),button=$('introLanguageButton'),menu=$('introLanguageMenu'),select=$('introLanguageSelect');if(!picker||!button||!menu||!select)return;const options=()=>[...menu.querySelectorAll('[data-language]')],closeMenu=focusButton=>{menu.hidden=true;button.setAttribute('aria-expanded','false');if(focusButton)button.focus()};button.addEventListener('click',()=>{const opening=menu.hidden;menu.hidden=!opening;button.setAttribute('aria-expanded',String(opening));if(opening){const selected=options().find(option=>option.dataset.language===select.value);(selected||options()[0])?.focus()}});menu.addEventListener('click',event=>{const option=event.target.closest('[data-language]');if(!option)return;select.value=option.dataset.language;select.dispatchEvent(new Event('change',{bubbles:true}));closeMenu(true)});menu.addEventListener('keydown',event=>{const items=options(),index=items.indexOf(document.activeElement);if(event.key==='Escape'){event.preventDefault();closeMenu(true);return}if(event.key!=='ArrowDown'&&event.key!=='ArrowUp'&&event.key!=='Home'&&event.key!=='End')return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus()});document.addEventListener('click',event=>{if(!picker.contains(event.target))closeMenu(false)});syncIntroLanguagePicker()}
  setupIntroLanguagePicker();
  function applyUiSettings(){document.body.dataset.theme=uiSettings.theme;$('themeSelect').value=uiSettings.theme;$('languageSelect').value=uiSettings.language;if($('introLanguageSelect'))$('introLanguageSelect').value=uiSettings.language;syncIntroLanguagePicker();$('creatorCopyVi').hidden=uiSettings.language==='en';$('creatorCopyEn').hidden=uiSettings.language!=='en';$('creatorProjectVi').hidden=uiSettings.language==='en';$('creatorProjectEn').hidden=uiSettings.language!=='en';window.NEON_BREW_I18N.apply(uiSettings.language)}
  function setupUpdateNotice(){const dialog=$('updateNotice'),close=$('updateNoticeClose'),acknowledge=$('updateNoticeAcknowledge'),shell=$('gameShell');document.querySelectorAll('.app-version').forEach(label=>{label.textContent=`PHIÊN BẢN ${APP_VERSION}`});let returnFocus=$('introEnter');const hide=()=>{dialog.hidden=true;shell.inert=!sessionStarted;if(sessionStarted)shell.removeAttribute('aria-hidden');else shell.setAttribute('aria-hidden','true');try{localStorage.setItem(UPDATE_NOTICE_KEY,APP_VERSION)}catch{}if(returnFocus?.isConnected)returnFocus.focus()};const show=event=>{if(event)returnFocus=event.currentTarget;dialog.hidden=false;shell.inert=true;shell.setAttribute('aria-hidden','true');close.focus()};document.querySelectorAll('[data-open-update-notice]').forEach(control=>control.addEventListener('click',show));$('gameUpdateBannerDismiss').addEventListener('click',()=>$('gameUpdateBanner').hidden=true);close.addEventListener('click',hide);acknowledge.addEventListener('click',hide);dialog.addEventListener('click',event=>{if(event.target===dialog)hide()});dialog.addEventListener('keydown',event=>{if(event.key==='Escape')hide()});let seenVersion='';try{seenVersion=localStorage.getItem(UPDATE_NOTICE_KEY)||''}catch{}if(seenVersion!==APP_VERSION)show()}
  setupUpdateNotice();
  function addCreatorProjectCard(){const card=document.createElement('section');card.className='creator-project-card';card.setAttribute('aria-label','Logo và giới thiệu game NEON BREW');card.innerHTML='<div class="creator-project-logo" aria-hidden="true"><span class="creator-project-mark">☕</span><span class="creator-project-word"><b>NEON</b><strong>BREW</strong></span></div><div class="creator-project-copy"><span class="creator-project-label">DỰ ÁN GAME · NEO-SAIGON 2089</span><p id="creatorProjectVi" lang="vi">NEON BREW là game quản lý quán cà phê tương lai: nhận đơn, tự tay pha chế, khám phá công thức, thuê robot và mở rộng cửa hàng.</p><p id="creatorProjectEn" lang="en" hidden>NEON BREW is a futuristic café management game: serve orders, craft drinks, discover recipes, hire robots, and grow your shop.</p></div>';$('creatorCopyVi').before(card)}
  function toggleFullscreen(){const target=document.documentElement;if(!document.fullscreenElement){if(target.requestFullscreen)target.requestFullscreen().catch(()=>{});return}if(document.exitFullscreen)document.exitFullscreen();}
  $('confirmReset').addEventListener('click',()=>{isResetting=true});
  function orderBonus(){return 1200}
  function allRecipes(){return [...recipes,...state.unlockedRecipes]}
  function recipeById(id){return allRecipes().find(recipe=>recipe.id===id)||recipes[0]}
  function customerById(id){return customers.find(customer=>customer.id===id)||null}
  function availableCustomers(){const available=customers.filter(customer=>(Number(customer.unlockLevel)||1)<=state.level);return available.length?available:customers.slice(0,1)}
  function getIndividualCustomerLoyalty(id=state.currentCustomerId){return Math.max(0,Math.min(100,Number(state.customerVisits?.[id]?.loyalty)||0))}
  function recipeIsUnlocked(recipe){return state.unlockedRecipes.some(item=>item.id===recipe.id)||state.recipeUnlocks.includes(recipe.id)||(Number(recipe.unlockLevel)||1)<=state.level}
  function availableRecipes(){return allRecipes().filter(recipeIsUnlocked)}
  function xpForNextLevel(level=state.level){return Math.max(35,Math.floor(level*35))}
  function advanceXpProgression(){
    const unlocked=[];
    while(state.xp>=xpForNextLevel()){
      state.level++;
      for(const recipe of recipes){if((Number(recipe.unlockLevel)||1)<=state.level&&!state.recipeUnlocks.includes(recipe.id)){state.recipeUnlocks.push(recipe.id);unlocked.push(recipe.name)}}
    }
    if(unlocked.length){const names=[...new Set(unlocked)].join(', ');addLog(`Lên cấp ${state.level} · mở công thức ${names}.`,'Lên cấp');toast(`LEVEL ${state.level} · Mở ${names}`)}
  }
  function comboBonusPercent(combo=state.combo){const value=Math.max(0,Number(combo)||0);return value>=10?20:value>=5?12:value>=4?8:value>=3?5:value>=2?3:0}
  function customerLikes(recipe,factionId=state.orderFaction){const customer=customerById(state.currentCustomerId);if(customer?.favoriteDrink===recipe.id)return true;const faction=factions.find(item=>item.id===factionId);if(!faction)return false;if(faction.want==='premium')return recipe.price>=40000||recipe.legendary;return (recipe.tags||[]).includes(faction.want)}
  function factionBonus(id=state.orderFaction){return Number(state.factionRep[id])||0}
  function shopMultiplier(){return 1+state.prestiges*.05}
  function researchChance(){return Math.min(.9,.65+(factionBonus('hackers')>=25?.15:0))}
  function orderReward(){const recipe=recipeById(state.orderId),customer=customerById(state.currentCustomerId),liked=customerLikes(recipe);let value=recipe.price*(Number(customer?.rewardModifier)||1);if(state.orderSpec.size==='L')value*=1.25;if(state.orderSpec.topping==='boba')value+=4000;if(state.orderVip)value*=1.15;if(liked)value*=1.08;return Math.round(value*shopMultiplier()*moneyMultiplier()+orderBonus())}
  function getCustomerLoyalty(factionId=state.orderFaction){const safeId=factionId||'hackers';const baseLoyalty={hackers:0,samurai:0,corporate:0,cyborgs:0};if(!state.customerLoyalty)state.customerLoyalty={...baseLoyalty};const loyalty=Number(state.customerLoyalty[safeId]||0);state.customerLoyalty[safeId]=Math.max(0,Math.min(100,loyalty));return state.customerLoyalty[safeId];}
  function qualityBand(quality){const score = Math.max(0, Math.min(100, Number(quality) || 0));if(score >= 90) return 'PERFECT';if(score >= 75) return 'GOOD';if(score >= 60) return 'OK';if(score >= 40) return 'RISKY';return 'BAD';}
  function tipRateFromQuality(quality){const score = Math.max(0, Math.min(100, Number(quality) || 0));if(score >= 90) return 0.18;if(score >= 75) return 0.12;if(score >= 60) return 0.08;return 0;}
  function preferenceAccuracy(actual, target){
    const difference=Math.abs(Number(actual)-Number(target));
    if(difference<=5)return 100;
    if(difference<=10)return 90;
    if(difference<=20)return 75;
    return 40;
  }
  function calculateOrderQualityBreakdown(correct, liked, vip, prep, recipe, brewAccuracy){
    const spec = state.orderSpec || {};
    const recipeScore = correct ? 100 : 0;
    const sizeScore = String(prep?.size || 'M') === String(spec.size || 'M') ? 100 : 40;
    const sugarScore = preferenceAccuracy(prep?.sugar ?? 50, spec.sugar ?? 50);
    const iceScore = preferenceAccuracy(prep?.ice ?? 50, spec.ice ?? 50);
    const toppingScore = String(prep?.topping || 'none') === String(spec.topping || 'none') ? 100 : 40;
    const timingScore = Math.max(0,Math.min(100,Math.round((state.orderExpires-Date.now())/Math.max(1,(state.currentOrder?.timeLimit||30)*1000)*100)));
    const brewingScore = Math.max(0,Math.min(100,Math.round(Number(brewAccuracy)||0)));
    const total = Math.round((recipeScore*2+sizeScore+sugarScore+iceScore+toppingScore+brewingScore*2+timingScore)/9);
    return {recipe:recipeScore,size:sizeScore,sugar:sugarScore,ice:iceScore,topping:toppingScore,preference:liked?100:70,vip:vip?100:80,timing:timingScore,brewing:brewingScore,total};
  }
  function updateCustomerLoyalty(quality, correct, liked, factionId=state.orderFaction){
    const safeId = factionId || 'hackers';
    if(!state.customerLoyalty)state.customerLoyalty={hackers:0,samurai:0,corporate:0,cyborgs:0};
    if(!state.customerVisits)state.customerVisits={};
    const current = Number(state.customerLoyalty[safeId] || 0);
    const customerId=state.currentCustomerId;
    const customerRecord=state.customerVisits[customerId]||{visits:0,loyalty:0};
    if(correct){
      const next = Math.min(100, current + (liked ? 12 : 6) + Math.round(quality / 18));
      state.customerLoyalty[safeId] = next;
      state.customerVisits[customerId]={visits:customerRecord.visits+1,loyalty:Math.min(100,customerRecord.loyalty+(liked?16:10)+Math.round(quality/25))};
      return 1 + (next / 100) * 0.18;
    }
    state.customerLoyalty[safeId] = Math.max(0, current - 7);
    state.customerVisits[customerId]={visits:customerRecord.visits,loyalty:Math.max(0,customerRecord.loyalty-8)};
    return 1;
  }
  function botCost(){return Math.ceil(90*Math.pow(1.82,state.bots))}
  function machineUpgradeCost(){return [100,250,600,1500,4000][state.machineLevel]||0}
  function branchCost(){return Math.ceil(650*Math.pow(2.25,state.branches-1))}
  function firewallCost(){return Math.ceil(350*Math.pow(1.8,state.firewall))}
  function deliveryDroneCost(){return Math.ceil(320*Math.pow(1.8,state.deliveryDrone))}
  function deliveryRate(){
    if(!state.deliveryDrone || !state.deliveryActive || state.weatherId !== 'acid') return 0;
    const baseRate = 18 + state.deliveryDrone * 12 + Math.max(0, state.bots - 1) * 4;
    return Math.round(baseRate * (1 + Math.min(0.75, state.prestiges * 0.08)));
  }
  function securityDelay(){return 120000}
  function moneyMultiplier(){return state.matrixCyclesLeft>0?3:1}
  function addLog(message,label='Pha chế'){state.log.unshift({message,label,time:clockText()});state.log=state.log.slice(0,5)}
  function addLoreFragment(fragment){
    if(!fragment)return;
    state.loreFragments = [...new Set([...(state.loreFragments||[]), fragment])].slice(-5);
    addLog(fragment,'Bí mật quán');
  }
  function applyParanoia(delta){
    state.paranoia = Math.max(0, Math.min(100, Number(state.paranoia || 0) + delta));
    if(state.paranoia >= 100 && !state.gameOver){
      state.gameOver = true;
      state.inspectionActive = false;
      $('gameOverTitle').textContent = 'CỬA QUÁN ĐÃ MỞ';
      $('gameOverText').textContent = 'Đêm đã quá sâu. Những cái tên không tên đã ở quá gần. Quán bị khóa lại bởi thứ không bao giờ dậy sớm.';
      $('gameOverDialog').hidden = false;
      $('gameOverDialog').classList.add('show');
      toast('Ám ảnh đã tràn ngập quán.');
      save();
    }
  }
  function triggerMysteriousCustomer(){
    const names=['Khách áo trùm đầu','Bóng người ở kính cửa','Cái tên đã bị xóa','Người ở cuối quầy'];
    const requests=['"Sương Đêm Không Tên"','"Nước Ảo Ảnh"','"Cốc Chưa Từng Có"','"Món Vô Danh"'];
    state.ghostOrder={
      name:names[Math.floor(Math.random()*names.length)],
      request:requests[Math.floor(Math.random()*requests.length)],
      expires:Date.now()+22000,
      reward:35
    };
    state.lastHorrorAt=Date.now();
    state.horrorPhase=1;
    applyParanoia(8);
    addLoreFragment('Bạn thấy vết bẩn trên gương: ai đó đã viết lại tên của quán bằng mực cũ.');
    toast('Một bóng người lạ xuất hiện ở cửa kính.');
    addLog('Khách áo trùm đầu xuất hiện lúc nửa đêm, gọi một món không có trong menu.','Khách bí ẩn');
    triggerHallucination();
  }
  function triggerHallucination(){
    state.hallucinationUntil = Date.now() + 22000;
    state.lastHorrorAt = Date.now();
    applyParanoia(14 + Math.min(12, Math.max(0, state.served - 5) * 2));
    addLoreFragment('Một chiếc đồng hồ trên tường đang chạy ngược. Dưới quầy, có dấu vết đã bị phớt lờ suốt thời gian dài.');
    toast('Ánh đèn chớp, bóng người đi qua cửa kính.');
    addLog('Đèn tắt trong nháy mắt. Bóng người thoáng qua cửa kính rồi biến mất.','Ảo giác');
  }
  function triggerRobotWhisper(){
    const whispers=['"Tôi biết tên bạn..."','"Đừng để hắn đứng ở sau quầy."','"Có người đang gọi món trong cái tủ lạnh."','"Mẹ quán đã từng ở đây."'];
    const whisper = whispers[Math.floor(Math.random()*whispers.length)];
    state.robotWhisper = whisper;
    state.lastHorrorAt = Date.now();
    applyParanoia(6);
    addLoreFragment('Robot phục vụ lặp lại một câu không ai từng dạy nó. Nó biết một cái tên mà chưa ai từng nói trước đó.');
    toast('Robot nói vọng lên một câu kỳ lạ.');
    addLog(`Robot nói: “${whisper}”`,'Robot lỗi');
  }
  function starTrustLevel(){const customers=Math.max(1,state.served);const tolerance=Math.max(1,Math.ceil(customers/8));return Math.max(0,5-Math.floor(state.badOrders/tolerance))}
  function updateStarRating(){
    const score = Math.max(0, Math.min(100, Number(state.reviewScore) || 100));
    state.starRating = Math.max(0, Math.min(5, Math.floor(score / 20)));
    if(state.starRating < 1){
      if(!state.inspectionActive){state.inspectionActive=true;toast('Dưới 1 sao — kiểm tra thực phẩm đang tới!');addLog('Danh tiếng thấp dưới 1 sao. Quán chuẩn bị bị kiểm tra.','Kiểm tra');}
      state.inspectionProgress=Math.max(state.inspectionProgress,15000);
      if(!state.gameOver){triggerGameOver('Dưới 1 sao. Kiểm tra thực phẩm và quán bị đóng cửa.');}
    }else{state.inspectionActive=false;state.inspectionProgress=0}
  }
  function triggerGameOver(reason='Kiểm tra thực phẩm thất bại. Quán bị đóng cửa.'){if(state.gameOver)return;state.gameOver=true;state.inspectionActive=false;$('gameOverTitle').textContent='GAME OVER';$('gameOverText').textContent=reason;$('gameOverDialog').hidden=false;$('gameOverDialog').classList.add('show');toast('GAME OVER — kiểm tra thực phẩm thất bại!');save()}
  function startMatrixLoop(){state.matrixCyclesLeft=eventRules.matrixCycles;state.matrixCycleEnds=Date.now()+eventRules.matrixDuration;state.matrixNextAt=Date.now()+180000;document.body.classList.add('matrix-glitch');addLog('Thời gian lặp lại 10 giây · thu nhập nhân 3 trong ba vòng.','Matrix');renderLive();save();toast('Glitch in the Matrix · x3 Credits trong 30 giây!')}
  function showIncident(kind,title,copy,note,timeout,buttons,prompt=''){
    activeThreat={kind,expires:Date.now()+timeout,pay:eventRules.ransom(state.money)};activeStoryEvent=kind.startsWith('story:')?kind.slice(6):null;const box=$('threatDialog'),panel=box.querySelector('.threat-box');$('threatTitle').textContent=title;$('threatCopy').textContent=copy;$('threatNote').textContent=note||'';$('threatNote').hidden=!note;$('threatPrompt').hidden=!prompt;$('threatPrompt').textContent=prompt;$('threatAnswer').hidden=!prompt;$('threatAnswer').value='';panel.classList.toggle('event-story',!prompt);for(const id of ['payThreat','reinstallThreat','hackThreat','acceptUnion','formatRobots','solveThreat','acceptStory','declineStory'])$(id).hidden=!buttons.includes(id);$('threatTimer').textContent=String(Math.ceil(timeout/1000));$('threatDialog').hidden=false;const first=buttons.map(id=>$(id)).find(button=>button&&!button.disabled);if(first)first.focus()
  }
  function closeIncident(){activeThreat=null;activeStoryEvent=null;$('threatDialog').hidden=true;$('threatDialog').querySelector('.threat-box').classList.remove('event-story')}
  function finishIncident(message,label='An ninh'){closeIncident();if(message)$('securityStatus').textContent=message;addLog(message||'Sự cố đã kết thúc.',''+label);render();save()}
  function showStoryEvent(id){if(activeThreat)return;const event=storyEvents[id];if(!event)return;const choices=id==='yakuza'?['acceptStory','declineStory']:['acceptStory','declineStory'];showIncident(`story:${id}`,event.title,event.copy,id==='bulk'?'Hoàn thành 5 món trong 60 giây để nhận ₫500.':id==='arena'?'Buff Cyborg kéo dài 2 phút, đơn Bionic được ưu tiên.':id==='yakuza'?'Yakuza sẽ bảo kê tiệm trong 3 phút.':'',25000,choices)}
  function resolveStoryEvent(accept){const id=activeStoryEvent;if(!id)return;if(accept&&id==='yakuza'){state.yakuzaProtectionUntil=Date.now()+180000;addLog('Yakuza nhận bảo kê khu phố trong 3 phút.','Yakuza');toast('Băng đảng đối thủ sẽ bị Yakuza chặn lại.')}else if(accept&&id==='bulk'){state.bulkOrder={remaining:5,total:5,expires:Date.now()+60000};addLog('Nhận đơn Corporate: phục vụ 5 món trong 60 giây.','Đơn lớn');toast('Đơn hàng lớn đang chạy!')}else if(accept&&id==='arena'){state.arenaBuffUntil=Date.now()+120000;state.orderId='bionic';state.orderFaction='cyborgs';state.orderVip=true;state.orderStarted=Date.now();state.orderExpires=Date.now()+30000;addLog('Đấu sĩ Cyborg gọi Bít Tết Bionic.','Đấu trường');toast('Đơn Cyborg VIP đang chờ!')}else addLog(`Bỏ qua lời mời ${storyEvents[id].title}.`,'Sự kiện');closeIncident();render();save()}
  function advanceBulkOrder(){if(!state.bulkOrder)return;state.bulkOrder.remaining--;if(state.bulkOrder.remaining<=0){const reward=500*moneyMultiplier();state.money+=reward;state.reputation+=5;state.bulkOrder=null;addLog(`Hoàn tất đơn Corporate số lượng lớn · +₫${format(reward)}.`,'Đơn lớn');toast(`Đơn hoàn tất! +₫${format(reward)}.`)}}
  function clockText(){const date=new Date();return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`}
  function dayKey(){return new Date().toISOString().slice(0,10)}
  function save(){saveManager.save(state,{storage:localStorage,primaryKey:STORE_KEY,backupKey:BACKUP_SAVE_KEY,isResetting,onSaved:()=>{$('saveStatus').textContent=navigator.onLine?'ĐÃ LƯU · '+clockText():'OFFLINE · CACHE LOCAL'},onError:()=>$('saveStatus').textContent='KHÔNG THỂ LƯU TRÊN THIẾT BỊ'})}
  function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),2500)}
  function closeShift(){if(activeBrew || interactiveBrew){toast('Đợi pha xong rồi mới tổng kết ca.');return}state.shiftClosed=true;$('shiftSummaryTitle').textContent=`Tổng kết ngày ${state.shift}`;$('shiftSummaryCopy').textContent=`Đã xử lý ${state.shiftOrders} đơn, phục vụ ${state.shiftServed} ly, doanh thu ₫${format(state.shiftRevenue)}. Điểm hài lòng hiện tại: ${Math.round(state.reviewScore)}/100. Kiểm tra kho và chuẩn bị cho ngày tiếp theo.`;$('shiftSummary').hidden=false;$('shiftSummary').classList.add('show');renderRecipes();save()}
  function recordShiftOrder(){state.shiftOrders = Math.max(0, state.shiftOrders + 1);}
  function orderSpecMatchesPrep(prep){const spec=state.orderSpec||{};return prep && spec && String(prep.size)===String(spec.size) && Number(prep.sugar)===Number(spec.sugar) && Number(prep.ice)===Number(spec.ice) && String(prep.topping)===String(spec.topping)}
  function ingredientPrice(item){return Math.ceil(item.cost*(state.dealIngredient===item.id ? .8 : 1))}
  function consumeIngredients(counts){for(const [id,count] of Object.entries(counts)){let remaining=count;const lots=state.inventoryLots[id]||[];for(const lot of lots){const used=Math.min(remaining,lot.quantity);lot.quantity-=used;remaining-=used;if(!remaining)break}state.inventoryLots[id]=lots.filter(lot=>lot.quantity>0);state.inventory[id]=state.inventoryLots[id].reduce((sum,lot)=>sum+lot.quantity,0)}}
  function expireStock(){const spoiled=[];for(const item of ingredients){const lots=state.inventoryLots[item.id]||[],fresh=lots.filter(lot=>state.shift-lot.purchasedShift<item.shelfLife),lost=lots.reduce((sum,lot)=>sum+lot.quantity,0)-fresh.reduce((sum,lot)=>sum+lot.quantity,0);if(lost>0)spoiled.push(`${item.name} ×${lost}`);state.inventoryLots[item.id]=fresh;state.inventory[item.id]=fresh.reduce((sum,lot)=>sum+lot.quantity,0)}if(spoiled.length){addLog(`Đã huỷ nguyên liệu quá hạn: ${spoiled.join(', ')}.`,'Kho');toast(`Đã bỏ nguyên liệu hết hạn: ${spoiled.join(', ')}.`)}}
  function openNextShift(){if(!state.shiftClosed)return;state.shift++;expireStock();state.dealIngredient=ingredients[Math.floor(Math.random()*ingredients.length)].id;state.shiftOrders=0;state.shiftServed=0;state.shiftRevenue=0;state.shiftClosed=false;$('shiftSummary').hidden=true;$('shiftSummary').classList.remove('show');state.lastSeen=Date.now();newOrder(false,true);render();save();toast(`Ngày ${state.shift} bắt đầu. ${ingredients.find(item=>item.id===state.dealIngredient).name} đang giảm 20%.`)}
  function renderOrderPreferences(){const spec=state.orderSpec;$('orderPreferences').textContent=`SIZE ${spec.size} · ĐƯỜNG ${spec.sugar}% · ĐÁ ${spec.ice}% · ${spec.topping==='boba'?'THÊM KEM':'KHÔNG KEM'}`;$('dayNumber').textContent=String(state.shift).padStart(2,'0');$('shiftClock').textContent=`CA SÁNG · ${clockText()}`;for(const button of document.querySelectorAll('[data-buy-ingredient]')){const item=ingredients.find(entry=>entry.id===button.dataset.buyIngredient);if(!item)continue;const cost=ingredientPrice(item),lots=state.inventoryLots[item.id]||[],expiry=lots.length?Math.min(...lots.map(lot=>lot.purchasedShift+item.shelfLife)):null;button.dataset.cost=cost;button.disabled=state.money<cost;button.textContent=`${state.dealIngredient===item.id?'ƯU ĐÃI · ':''}MUA 1 · ₫${format(cost)}`;button.closest('.stock-item').querySelector('.stock-cost').textContent=`₫${format(cost)} / đơn vị${expiry?` · HSD NGÀY ${expiry}`:''}`}}
  function createVisitor(){
    const now=Date.now(),factionId=state.orderFaction||'hackers';
    for(const visitor of visitorActors){if(visitor.phase!=='leaving'){visitor.phase='leaving';visitor.phaseAt=now}}
    const shirts=['#6d9b83','#df9b70','#7398b5','#bd7891','#d0b85e','#8278b7'];
    const hairs=['#49372f','#252b32','#b16e42','#d6bd8a','#593c68','#343f36'];
    const skins=['#f1c9a5','#dca77f','#f4d7bf','#bd8060','#e5b995'];
    visitorActors.push({id:++visitorSequence,factionId,shirt:shirts[Math.floor(Math.random()*shirts.length)],hair:hairs[Math.floor(Math.random()*hairs.length)],skin:skins[Math.floor(Math.random()*skins.length)],bag:Math.random()<.45,cap:Math.random()<.3,fromLeft:Math.random()<.5,target:.48+Math.random()*.1,phase:'arriving',phaseAt:now});
  }
  function getOrderDifficulty(recipeId=state.orderId){
    const recipe = recipeById(recipeId);
    const price = Number(recipe?.price || 0);
    const levelFactor = Math.max(0, Math.min(2, (Number(state.level) || 1) / 10));
    const priceFactor = Math.max(0, Math.min(2, price / 45000));
    const score = levelFactor + priceFactor + (state.totalOrders || 0) * 0.002;
    if(score >= 2.7) return 'elite';
    if(score >= 1.8) return 'hard';
    if(score >= 1.2) return 'normal';
    return 'easy';
  }
  function getOrderTimeLimit(difficulty='normal'){
    const map={easy:35,normal:30,hard:25,elite:20};
    const base = map[difficulty] || 30;
    const machineBonus = 1 + Math.min(0.15, ((Number(state.level)||1)-1) * 0.01 + (Number(state.bots)||0) * 0.004 + (Number(state.machineLevel)||0) * 0.02);
    return Math.max(20, Math.round(base * machineBonus));
  }
  function createCurrentOrder(recipeId=state.orderId, spec=state.orderSpec){
    const recipe=recipeById(recipeId);
    const profile=customerById(state.currentCustomerId),orderRanks={easy:0,normal:1,hard:2,elite:3},difficulty=orderRanks[profile?.difficulty]>=orderRanks[getOrderDifficulty(recipeId)]?profile.difficulty:getOrderDifficulty(recipeId);
    const now=Date.now();
    const timeLimit=getOrderTimeLimit(difficulty);
    const order={
      id:`order-${now}-${state.orderNumber}`,
      recipeId: recipe.id,
      drink: recipe.id,
      name: recipe.name,
      difficulty,
      size: spec?.size || 'M',
      sugar: Number(spec?.sugar ?? 50),
      ice: Number(spec?.ice ?? 50),
      toppings: spec?.topping === 'boba' ? ['boba'] : [],
      timeLimit,
      reward: Math.round((Number(recipe.price)||0) * (spec?.size === 'L' ? 1.25 : 1) * (Number(profile?.rewardModifier)||1) + ((spec?.topping === 'boba') ? 4000 : 0)),
      xpReward: difficulty === 'elite' ? 18 : difficulty === 'hard' ? 14 : difficulty === 'normal' ? 10 : 7,
      customerId: profile?.id||state.orderFaction,
      customerName: profile?.name||(factions.find(item=>item.id===state.orderFaction)||factions[0]).name,
      createdAt: now,
      expiresAt: now + timeLimit * 1000
    };
    return order;
  }
  function newOrder(log=true, forceDifferent=false){
    if(interactiveBrew){interactiveBrew=null;const seq=$('brewSequence');if(seq)seq.hidden=true;}
    const pool=availableRecipes();
    const guestPool=availableCustomers(),guest=guestPool[Math.floor(Math.random()*guestPool.length)]||customers[0];
    state.currentCustomerId=guest.id;state.orderFaction=guest.faction;
    const favorite=pool.find(recipe=>recipe.id===guest.favoriteDrink);
    let nextRecipeId=favorite&&Math.random()<.35?favorite.id:pool[Math.floor(Math.random()*pool.length)].id;
    if(forceDifferent || state.orderId){
      const alternatives=pool.filter(recipe=>recipe.id!==state.orderId && (!forceDifferent || recipe.id!==nextRecipeId));
      if(alternatives.length)nextRecipeId=alternatives[Math.floor(Math.random()*alternatives.length)].id;
    }
    state.orderId=nextRecipeId;
    state.orderVip=guest.type!=='robot'&&Math.random()<.03;state.orderSpec={size:Math.random()<.42?'L':'M',sugar:[0,50,100][Math.floor(Math.random()*3)],ice:[0,50,100][Math.floor(Math.random()*3)],topping:Math.random()<.24?'boba':'none'};
    const now=Date.now();state.currentOrder=createCurrentOrder(nextRecipeId,state.orderSpec);state.currentOrder.customerLoyalty=getIndividualCustomerLoyalty(guest.id);state.currentOrder.dialogue=(state.customerVisits[guest.id]?.visits||0)>=3&&nextRecipeId===guest.favoriteDrink?'NHƯ CŨ NHÉ.':'';state.orderStarted=now;state.orderExpires=now+(state.currentOrder.timeLimit||45)*1000;state.orderShuffleAt=now+15000+Math.random()*20000;state.orderNumber++;createVisitor();renderOrderPreferences();if(sessionStarted&&!tutorialActive)setNeoMessage('😮',`${guest.name} ghé quầy! ${state.currentOrder.dialogue||'Cùng xem bạn ấy muốn gọi món gì nhé.'}`);if(log)addLog(`${guest.name} ghé quầy.`,'Khách mới')
  }
  function renderRecipes(){const grid=$('recipeGrid');grid.innerHTML='';for(const recipe of allRecipes()){const button=document.createElement('button'),locked=!recipeIsUnlocked(recipe),shouldHighlight=Boolean(tutorialActive&&recipe.id===state.orderId);button.className=`recipe-btn${shouldHighlight?' match':''}${locked?' locked':''}`;button.type='button';button.disabled=locked||!!interactiveBrew||activeBrew||state.shiftClosed||Date.now()<state.orderStarted;button.setAttribute('aria-label',locked?`${recipe.name}, mở khóa cấp ${recipe.unlockLevel||1}`:`Pha ${recipe.name}, giá cơ bản ${recipe.price} đồng`);button.innerHTML=`<div class="recipe-top"><span class="recipe-illustration" data-drink="${escapeHtml(recipe.id)}" role="img" aria-label="${escapeHtml(recipe.name)}"><span class="drink-vessel"><span class="drink-foam"></span></span><span class="drink-steam"></span><span class="drink-garnish"></span></span><span class="recipe-price">${locked?`CẤP ${recipe.unlockLevel||1}`:`${recipe.legendary?'×5 ':''}₫${format(recipe.price)}`}</span></div><div class="recipe-name">${escapeHtml(recipe.name)}</div><div class="recipe-note">${escapeHtml(locked?`Mở khóa ở cấp ${recipe.unlockLevel||1}`:recipe.details)}</div>`;button.addEventListener('click',()=>beginInteractiveBrew(recipe.id));grid.appendChild(button)}renderOrderPreferences()}
  function dailyProgress(){return {espresso:Math.min(200,state.daily.espresso),hackers:Math.min(3,state.daily.hackers),seconds:Math.min(900,Math.floor(state.daily.seconds))}}
  function achievementDefinitions(){return [
    {id:'firstBrew',name:'FIRST BREW',description:'Phục vụ ly đầu tiên.',earned:state.served>=1},
    {id:'perfectionist',name:'PERFECTIONIST',description:'Đạt 10 đơn hoàn hảo.',earned:state.perfectOrders>=10},
    {id:'comboMaster',name:'COMBO MASTER',description:'Đạt combo x10.',earned:state.bestCombo>=10},
    {id:'regular',name:'REGULAR',description:'Một khách quay lại 3 lần.',earned:Object.values(state.customerVisits||{}).some(record=>(Number(record?.visits)||0)>=3)},
    {id:'millionaire',name:'CYBER MILLIONAIRE',description:'Tích lũy ₫1.000.000.',earned:state.money>=1000000},
    {id:'recipes',name:'RECIPE MASTER',description:'Mở 3 công thức nghiên cứu.',earned:state.unlockedRecipes.length>=3},
    {id:'rebirth',name:'SECOND LIFE',description:'Chuyển sinh lần đầu.',earned:state.prestiges>0}
  ]}
  function checkBadges(){for(const badge of achievementDefinitions()){if(badge.earned&&!state.badges[badge.id]){state.badges[badge.id]=true;state.chips++;addLog(`Mở khóa ${badge.name} · +1 Quantum Chip.`,'Thành tựu');toast(`${badge.name} · +1 QC`)}}}
  function renderResearchView(){
    $('formulaList').innerHTML=state.unlockedRecipes.length?state.unlockedRecipes.map(recipe=>`<div class="formula-entry"><span>${escapeHtml(recipe.icon||'☕')} ${escapeHtml(recipe.name)}<small>${escapeHtml(recipe.details||recipe.recipe||'')}</small></span><b class="tag-chip">₫${format(recipe.price)}</b></div>`).join(''):'<p class="tipline">Chưa có công thức nghiên cứu. Hãy thử phối nguyên liệu.</p>';
    $('formulaCount').textContent=`${state.unlockedRecipes.length} CÔNG THỨC`;
    $('researchFailureCount').textContent=format(state.researchFailures);$('researchSuccessCount').textContent=format(state.researchSuccesses);$('researchTrialCount').textContent=format(state.researchTrials);$('researchOdds').textContent=`${Math.round(researchChance()*100)}% THÀNH CÔNG`;
    const nextTrial=(Math.floor(state.researchTrials/5)+1)*5,progress=(state.researchTrials%5)/5*100;
    $('researchProgressMeter').style.width=`${progress}%`;$('researchProgressText').textContent=`${nextTrial-state.researchTrials} lần thử đến mốc tiếp theo. Công thức huyền thoại có 8% cơ hội khi thử thành công.`;
    $('ingredientStockLegacy').innerHTML=ingredients.map(item=>{const stock=Number(state.inventory[item.id])||0;return `<div class="stock-item"><div class="stock-top"><span class="stock-name">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</span><span class="stock-amount">${format(stock)}</span></div><div class="progress-meter"><i style="width:${Math.min(100,stock/item.start*100)}%"></i></div></div>`}).join('');
  }
  function renderCityView(){
    const weather=weathers.find(item=>item.id===state.weatherId)||weathers[0];
    $('weatherIcon').textContent=weather.icon;$('weatherName').textContent=weather.name;$('weatherEffect').textContent=weather.effect;
    $('weatherClock').textContent=`ĐỔI SAU ${Math.max(0,Math.ceil((state.weatherChangedAt-Date.now())/1000))}S`;
    $('factionList').innerHTML=factions.map(faction=>{const reputation=Number(state.factionRep[faction.id])||0,loyalty=Number(state.customerLoyalty[faction.id])||0;return `<div class="formula-entry"><span>${escapeHtml(faction.icon)} ${escapeHtml(faction.name)}<small>${escapeHtml(faction.perk)} · ${format(reputation)} uy tín · ${format(loyalty)} loyalty</small></span><b class="tag-chip">${format(reputation)}</b></div>`}).join('');
    const droneCost=Math.ceil(220*Math.pow(1.7,state.drone)),bouncerCost=Math.ceil(280*Math.pow(1.7,state.bouncer)),firewallCostValue=firewallCost(),deliveryCost=deliveryDroneCost();
    $('buyDrone').textContent=`DRONE ${state.drone} · ₫${format(droneCost)}`;$('buyDrone').disabled=state.money<droneCost;
    $('buyBouncer').textContent=`BOUNCER ${state.bouncer} · ₫${format(bouncerCost)}`;$('buyBouncer').disabled=state.money<bouncerCost;
    $('buyFirewall').textContent=state.firewall>=5?'FIREWALL · MAX / 5':`FIREWALL ${state.firewall} · ₫${format(firewallCostValue)}`;$('buyFirewall').disabled=state.firewall>=5||state.money<firewallCostValue;
    if(!$('machineUpgradeButton')){const button=document.createElement('button');button.type='button';button.id='machineUpgradeButton';button.className='action-btn';button.addEventListener('click',buyMachineUpgrade);$('buyFirewall').parentElement.append(button)}
    const machineCost=machineUpgradeCost();$('machineUpgradeButton').disabled=state.machineLevel>=5||state.money<machineCost;$('machineUpgradeButton').textContent=state.machineLevel>=5?'ESPRESSO MACHINE · MAX / 5':`MACHINE LV ${state.machineLevel}/5 · +${(state.machineLevel+1)*10}% SPEED · +${(state.machineLevel+1)*2}% ZONE · ₫${format(machineCost)}`;
    $('buyDeliveryDrone').textContent=`DRONE ${state.deliveryDrone} · ₫${format(deliveryCost)}`;$('buyDeliveryDrone').disabled=state.money<deliveryCost;
    $('securityLevel').textContent=`Drone ${state.drone} · Bouncer ${state.bouncer} · Firewall ${state.firewall}/5. Firewall giảm rủi ro ransomware.`;
    $('decorGrid').innerHTML=decorItems.map(item=>{const owned=!!state.decorations[item.id];return `<div class="decor-item"><div class="decor-name">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</div><div class="decor-desc">${escapeHtml(item.description)}</div><button class="action-btn" data-buy-decor="${escapeHtml(item.id)}" ${owned||state.money<item.cost?'disabled':''}>${owned?'ĐÃ LẮP':`MUA · ₫${format(item.cost)}`}</button></div>`}).join('');
  }
  function renderJukeboxView(){
    $('trackList').innerHTML=tracks.map(track=>{const owned=state.tracks.includes(track.id),selected=state.trackId===track.id;return `<div class="track-item"><div class="track-name">${escapeHtml(track.name)}</div><div class="track-desc">${escapeHtml(track.style)}</div><button class="action-btn" data-track="${escapeHtml(track.id)}" ${!owned&&state.money<track.cost?'disabled':''}>${selected?'ĐANG PHÁT':owned?'PHÁT ĐĨA':`MUA · ₫${format(track.cost)}`}</button></div>`}).join('');
    const track=tracks.find(item=>item.id===state.trackId)||tracks[0];$('jukeboxTrackName').textContent=track.name;$('jukeboxTrackDesc').textContent=`${track.style} · NEO-SAIGON`;
  }
  function renderArchiveView(){
    let profile=$('profileStats');
    if(!profile){profile=document.createElement('section');profile.className='feature-panel profile-stats-panel';profile.id='profileStats';profile.innerHTML='<div class="panel-heading"><h2>HỒ SƠ BARISTA</h2><span class="mono">THỐNG KÊ</span></div><div class="feature-body profile-stat-list"><div><span>TỔNG ORDER</span><strong id="profileOrders"></strong></div><div><span>PERFECT</span><strong id="profilePerfect"></strong></div><div><span>FAILED</span><strong id="profileFailed"></strong></div><div><span>BEST COMBO</span><strong id="profileBestCombo"></strong></div><div><span>TỔNG THU NHẬP</span><strong id="profileEarnings"></strong></div><div><span>KHÁCH QUEN</span><strong id="profileCustomers"></strong></div><div><span>CÔNG THỨC</span><strong id="profileRecipes"></strong></div></div>';const firstSplit=$('view-archive').querySelector('.archive-split');firstSplit.before(profile)}
    $('profileOrders').textContent=format(Math.max(Number(state.totalOrders)||0,Number(state.statistics?.orders)||0));$('profilePerfect').textContent=format(state.perfectOrders);$('profileFailed').textContent=format(state.failedOrders);$('profileBestCombo').textContent=`x${format(state.bestCombo)}`;$('profileEarnings').textContent=`₫${format(state.lifetimeEarned||0)}`;$('profileCustomers').textContent=format(Object.keys(state.customerVisits||{}).filter(id=>customers.some(customer=>customer.id===id)).length);$('profileRecipes').textContent=`${availableRecipes().length} / ${recipes.length+state.unlockedRecipes.length}`;
    const progress=dailyProgress(),tasks=[['espresso','Pha 200 món có caffeine',progress.espresso,200],['hackers','Xử lý 3 sự cố khu phố',progress.hackers,3],['seconds','Mở quán trong 15 phút',progress.seconds,900]];
    $('dailyDate').textContent=`NGÀY ${state.shift} · ${state.daily.date||dayKey()}`;
    $('questList').innerHTML=tasks.map(([id,label,value,target])=>`<div class="quest-item"><div class="quest-title">${escapeHtml(label)}</div><div class="quest-meta"><span>${format(value)} / ${format(target)}</span></div><div class="quest-meter"><i style="width:${Math.min(100,value/target*100)}%"></i></div></div>`).join('')+`<button class="action-btn" data-action="claim-quest" ${state.daily.rewarded||progress.espresso<200||progress.hackers<3||progress.seconds<900?'disabled':''}>${state.daily.rewarded?'ĐÃ NHẬN · 1 QC':'NHẬN 1 QUANTUM CHIP'}</button>`;
    const badges=achievementDefinitions();$('badgeCount').textContent=`${badges.filter(item=>state.badges[item.id]).length} / ${badges.length}`;
    $('badgeGrid').innerHTML=badges.map(item=>`<div class="badge-item"><div class="badge-title">${escapeHtml(item.name)}</div><div class="badge-desc">${escapeHtml(item.description)}</div><span class="tag-chip">${state.badges[item.id]?'ĐÃ MỞ':'ĐANG KHÓA'}</span></div>`).join('');
    $('prestigeCount').textContent=`${format(state.prestiges)} LẦN TÁI SINH`;$('chipBalance').textContent=`◇ ${format(state.chips)} QC`;
    $('prestigeButton').disabled=state.served<200||state.chips<1;$('prestigeButton').textContent=`CHUYỂN SINH · ${format(state.served)}/200 LY · ${format(state.chips)}/1 QC`;
    $('prestigeInfo').textContent=`Mỗi lần chuyển sinh tiêu thụ 1 QC và tăng doanh thu vĩnh viễn 5%. Cần 200 ly đã phục vụ.`;
    $('crtToggle').textContent=`CRT: ${state.crt?'BẬT':'TẮT'}`;$('crtToggle').setAttribute('aria-pressed',String(!!state.crt));
  }
  function storeMilestones(){
    return [
      {id:'starter',level:1,title:'Quầy nhỏ',summary:'Một quán nhỏ vừa mở cửa.',visual:'small'},
      {id:'neon',level:2,title:'Neon sign',summary:'Đèn sáng lên và quán bắt đầu nổi bật.',visual:'neon'},
      {id:'machine',level:3,title:'Máy pha mới',summary:'Phục vụ trơn tru hơn.',visual:'machine'},
      {id:'tables',level:5,title:'Bàn ngoài trời',summary:'Khách có chỗ ngồi chờ.',visual:'tables'},
      {id:'delivery',level:7,title:'Drone giao hàng',summary:'Quán bắt đầu kết nối với phố.',visual:'delivery'},
      {id:'secondFloor',level:10,title:'Tầng 2',summary:'Thêm không gian và khách mới.',visual:'secondFloor'},
      {id:'rooftop',level:15,title:'Rooftop',summary:'Mở không gian view đẹp.',visual:'rooftop'},
      {id:'robot',level:20,title:'Robot barista',summary:'Quán hiện đại và tự động hơn.',visual:'robot'},
      {id:'mega',level:30,title:'Mega cafe',summary:'Đế chế cà phê của bạn thành hình.',visual:'mega'}
    ];
  }
  function ensureStoreViewStructure(){
    const shopView=document.getElementById('view-shop');
    if(!shopView || shopView.dataset.ready==='true')return;
    const milestones=storeMilestones();
    const level=Number(state.level)||1;
    const unlocked=milestones.filter(item=>level>=item.level);
    const current=unlocked[unlocked.length-1]||milestones[0];
    const next=milestones.find(item=>level<item.level)||milestones[0];
    const nextName = next.title;
    shopView.innerHTML=`
      <div class="view-heading"><div><div class="eyebrow">◆ CỬA HÀNG · XÂY DỰNG</div><h2>NEON BREW</h2><p>Store Exterior, development, upgrades và visual progression.</p></div><span class="tag-chip" id="shopLevelBadge">STORE LV ${String(level).padStart(2,'0')}</span></div>
      <div class="shop-preview-shell" id="shopPreviewShell">
        <div class="shop-visual-panel">
          <div class="shop-header-row"><span>QUÁN BÊN NGOÀI</span><span id="shopLevelText">STORE LV ${String(level).padStart(2,'0')}</span></div>
          <div class="store-exterior-scene" id="storeExteriorScene" data-tier="${current.visual||'small'}">
            <div class="store-sky"></div>
            <div class="store-sign">NEON BREW</div>
            <div class="store-window"></div>
            <div class="store-counter"></div>
            <div class="store-door"></div>
            <div class="store-tables"></div>
            <div class="store-drone"></div>
            <div class="store-second-floor"></div>
            <div class="store-rooftop"></div>
            <div class="store-robot"></div>
          </div>
          <div class="store-exterior-status">
            <div class="store-status-heading"><span class="status-badge" id="storeExteriorTitle">${current.title.toUpperCase()}</span><span class="status-progress" id="storeExteriorProgress">${unlocked.length} / ${milestones.length}</span></div>
            <div class="store-progress-line"><i id="storeExteriorMeter" style="width:${Math.min(100,Math.round((unlocked.length/milestones.length)*100))}%"></i></div>
            <div class="store-feature-list" id="storeFeatureList"><span>${unlocked.slice(-4).map(item=>item.title).join('</span><span>')}</span>${next ? '<span class="next-feature">NEXT: '+nextName+'</span>' : ''}</div>
          </div>
        </div>
        <div class="shop-action-row">
          <button class="action-btn primary" type="button" data-shop-action="open">MỞ CỬA HÀNG</button>
          <button class="action-btn" type="button" data-shop-action="back">QUAY LẠI</button>
        </div>
      </div>
      <div class="shop-detail-panel" id="shopDetailPanel" hidden>
        <div class="shop-layout">
          <div class="shop-info-panel">
            <div class="feature-panel"><div class="panel-heading"><h2>Phát triển</h2><span class="mono">MILESTONE</span></div><div class="feature-body"><div class="milestone-list" id="shopMilestoneList">${milestones.map(item=>`<div class="milestone-item ${level>=item.level?'unlocked':'locked'}"><span>${level>=item.level?'✓':'•'}</span><div><strong>${item.title}</strong><small>${item.summary}</small></div></div>`).join('')}</div></div></div>
            <div class="feature-panel"><div class="panel-heading"><h2>Nâng cấp</h2><span class="mono">UPGRADES</span></div><div class="feature-body"><div class="upgrade-list" id="shopUpgradeList"><div class="upgrade-card"><h3>NEON SIGN</h3><p>+10% khách, biển neon rõ ràng.</p><button class="action-btn" type="button">XEM TRƯỚC</button></div><div class="upgrade-card"><h3>SECOND FLOOR</h3><p>Thêm tầng mới cho cửa hàng.</p><button class="action-btn" type="button">XEM TRƯỚC</button></div></div></div></div>
          </div>
        </div>
        <div class="shop-action-row shop-detail-actions">
          <button class="action-btn primary" type="button" data-shop-action="back">QUAY LẠI</button>
        </div>
      </div>
    `;
    shopView.dataset.ready='true';
    shopView.dataset.previewOpen='false';
    const previewShell=document.getElementById('shopPreviewShell');
    const detailPanel=document.getElementById('shopDetailPanel');
    if(previewShell&&detailPanel){previewShell.hidden=false;detailPanel.hidden=true;}
  }
  function renderStoreExterior(){
    ensureStoreViewStructure();
    const shopView=document.getElementById('view-shop');
    const previewShell=document.getElementById('shopPreviewShell');
    const detailPanel=document.getElementById('shopDetailPanel');
    const showDetail = shopView && shopView.dataset.previewOpen === 'true';
    if (previewShell) previewShell.hidden = showDetail;
    if (detailPanel) detailPanel.hidden = !showDetail;
    const milestones=storeMilestones();
    const level=Number(state.level)||1;
    const unlocked=milestones.filter(item=>level>=item.level);
    const current=unlocked[unlocked.length-1]||milestones[0];
    const next=milestones.find(item=>level<item.level)||null;
    const scene=document.getElementById('storeExteriorScene');
    const progress=document.getElementById('storeExteriorProgress');
    const meter=document.getElementById('storeExteriorMeter');
    const title=document.getElementById('storeExteriorTitle');
    const levelBadge=document.getElementById('shopLevelBadge');
    const levelText=document.getElementById('shopLevelText');
    const featureList=document.getElementById('storeFeatureList');
    if(scene)scene.dataset.tier=current.visual||'small';
    const percent=Math.min(100,Math.round((unlocked.length/milestones.length)*100));
    if(progress)progress.textContent=`${unlocked.length} / ${milestones.length}`;
    if(meter)meter.style.width=`${percent}%`;
    if(title)title.textContent=current.title.toUpperCase();
    if(levelBadge)levelBadge.textContent=`STORE LV ${String(level).padStart(2,'0')}`;
    if(levelText)levelText.textContent=`STORE LV ${String(level).padStart(2,'0')}`;
    const features = unlocked.slice(-4).map(item=>item.title);
    if(featureList){featureList.innerHTML = features.length ? features.map(item=>`<span>${item}</span>`).join('') : '<span>Quầy mới mở</span>';
      if(next){featureList.innerHTML += `<span class="next-feature">NEXT: ${next.title}</span>`;}}
  }
  function renderFeatureViews(){
    const researchSelects=[$('ingredientA'),$('ingredientB'),$('ingredientC')];
    researchSelects.forEach((select,index)=>{
      if(!select.options.length){select.innerHTML=ingredients.map(item=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.icon)} ${escapeHtml(item.name)}</option>`).join('');select.value=ingredients[index%ingredients.length]?.id||''}
      for(const option of select.options)option.disabled=(Number(state.inventory[option.value])||0)<1;
    });
    renderResearchView();renderCityView();renderJukeboxView();renderArchiveView();
    renderStoreExterior();
    const rate = deliveryRate();
    const rateElement = $('deliveryRate');
    const statusElement = $('deliveryStatus');
    const toggleButton = $('toggleDelivery');
    if (rateElement) rateElement.textContent = state.deliveryDrone ? `+₫${format(rate)} / GIÂY` : '+₫0 / GIÂY';
    if (statusElement) {
      if (!state.deliveryDrone) statusElement.textContent = 'Mua drone để mở đội giao hàng tận nơi.';
      else if (!state.deliveryActive) statusElement.textContent = state.weatherId === 'acid' ? 'Đội giao hàng đang chờ lệnh. Kích hoạt để vận chuyển đồ uống trong bão axit.' : 'Đội drone chỉ hoạt động khi thời tiết Axit đang làm quán bão dậy.';
      else statusElement.textContent = `Đội drone đang bốc hàng • +₫${format(rate)} / giây trong thời tiết Axit.`;
    }
    if (toggleButton) {
      toggleButton.disabled = !state.deliveryDrone || state.weatherId !== 'acid';
      toggleButton.textContent = state.deliveryActive ? 'TẮT ĐỘI BAY' : 'KÍCH HOẠT ĐỘI BAY';
    }
    $('ingredientStock').innerHTML=ingredients.map(item=>{const cost=ingredientPrice(item),stock=state.inventory[item.id]||0;return `<div class="stock-item"><div class="stock-top"><span class="stock-name">${item.icon} ${item.name}</span><span class="stock-amount">×${format(stock)}</span></div><div class="stock-cost">₫${format(cost)} / đơn vị · dùng trong ${item.shelfLife} ngày</div><button class="action-btn" data-cost="${cost}" data-buy-ingredient="${item.id}" ${state.money<cost?'disabled':''}>MUA 1 · ₫${format(cost)}</button></div>`}).join('');
  }
  function updateCafeStatus(){
    const status=$('sceneStatus');
    if(!status)return;
    const now=Date.now();
    let label='QUẦY PHA CHẾ · ĐANG MỞ';
    if(state.shiftClosed){label='QUẦY PHA CHẾ · ĐÃ ĐÓNG CA';}
    else if(activeBrew){label='QUẦY PHA CHẾ · ĐANG PHA';}
    else if(now>=state.orderExpires){label='QUẦY PHA CHẾ · KHÁCH HẾT GIỜ';}
    else if(now-state.orderStarted<3000){label='QUẦY PHA CHẾ · KHÁCH MỚI';}
    status.innerHTML=`<i class="live-dot"></i>${label}`;
  }
  function renderHudCommon(){
    updateConnectionStatus();
    ensureProgressHudUI();
    $('progressXpValue').textContent=format(state.xp);
    $('progressLevelValue').textContent=`LEVEL ${state.level} · ${format(state.xp)} / ${format(xpForNextLevel())} XP`;
    $('progressComboValue').textContent=`x${Math.max(0,Number(state.combo)||0)}`;
    $('progressComboBonus').textContent=`+${comboBonusPercent()}% REWARD`;
    $('moneyValue').textContent='₫ '+format(state.money);$('servedValue').textContent=format(state.served);const stars=window.NEON_BREW_RENDER.stars(state.starRating);$('repValue').innerHTML=`${Math.round(state.reviewScore)} <small>/ 100</small><div class="star-row">${stars}</div>`;$('repTrend').textContent='MỨC HÀI LÒNG';$('shiftOrderValue').textContent=`${state.shiftOrders}`;$('shiftServedValue').textContent=`${state.shiftServed} ly`;$('shiftProgressValue').textContent=`${state.shiftOrders}`;$('shiftRevenueValue').textContent=`₫${format(state.shiftRevenue)}`;$('shiftStatus').textContent=state.shiftClosed?'ĐÃ ĐÓNG':'ĐANG MỞ';
    if($('homeMoney'))$('homeMoney').textContent='₫ '+format(state.money);
    if($('homeRep'))$('homeRep').textContent=`${Math.round(state.reviewScore)} / 100`;
    if($('homeServed'))$('homeServed').textContent=format(state.served);
    if($('homeLevel'))$('homeLevel').textContent=`LV ${state.level}`;
    if($('homeGoalText')){$('homeGoalText').textContent=`${Math.min(state.served,10)} / 10`;}
    if($('homeGoalMeter'))$('homeGoalMeter').style.width=`${Math.min(100,(state.served/10)*100)}%`;
    const milestones=storeMilestones();
    const unlocked=milestones.filter(item=>Number(state.level)>=Number(item.level));
    const next=milestones.find(item=>Number(state.level)<Number(item.level))||milestones[milestones.length-1];
    const cafeProgress=Math.min(100,Math.round((unlocked.length/milestones.length)*100));
    if($('homeStoreProgress'))$('homeStoreProgress').textContent=`${unlocked.length} / ${milestones.length}`;
    if($('homeStoreMeter'))$('homeStoreMeter').style.width=`${cafeProgress}%`;
    if($('nextUnlockText'))$('nextUnlockText').textContent=next?next.title:'Đã đạt mốc tối đa';
    if($('cafeLevelBadge'))$('cafeLevelBadge').textContent=`QUÁN LV ${String(state.level).padStart(2,'0')}`;
    if($('cafeLevel'))$('cafeLevel').textContent=`LV ${state.level}`;
    if($('cafeMood'))$('cafeMood').textContent=cafeProgress >= 80 ? 'Rất nổi bật' : cafeProgress >= 50 ? 'Đang phát triển' : 'Mới mở';
    if($('cafeTableText'))$('cafeTableText').textContent=`${Math.max(3,Math.min(12,3 + unlocked.length))} bàn chờ`;
    if($('cafeProgressText'))$('cafeProgressText').textContent=`${unlocked.length} / ${milestones.length}`;
    if($('cafeProgressMeter'))$('cafeProgressMeter').style.width=`${cafeProgress}%`;
    if($('cafeNextGoal'))$('cafeNextGoal').textContent=next?next.title:'Đã đạt mốc tối đa';
    const requested=recipeById(state.orderId),visitor=factions.find(item=>item.id===state.orderFaction)||factions[0],guest=customerById(state.currentCustomerId),guestName=guest?.name||visitor.name,loyalty=getIndividualCustomerLoyalty(),comboValue=Number(state.combo)||0,tip=tipRateFromQuality(Math.max(0,Math.min(100,Number(state.reviewScore)||0))),moveAhead=Math.max(0,Math.min(100,Math.round((state.orderExpires-Date.now())/Math.max(1,(state.orderExpires-state.orderStarted||30000))*100)));$('orderIcon').textContent=guest?.type==='robot'?'🤖':visitor.icon;$('orderName').textContent=requested.name;$('orderRecipe').textContent=`${guestName} · ${visitor.name} · ${requested.recipe}`;$('orderPay').innerHTML=`+₫${format(orderReward())}<small>${customerLikes(requested)?`đúng gu · ${qualityBand(Math.min(95,80+loyalty/2))} · tip ${Math.round(tip*100)}%`:`giá dự kiến · combo x${comboValue} · tip ${Math.round(tip*100)}%`}</small>`;$('orderNumber').textContent=`ĐƠN #${String(state.orderNumber).padStart(3,'0')}`;const brewHint=$('brewHint');if(brewHint){const spec=state.orderSpec||{},targetPrefix=state.currentOrder?.dialogue||(customerLikes(requested)?'HỢP GU':'MỤC TIÊU');brewHint.innerHTML=`<span>${targetPrefix}</span><strong>${guestName.toUpperCase()} · ${requested.name.toUpperCase()} · SIZE ${spec.size||'M'} · ĐƯỜNG ${Number(spec.sugar??50)}% · ĐÁ ${Number(spec.ice??50)}% · LOYALTY ${loyalty}% · ${qualityBand(Math.max(0,60+comboValue*8))} · ${moveAhead}% GIỜ</strong>`;}
    $('factionGuestIcon').textContent=guest?.type==='robot'?'🤖':visitor.icon;$('factionGuestType').textContent=guest?.type?.toUpperCase()||visitor.name.toUpperCase();$('factionGuestName').textContent=guestName;$('factionGuestMood').textContent=`${visitor.name} · ${guest?.favoriteDrink===state.orderId?'MÓN ƯA THÍCH':'ĐANG CHỜ PHỤC VỤ'}`;
    updateCafeStatus();
    $('logList').innerHTML = window.NEON_BREW_RENDER.logHtml(state.log);
    $('levelBadge').textContent=`${Math.round(state.reviewScore)} / 100`;$('nextLevel').textContent='MỨC HÀI LÒNG';$('repCurrent').textContent=`${Math.round(state.reviewScore)} điểm hài lòng`;$('repTarget').textContent='100 điểm';$('repMeter').style.width=`${Math.max(0,Math.min(100,state.reviewScore))}%`;    const comboStatus = Number(state.combo || 0) > 0 ? `🔥 COMBO x${Number(state.combo || 0)}` : 'Hãy pha đúng món khách gọi';
    $('progressText').textContent=state.reviewScore>=80?comboStatus:state.reviewScore>=50?'Cần chăm chút từng đơn':comboStatus;    $('dayNumber').textContent=String(state.shift).padStart(2,'0');$('timeLabel').textContent='· '+clockText();$('sceneClock').textContent=clockText();$('shiftClock').textContent=`CA SÁNG · ${clockText()}`;$('soundLabel').textContent=`NHẠC: ${state.audio?'BẬT':'TẮT'}`;$('soundIcon').textContent=state.audio?'◖':'♫';
  }
  function render(){
    renderHudCommon();
    renderRecipes();
    renderFeatureViews();
    renderStoreExterior();
  }
  function renderLive(){
    renderHudCommon();
    const duration=Math.max(1,state.orderExpires-state.orderStarted),remaining=Math.max(0,(state.orderExpires-Date.now())/1000),left=Math.min(100,remaining/duration*100);$('orderTimer').style.width=left+'%';$('orderTimer').style.background=remaining<=5?'var(--pink)':remaining<=10?'var(--amber)':'var(--mint)';if($('orderTimeText')){$('orderTimeText').textContent=`${remaining.toFixed(1)}s${remaining<=5?' · HẾT GIỜ SẮP TỚI':remaining<=10?' · NHANH LÊN':''}`;$('orderTimeText').classList.toggle('urgent',remaining<=5);$('orderTimeText').classList.toggle('warning',remaining<=10&&remaining>5)}$('weatherClock').textContent=`ĐỔI SAU ${Math.max(0,Math.ceil((state.weatherChangedAt-Date.now())/1000))}S`;
    const secondsQuest=document.querySelector('[data-quest="seconds"]');if(secondsQuest){const seconds=Math.min(900,Math.floor(state.daily.seconds));secondsQuest.querySelector('.quest-meta span:last-child').textContent=`${format(seconds)} / 900` ;secondsQuest.querySelector('.quest-meter i').style.width=`${seconds/900*100}%`}
    for(const button of document.querySelectorAll('[data-cost]'))button.disabled=button.dataset.owned==='true'||state.money<Number(button.dataset.cost);
    const selects=[$('ingredientA'),$('ingredientB'),$('ingredientC')],needed=Object.fromEntries(ingredients.map(item=>[item.id,selects.filter(select=>select.value===item.id).length]));$('researchButton').disabled=state.money<18||Object.entries(needed).some(([id,count])=>(state.inventory[id]||0)<count);
    $('matrixAlert').classList.toggle('active',state.matrixCyclesLeft>0);if(state.matrixCyclesLeft>0){$('matrixTime').textContent=String(Math.max(0,Math.ceil((state.matrixCycleEnds-Date.now())/1000)));$('matrixCycle').textContent=String(eventRules.matrixCycles-state.matrixCyclesLeft+1)}document.body.classList.toggle('matrix-glitch',state.matrixCyclesLeft>0);
    if(activeThreat)$('threatTimer').textContent=String(Math.max(0,Math.ceil((activeThreat.expires-Date.now())/1000)));if(state.bulkOrder){$('bulkOrderAlert').classList.add('active');$('bulkOrderText').textContent=`ĐƠN CORPORATE · ${state.bulkOrder.remaining}/${state.bulkOrder.total} MÓN · CÒN ${Math.max(0,Math.ceil((state.bulkOrder.expires-Date.now())/1000))}S`}else $('bulkOrderAlert').classList.remove('active');
  }
  function normalizeTutorialStep(){state.tutorialStep=Math.max(0,Math.min(2,state.tutorialStep||0))}
  function syncTutorialLock(){
    window.NEON_BREW_TUTORIAL.syncTutorialLock({ tutorialActive, guidedOutside, sessionStarted });
  }
  function tutorialDialogues(){
    const recipe=recipeById(state.orderId);
    return [
      {title:'NEO · LÀM QUEN',reaction:'😄',lines:['Chào! Mình là NEO 👋','Đây là quán cà phê của bạn.','Mình sẽ đồng hành cùng bạn.','Mua một nguyên liệu để mở quầy nhé.'],waiting:'Mình chờ bạn mua một nguyên liệu nhé.',action:'NEO ĐANG CHỜ NGUYÊN LIỆU'},
      {title:'NEO · ĐƠN ĐẦU TIÊN',reaction:'😮',lines:['Có khách đầu tiên tới rồi!','Khách gọi '+recipe.name+'.','Chọn đúng món và tùy chọn rồi pha nhé.'],waiting:'Mình chờ bạn hoàn tất đơn đầu tiên.',action:'NEO ĐANG CHỜ BẠN PHA'},
      {title:'NEO · BẠN ĐỒNG HÀNH',reaction:'🎉',lines:['Tuyệt! Đơn đầu tiên đã hoàn tất.','Mình sẽ ở đây đồng hành cùng bạn.','Cùng mở quán và đón thêm khách nhé!'],waiting:'',action:'MỞ QUÁN'}
    ];
  }
  function renderCompanion(){
    if(!sessionStarted||tutorialActive)return;
    $('tutorialDockCounter').textContent='NEO · ĐỒNG HÀNH';$('tutorialDockHeading').textContent='NEO';$('tutorialDockText').textContent=neoMessage;$('tutorialDockHint').textContent='';$('tutorialDockExpand').textContent='XEM LẠI';$('tutorialDockExpand').disabled=false;$('tutorialDockSkip').hidden=true;$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDock').hidden=false;
    window.clearTimeout(neoCompanionHideTimer);if(state.tutorialDone)neoCompanionHideTimer=window.setTimeout(()=>{if(state.tutorialDone&&!tutorialActive)$('tutorialDock').hidden=true},4200);
  }
  function setNeoMessage(reaction,message){neoReaction=reaction;neoMessage=message;if(sessionStarted&&!tutorialActive)renderCompanion()}
  function renderTutorial(){
    const step=Math.min(2,state.tutorialStep),item=tutorialDialogues()[step],line=Math.min(tutorialLine,item.lines.length-1),waiting=step<2&&line===item.lines.length-1,finished=step===2&&line===item.lines.length-1,counter=`${String(step+1).padStart(2,'0')} / 03`,message=item.lines[line];
    neoReaction=item.reaction;$('tutorialMiniCharacter').dataset.expression=neoReaction;document.querySelector('.tutorial-guide').innerHTML='NEO <span>· BẠN ĐỒNG HÀNH</span>';$('tutorialHeading').textContent=item.title;$('tutorialText').textContent=message;$('tutorialHint').textContent=waiting?item.waiting:'';$('tutorialContinue').textContent=waiting?'ĐANG CHỜ':finished?'MỞ QUÁN':'TIẾP TỤC';$('tutorialContinue').disabled=waiting;$('tutorialCounter').textContent=counter;$('tutorialProgress').style.width=`${step/2*100}%`;$('tutorialDockCounter').textContent=counter;$('tutorialDockHeading').textContent='NEO';$('tutorialDockText').textContent=message;$('tutorialDockHint').textContent='';$('tutorialDockExpand').textContent=waiting?'CHỜ':finished?'MỞ QUÁN':'TIẾP TỤC';$('tutorialDockExpand').disabled=waiting;$('tutorialDockSkip').hidden=false;$('tutorialScreen').hidden=true;$('tutorialDock').hidden=false;updateTutorialTarget()
  }
  function updateTutorialTarget(){
    document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));
    return;
  }
  function enableOutsideTutorial(){if(!tutorialActive)return;guidedOutside=true;$('tutorialScreen').hidden=true;$('gameShell').inert=false;$('tutorialDock').hidden=false;document.body.classList.add('tutorial-guided');syncTutorialLock();renderTutorial();save()}
  function reopenTutorial(){if(!tutorialActive)return;guidedOutside=false;$('gameShell').inert=false;$('tutorialDock').hidden=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();renderTutorial()}
  function setTutorialOrder(){state.orderId='meteor';state.orderFaction='hackers';state.orderVip=false;state.orderSpec={size:'M',sugar:50,ice:50,topping:'none'};$('cupSize').value='M';$('sugarLevel').value='50';$('iceLevel').value='50';$('toppingChoice').value='none';state.orderStarted=Date.now();state.orderExpires=Date.now()+45000;renderOrderPreferences()}
  function startTutorial(){if(state.tutorialDone)return;window.clearTimeout(tutorialAutoFinishTimer);window.clearTimeout(neoCompanionHideTimer);tutorialAutoFinishTimer=0;tutorialLine=0;tutorialActive=true;guidedOutside=false;$('gameShell').inert=false;$('tutorialScreen').hidden=true;$('tutorialDock').hidden=false;document.body.classList.remove('tutorial-guided');normalizeTutorialStep();if(state.tutorialStep<2)setTutorialOrder();render();syncTutorialLock();renderTutorial();save()}
  function startGameSession(){if(sessionStarted)return;sessionStarted=true;document.body.classList.remove('intro-open');$('introScreen').classList.add('leaving');$('gameShell').inert=false;$('gameShell').removeAttribute('aria-hidden');window.scrollTo(0,0);state.lastSeen=Date.now();tickTimer=setInterval(tick,1000);syncTutorialLock();renderCompanion();save()}
  function returnToTitleScreen(){if(!sessionStarted)return;sessionStarted=false;if(tickTimer){clearInterval(tickTimer);tickTimer=null}if(audioLoop){clearInterval(audioLoop);audioLoop=null}if(audioContext){audioContext.close();audioContext=null}state.audio=false;state.lastSeen=Date.now();save();$('introScreen').hidden=false;$('introScreen').classList.remove('leaving');document.body.classList.add('intro-open');$('gameShell').inert=true;$('gameShell').setAttribute('aria-hidden','true');window.scrollTo(0,0)}
  function advanceTutorial(){if(!tutorialActive)return;state.tutorialStep=Math.min(2,state.tutorialStep+1);tutorialLine=0;if(state.tutorialStep===1)setTutorialOrder();render();syncTutorialLock();renderTutorial();save()}
  function finishTutorial(){if(!tutorialActive)return;window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=true;state.tutorialStep=2;tutorialActive=false;guidedOutside=false;$('tutorialScreen').hidden=true;$('gameShell').inert=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));setNeoMessage('🎉','Chúc bạn chơi vui nhé! NEO luôn ở đây.');renderCompanion();save();toast('Chúc bạn chơi game vui vẻ!')}
  function doTutorialAction(){if(!tutorialActive)return;const item=tutorialDialogues()[state.tutorialStep];if(tutorialLine<item.lines.length-1){tutorialLine++;renderTutorial();return}if(state.tutorialStep<2){toast(item.waiting);return}finishTutorial()}
  function skipTutorial(){if(!tutorialActive)return;window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=true;state.tutorialStep=2;tutorialActive=false;guidedOutside=false;$('tutorialScreen').hidden=true;$('gameShell').inert=false;document.body.classList.remove('tutorial-guided');syncTutorialLock();document.querySelectorAll('.tutorial-target').forEach(element=>element.classList.remove('tutorial-target'));setNeoMessage('🎉','Chúc bạn chơi vui nhé! NEO luôn ở đây.');renderCompanion();save()}
  function replayTutorial(){if(!sessionStarted){window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=false;state.tutorialStep=0;save();return}window.clearTimeout(tutorialAutoFinishTimer);tutorialAutoFinishTimer=0;state.tutorialDone=false;state.tutorialStep=0;setTutorialOrder();startTutorial()}
  const escapeHtml = window.NEON_BREW_HELPERS.escapeHtml;
  let brewResultTimer=0;
  function ensureProgressHudUI(){
    const stats=document.querySelector('.stats');
    if(!stats)return;
    if(!$('progressXpValue')){const card=document.createElement('div');card.className='stat progression-stat';card.innerHTML='<div class="stat-label"><span class="stat-icon">✦</span> XP</div><div class="stat-value" id="progressXpValue">0</div><span class="stat-trend" id="progressLevelValue">LEVEL 1 · 0 / 35</span>';stats.appendChild(card)}
    if(!$('progressComboValue')){const card=document.createElement('div');card.className='stat progression-stat';card.innerHTML='<div class="stat-label"><span class="stat-icon">🔥</span> COMBO</div><div class="stat-value" id="progressComboValue">x0</div><span class="stat-trend" id="progressComboBonus">+0% REWARD</span>';stats.appendChild(card)}
  }
  function ensureBrewFeedbackUI(){
    const timerLine=document.querySelector('.timer-line');
    if(timerLine&&!$('orderTimeText')){const time=document.createElement('div');time.className='order-time-text';time.id='orderTimeText';time.setAttribute('aria-live','polite');timerLine.after(time)}
    const sequence=$('brewSequence');
    if(sequence&&!$('brewTimingTrack')){
      const track=document.createElement('div');track.className='brew-timing-track';track.id='brewTimingTrack';track.setAttribute('aria-hidden','true');track.innerHTML='<span class="brew-timing-good"></span><span class="brew-timing-perfect"></span><i class="brew-timing-marker"></i>';
      $('brewSequenceStatus').parentElement.after(track);
      const result=document.createElement('section');result.className='order-result';result.id='orderResult';result.hidden=true;result.setAttribute('role','status');result.setAttribute('aria-live','polite');result.innerHTML='<div class="order-result-heading"><strong id="orderResultTitle"></strong><b id="orderResultScore"></b></div><p id="orderResultBreakdown"></p><div class="order-result-rewards"><span id="orderResultReward"></span><span id="orderResultXp"></span><span id="orderResultTip"></span></div>';
      sequence.after(result);
    }
  }
  function updateBrewSequenceUI(){
    ensureBrewFeedbackUI();
    const seq=$('brewSequence');
    if(!seq)return;
    if(!interactiveBrew){seq.hidden=true;return;}
    const { steps, stage }=interactiveBrew;
    const perfectZone=$('brewTimingTrack')?.querySelector('.brew-timing-perfect'),goodZone=$('brewTimingTrack')?.querySelector('.brew-timing-good'),perfectWidth=9+state.machineLevel*1.8,goodWidth=36+state.machineLevel*3.6;
    if(perfectZone){perfectZone.style.left=`${50-perfectWidth/2}%`;perfectZone.style.right=`${50-perfectWidth/2}%`}
    if(goodZone){goodZone.style.left=`${50-goodWidth/2}%`;goodZone.style.right=`${50-goodWidth/2}%`}
    const finished=stage>=steps.length;
    $('brewSequenceStatus').textContent=finished?'HOÀN TẤT CÁC BƯỚC · SẴN SÀNG GIAO':`BƯỚC ${stage+1}/${steps.length}`;
    $('pourWaterBtn').textContent=finished?'ĐÃ PHA XONG':`CANH ${steps[stage]}`;
    $('pourWaterBtn').disabled=finished;
    $('addToppingBtn').hidden=true;
    $('finishBrewBtn').disabled=!finished;
    $('finishBrewBtn').textContent='GIAO ORDER';
    seq.hidden=false;
  }
  function playBrewSfx(kind){
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    const context=audioContext||(sfxContext||(sfxContext=new Audio()));
    if(context.state==='suspended')context.resume().catch(()=>{});
    const tones={PERFECT:880,GREAT:740,GOOD:600,MISS:220,reward:980,fail:180},frequency=tones[kind]||520,now=context.currentTime;
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type=kind==='MISS'||kind==='fail'?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,now);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.035,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+.16);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(now);oscillator.stop(now+.17);
  }
  function hitBrewStep(){
    if(!interactiveBrew||interactiveBrew.stage>=interactiveBrew.steps.length)return;
    const cycle=1800,phase=((Date.now()-interactiveBrew.stepStartedAt)%cycle)/cycle;
    const position=phase<.5?phase*2:2-phase*2,distance=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.abs(position-.5);
    const grade=distance<=.05+state.machineLevel*.01?{name:'PERFECT',accuracy:100}:distance<=.1+state.machineLevel*.015?{name:'GREAT',accuracy:90}:distance<=.2+state.machineLevel*.02?{name:'GOOD',accuracy:75}:{name:'MISS',accuracy:40};
    playBrewSfx(grade.name);
    interactiveBrew.accuracies.push(grade.accuracy);
    interactiveBrew.stage++;
    interactiveBrew.stepStartedAt=Date.now();
    const marker=$('brewTimingTrack')?.querySelector('.brew-timing-marker');
    if(marker){marker.style.animation='none';marker.offsetWidth;marker.style.animation=''}
    updateBrewSequenceUI();
    $('brewSequenceStatus').textContent=`${grade.name} · ${interactiveBrew.steps[Math.max(0,interactiveBrew.stage-1)]}`;
    $('pourWaterBtn').classList.toggle('brew-hit-perfect',grade.accuracy===100);
    window.setTimeout(()=>$('pourWaterBtn').classList.remove('brew-hit-perfect'),350);
    if(navigator.vibrate&&grade.accuracy===100)navigator.vibrate(18);
  }
  function showOrderResult({quality,breakdown,reward,xp,tip,combo,correct}){
    ensureBrewFeedbackUI();
    const result=$('orderResult');
    $('orderResultTitle').textContent=correct?qualityBand(quality):'ORDER MISSED';
    $('orderResultScore').textContent=`${quality} / 100`;
    $('orderResultBreakdown').textContent=`Recipe ${breakdown.recipe}% · Brew ${breakdown.brewing}% · Sugar ${breakdown.sugar}% · Ice ${breakdown.ice}% · Timing ${breakdown.timing}%`;
    $('orderResultReward').textContent=`+₫${format(reward)}`;
    $('orderResultXp').textContent=`+${format(xp)} XP`;
    $('orderResultTip').textContent=`TIP +₫${format(tip)} · COMBO x${combo}`;
    result.hidden=false;
    window.clearTimeout(brewResultTimer);
    brewResultTimer=window.setTimeout(()=>{result.hidden=true},1800);
  }
  function completeInteractiveBrew(){
    if(!interactiveBrew)return;
    const { recipeId, prep, ingredientCounts, accuracies } = interactiveBrew;
    const brewAccuracy=accuracies.length?accuracies.reduce((sum,value)=>sum+value,0)/accuracies.length:0;
    interactiveBrew = null;
    $('brewSequence').hidden = true;
    const recipe = recipeById(recipeId);
    if(!recipe)return;
    activeBrew=true;$('brewShade').classList.add('show');renderRecipes();if(tutorialActive)renderTutorial();
    const duration=Math.max(600,Math.round(1250/(1+state.machineLevel*.1)));
    brewTimer=setTimeout(()=>{
      const correct=recipe.id===state.orderId,liked=customerLikes(recipe);const qualityBreakdown=calculateOrderQualityBreakdown(correct,liked,!!state.orderVip,prep,recipe,brewAccuracy);const quality=Math.max(0,Math.min(100,qualityBreakdown.total));const repDelta=orderReputationDelta(correct,liked,state.orderVip);
      const orderMeta=state.currentOrder || {recipeId: recipe.id, size: prep.size, sugar: prep.sugar, ice: prep.ice, toppings: prep.topping==='boba'?['boba']:[], vip: !!state.orderVip};
      orderMeta.customerLoyalty=getIndividualCustomerLoyalty(state.currentCustomerId);
      const guest=customerById(state.currentCustomerId),guestVisits=Number(state.customerVisits?.[state.currentCustomerId]?.visits)||0,loyaltyTip=guestVisits>=30?.15:guestVisits>=15?.1:guestVisits>=7?.05:guestVisits>=3?.03:0;
      const tipRate=correct?Math.min(.35,tipRateFromQuality(quality)*(guest?.tipModifier??1)+loyaltyTip):0;
      const result={quality,qualityBreakdown,correct,liked,vip:!!state.orderVip,tipRate};
      const loyaltyMultiplier=updateCustomerLoyalty(quality,correct&&quality>=60,liked,state.orderFaction);
      updateComboFromQuality(correct?quality:0);
      const earned=correct ? Math.round((calculateOrderReward(orderMeta,result)||0) * loyaltyMultiplier) : 0;
      const tip=correct?Math.round((Number(recipe.price)||0)*(prep.size==='L'?1.25:1)*tipRate*moneyMultiplier()):0;
      const xpGain=correct?Math.max(1,Math.round((Number(state.currentOrder?.xpReward)||7)*(.5+quality/200))):0;
      playBrewSfx(correct?(quality>=90?'reward':'GOOD'):'fail');
      if(correct)serveAnimationStarted=Date.now();
      state.reviewScore=Math.max(0,Math.min(100,(state.reviewScore*.7)+(quality*.3)));
      vibrate(correct ? [30,40,30] : [60,50,60]);
      consumeIngredients(ingredientCounts);
      if(correct){state.money+=earned;state.lifetimeEarned=(state.lifetimeEarned||0)+earned;state.served++;state.shiftServed++;state.shiftRevenue+=earned;state.lifetimeServed=(state.lifetimeServed||0)+1;state.xp+=xpGain;state.totalOrders=(Number(state.totalOrders)||0)+1;state.perfectOrders=(quality>=90?(Number(state.perfectOrders)||0)+1:Number(state.perfectOrders)||0);state.statistics={...(state.statistics||{}),orders:(Number(state.statistics?.orders)||0)+1,perfect:(quality>=90?(Number(state.statistics?.perfect)||0)+1:Number(state.statistics?.perfect)||0)}}else{state.badOrders++;state.starRating=Math.max(0,state.starRating-1);state.failedOrders=(Number(state.failedOrders)||0)+1;state.totalOrders=(Number(state.totalOrders)||0)+1;state.statistics={...(state.statistics||{}),orders:(Number(state.statistics?.orders)||0)+1,failed:(Number(state.statistics?.failed)||0)+1};toast('Sai công thức — khách đánh giá thấp, bạn mất 1 sao!');addLog(`Sai đơn ${recipe.name}. Khách phàn nàn về công thức.`,'Đánh giá')}
      state.reputation=Math.max(0,state.reputation+repDelta);if(liked)state.factionRep[state.orderFaction]+=correct?2:1;if(recipe.id==='meteor'||(recipe.tags||[]).includes('caffeine'))state.daily.espresso++;
      advanceXpProgression();updateStarRating();if(correct)advanceBulkOrder();checkBadges();addLog(`${correct?'Đúng đơn':'Sai đơn '+recipe.short}${liked&&correct?' · hợp gu '+state.orderFaction:''} · ${correct?`KPI ${quality}% · nhận ₫${format(earned)} · combo x${Number(state.combo)||0}`:`KPI ${quality}% · mất ${Math.abs(repDelta)} danh tiếng · combo reset`}.`,correct?'Đơn hoàn tất':'Đánh giá');
      activeBrew=false;$('brewShade').classList.remove('show');setTimeout(()=>document.body.classList.remove('glitch'),180);recordShiftOrder();if(!state.shiftClosed)newOrder(false);showOrderResult({quality,breakdown:qualityBreakdown,reward:earned,xp:xpGain,tip,combo:state.combo,correct});
      const resultMessage=correct?`Đúng món ${recipe.name}! Khách vui rồi 🎉`:`Chưa đúng đơn ${recipe.name}. Mình thử lại nhé.`;
      if(tutorialActive&&state.tutorialStep===1){
        if(correct){neoReaction='🎉';render();save();$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDockText').textContent=resultMessage;$('tutorialDockHint').textContent='';window.setTimeout(()=>{if(tutorialActive&&state.tutorialStep===1)advanceTutorial()},650)}
        else{setTutorialOrder();tutorialLine=tutorialDialogues()[1].lines.length-1;render();syncTutorialLock();renderTutorial();neoReaction='⚠️';$('tutorialMiniCharacter').dataset.expression=neoReaction;$('tutorialDockText').textContent='⚠️ Đơn chưa đúng. Mình thử lại món khách gọi nhé.';save()}
        toast(correct?`Đúng món và tuỳ chọn! KPI ${quality}% · +₫${format(earned)} · danh tiếng +${repDelta}${liked?' · khách hài lòng':''}.`:`Sai món hoặc tuỳ chọn! KPI ${quality}% · mất ${Math.abs(repDelta)} danh tiếng và 1 sao.`);return;
      }
      if(sessionStarted)setNeoMessage(correct?'🎉':'⚠️',resultMessage);render();save();toast(correct?`Đúng món và tuỳ chọn! KPI ${quality}% · +₫${format(earned)} · combo x${Number(state.combo)||0} · danh tiếng +${repDelta}${liked?' · khách hài lòng':''}.`:`Sai món hoặc tuỳ chọn! KPI ${quality}% · mất ${Math.abs(repDelta)} danh tiếng và 1 sao.`);
    },duration)
  }
  function craftResearch(){
    if(state.money<18)return;const selected=[$('ingredientA').value,$('ingredientB').value,$('ingredientC').value],counts=Object.fromEntries(ingredients.map(item=>[item.id,selected.filter(id=>id===item.id).length]));
    if(selected.length!==3||selected.some(id=>!ingredients.some(item=>item.id===id))){toast('Chọn đủ ba nguyên liệu hợp lệ trước khi thử.');return}
    if(Object.entries(counts).some(([id,count])=>(state.inventory[id]||0)<count)){toast('Không đủ nguyên liệu cho công thức này.');return}
    state.money-=18;state.researchTrials++;consumeIngredients(counts);const success=Math.random()<researchChance(),key=[...selected].sort().join('_');
    if(!success){state.researchFailures++;state.cyberWaste++;$('researchResult').textContent='☣ Thất bại! Mẻ pha biến thành Rác thải Cyber.';addLog('Thử nghiệm lỗi, thu được Rác thải Cyber.','Phòng lab')}
    else{const existing=state.unlockedRecipes.find(recipe=>recipe.comboKey===key),legendary=Math.random()<.08;if(existing){const salvage=(legendary?50:20)*moneyMultiplier();state.money+=salvage;$('researchResult').textContent=`✦ Công thức trùng lặp, tái chế thành ₫${format(salvage)}.`;addLog(`Tái chế mẻ pha trùng · +₫${format(salvage)}.`,'Phòng lab')}
      else{const parts=selected.map(id=>ingredients.find(item=>item.id===id)),tags=[...new Set(parts.map(item=>item.tag))],basePrice=30+parts.reduce((sum,item)=>sum+item.cost,0),recipe={id:`lab_${key}`,comboKey:key,name:legendary?'Aurora Huyền Thoại':`${parts[0].name.split(' ')[0]} ${parts[1].name.split(' ')[0]} ${parts[2].name.split(' ')[0]}`,icon:legendary?'✨':'🧪',short:'Lab',details:parts.map(item=>item.name).join(' · '),recipe:parts.map(item=>item.name).join(' · '),price:basePrice,tags:legendary?[...tags,'premium']:tags,legendary};state.unlockedRecipes.push(recipe);state.factionRep.hackers++;$('researchResult').textContent=legendary?`✧ Thành công xuất sắc! ${recipe.name} bán với giá trị x5.`:`✦ Khám phá thành công: ${recipe.name}. Công thức mới đã mở khóa.`;addLog(`Mở khóa ${recipe.name}${legendary?' · HUYỀN THOẠI ×5':''}.`,'Phòng lab')}}
    if(success&&state.unlockedRecipes.some(recipe=>recipe.comboKey===key))state.researchSuccesses++;
    document.body.classList.add('glitch');setTimeout(()=>document.body.classList.remove('glitch'),220);checkBadges();render();save()
  }
  function buyIngredient(id){const item=ingredients.find(entry=>entry.id===id);if(!item)return;const cost=ingredientPrice(item);if(state.money<cost)return;state.money-=cost;state.inventoryLots[id].push({quantity:1,purchasedShift:state.shift});state.inventory[id]=(state.inventory[id]||0)+1;render();save();toast(`${item.name} đã nhập kho${state.dealIngredient===id?' · giảm 20%':''}.`);if(!tutorialActive&&sessionStarted)setNeoMessage('😄','Kho đã có thêm nguyên liệu. Quầy sẵn sàng rồi!');if(tutorialActive && state.tutorialStep===0 && (state.inventory[id]||0)>0){window.setTimeout(()=>{if(!tutorialActive || state.tutorialStep!==0)return;state.tutorialStep=1;tutorialLine=0;setTutorialOrder();render();syncTutorialLock();renderTutorial();save();toast('Đã mua nguyên liệu. Bây giờ bạn có thể pha đơn đầu tiên.');},200)}}
  function recycleWaste(){if(state.cyberWaste<1)return;const recovered=state.cyberWaste*5*moneyMultiplier();state.cyberWaste=0;state.money+=recovered;render();save();toast(`Tái chế rác thải Cyber · +₫${format(recovered)}.`)}
  function buyDecor(id){const item=decorItems.find(entry=>entry.id===id);if(!item||state.decorations[id]||state.money<item.cost)return;state.money-=item.cost;state.decorations[id]=true;addLog(`Đã lắp ${item.name}.`,'Trang trí');render();save();toast(`${item.name} đã lắp đặt.`)}
  function buyFirewall(){if(state.firewall>=5)return;const cost=firewallCost();if(state.money<cost)return;state.money-=cost;state.firewall++;addLog(`Nâng Firewall lên cấp ${state.firewall}.`,'An ninh');render();save();toast('Firewall đã bật. Kỹ năng hack ngược được mở khóa.')}
  function buyMachineUpgrade(){if(state.machineLevel>=5)return;const cost=machineUpgradeCost();if(state.money<cost)return;state.money-=cost;state.machineLevel++;addLog(`Nâng Espresso Machine lên cấp ${state.machineLevel}.`,'Nâng cấp');render();save();toast(`Machine LV ${state.machineLevel} · vùng timing rộng hơn.`)}
  function buyDeliveryDrone(){const cost=deliveryDroneCost();if(state.money<cost)return;state.money-=cost;state.deliveryDrone++;addLog('Mua thêm drone Cyber-Delivery.','Giao hàng');render();save();toast('Đội bay giao hàng đã mở rộng.')}
  function toggleDelivery(){if(!state.deliveryDrone)return;state.deliveryActive=!state.deliveryActive;render();save();toast(state.deliveryActive?'Đội drone sẵn sàng giao hàng trong Bão Axit.':'Đã cho đội drone nghỉ.')}
  function buyTrack(id){const track=tracks.find(entry=>entry.id===id);if(!track)return;if(!state.tracks.includes(id)){if(state.money<track.cost)return;state.money-=track.cost;state.tracks.push(id);addLog(`Mua đĩa ${track.name}.`,'Jukebox')}state.trackId=id;render();save();toast(`${track.name} đã được chọn trong Jukebox.`)}
  function claimDaily(){if(state.daily.rewarded)return;const progress=dailyProgress();if(progress.espresso<200||progress.hackers<3||progress.seconds<900)return;state.daily.rewarded=true;state.chips++;addLog('Hoàn tất nhiệm vụ ngày · nhận 1 Quantum Chip.','Nhiệm vụ');render();save();toast('Nhận 1 Quantum Chip!')}
  function doPrestige(){if(state.served<200||state.chips<1||!window.confirm('Chuyển sinh sẽ đặt lại cửa hàng, công thức và tiến độ nhiệm vụ; giữ Quantum Chips, huy hiệu và nhiệm vụ đã nhận hôm nay. Tiếp tục?'))return;const firstRebirth=!state.badges.rebirth,chips=state.chips-1+(firstRebirth?1:0),prestiges=state.prestiges+1,badges={...state.badges,rebirth:true},daily={...state.daily};state=withShiftDefaults(initialState());state.modernCafeVersion=7;state.recipeUnlocks=['meteor'];state.customerVisits={};state.currentCustomerId='mai';state.chips=chips;state.prestiges=prestiges;state.badges=badges;state.daily=daily;addLog('Chuyển sinh · tiêu thụ 1 QC, hệ số doanh thu tăng 5%.','Chuyển sinh');render();save();toast('Tái khởi động thành công. Hệ số doanh thu tăng vĩnh viễn.')}
  function startThreat(){if(activeThreat)return;const kind=eventRules.securityKind(()=>Math.random());if(kind==='ransomware'){state.ransomwareIncidents++;showIncident(kind,storyEvents.ransomware.title,storyEvents.ransomware.copy,'Chọn cách xử lý trong 25 giây.',25000,['payThreat','reinstallThreat','hackThreat']);$('payThreat').textContent=`TRẢ CHUỘC · −10% (₫${format(eventRules.ransom(state.money))})`;$('reinstallThreat').textContent='CÀI LẠI FIRMWARE · 2 PHÚT';$('hackThreat').textContent=state.firewall?'HACK NGƯỢC · LẤY ₫'+format(eventRules.ransom(state.money)*2):'HACK NGƯỢC · CẦN FIREWALL';$('hackThreat').disabled=state.firewall<1;return}if(kind==='union'){showIncident(kind,storyEvents.union.title,storyEvents.union.copy,'Đồng ý tốn thêm 5% bảo trì mỗi giờ, robot nhanh hơn 15%. Format có rủi ro.',25000,['acceptUnion','formatRobots']);return}const {left,right,answer}=eventRules.challenge(()=>Math.random(),kind),defense=kind==='hacker'?state.drone:state.bouncer,yakuza=kind==='gang'&&state.yakuzaProtectionUntil>Date.now();if(yakuza||(defense&&Math.random()<Math.min(.92,.5+defense*.15))){state.securityEvictions++;if(kind==='hacker')state.daily.hackers++;state.factionRep[kind==='hacker'?'hackers':'samurai']+=1;$('securityStatus').textContent=yakuza?'Yakuza chặn băng đảng đối thủ theo thỏa thuận bảo kê.':`${kind==='hacker'?'Drone':'Bouncer'} tự động đẩy lùi khách không mời.`;addLog('Đội an ninh tự động đẩy lùi khách không mời.','An ninh');render();save();return}const pay=Math.ceil(55+Math.random()*45);activeThreat={kind,answer,expires:Date.now()+15000,pay};showIncident(kind,kind==='hacker'?'Hacker đòi tiền chuộc':'Băng đảng đòi bảo kê',kind==='hacker'?'Một hacker khóa hệ thống bán hàng. Giải mã nhanh hoặc mất tiền.':'Băng đảng chặn cửa. Giải câu đố bảo mật để đuổi chúng đi.','',15000,['payThreat','solveThreat'],`Xác minh: ${left} ${kind==='hacker'?'×':'+'} ${right} = ?`);$('payThreat').textContent=`TRẢ ₫${format(pay)}`}
  function resolveThreat(success,paid=false){
    if(!activeThreat)return;const kind=activeThreat.kind,now=Date.now();
    if(kind==='ransomware'){const ransom=eventRules.ransom(state.money);if(paid){state.money=Math.max(0,state.money-ransom);state.stalledUntil=0;$('securityStatus').textContent='Đã trả 10% tiền chuộc. Robot hoạt động lại ngay.'}else{state.stalledUntil=now+120000;$('securityStatus').textContent='Đang cài lại firmware. Robot sẽ trở lại sau 2 phút.'}addLog(paid?'Trả 10% quỹ chuộc robot.':'Cài lại firmware, robot tạm dừng 2 phút.','Ransomware')}
    else if(kind==='union'){if(paid){state.robotUnion=true;state.maintenanceDueAt=now+3600000;$('securityStatus').textContent='Chấp nhận yêu cầu Liên đoàn. Robot nhanh hơn 15% vĩnh viễn.';addLog('Chấp nhận thỏa thuận dầu nhớt và sạc pin.','Liên đoàn Robot')}else if(eventRules.formatSucceeds(()=>Math.random())){$('securityStatus').textContent='Đe dọa format thành công. Robot quay lại làm việc.';addLog('Robot chấp nhận quay lại làm việc.','Liên đoàn Robot')}else{state.bots=Math.max(0,state.bots-1);$('securityStatus').textContent='Format thất bại. Một robot đã nổ tung.';addLog('Mất một robot sau khi đe dọa format.','Liên đoàn Robot')}}
    else if(paid){state.money=Math.max(0,state.money-activeThreat.pay);$('securityStatus').textContent='Đã trả tiền để kết thúc vụ việc.'}
    else if(success){const reward=35*moneyMultiplier();state.money+=reward;state.reputation+=1;state.securityEvictions++;state.factionRep[kind==='hacker'?'hackers':'samurai']+=2;if(kind==='hacker')state.daily.hackers++;$('securityStatus').textContent=`Xác minh thành công. +₫${format(reward)}.`}
    else{const fine=activeThreat.pay;state.money=Math.max(0,state.money-fine);if(kind==='hacker'&&!state.decorations.airFilter&&state.bots>0)state.stalledUntil=now+30000;$('securityStatus').textContent=`Quá thời gian. Mất ₫${format(fine)}${state.stalledUntil?' · robot tạm ngưng 30 giây':''}.`}
    finishIncident($('securityStatus').textContent,'An ninh')
  }
  function hackRansomware(){if(!activeThreat||activeThreat.kind!=='ransomware'||state.firewall<1)return;const reward=eventRules.ransom(state.money)*2*moneyMultiplier();if(eventRules.hackSucceeds(()=>Math.random(),state.firewall)){state.money+=reward;state.stalledUntil=0;finishIncident(`Firewall diệt virus và hack ngược · +₫${format(reward)}.`,'Firewall')}else{state.stalledUntil=Date.now()+120000;finishIncident('Hack ngược thất bại. Robot đang cài lại firmware 2 phút.','Firewall')}}
  function resolveUnion(accept){if(!activeThreat||activeThreat.kind!=='union')return;resolveThreat(false,accept)}
  function parseThreatAnswer(raw){
    const value = String(raw ?? '').trim();
    if (!value) return NaN;
    const normalized = value.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, '');
    if (/^\d+$/.test(normalized)) return Number(normalized);
    const match = normalized.match(/^(\d+)x(\d+)$/);
    if (!match) return NaN;
    return Number(match[1]) * Number(match[2]);
  }
  function orderReviewPercent(correct, liked, vip){
    let score = correct ? 82 : 12;
    if(correct && liked) score += 12;
    if(correct && vip) score += 8;
    if(correct && Date.now() < state.orderExpires) score += 6;
    if(!correct) score = Math.max(0, score - 28);
    return Math.max(0, Math.min(100, score));
  }
  function calculateOrderReward(order, qualityResult){
    const recipe = recipeById(order?.recipeId || state.orderId);
    const customer=customerById(order?.customerId||state.currentCustomerId);
    const base = Number(recipe?.price || 0) * (Number(customer?.rewardModifier)||1);
    const sizeModifier = order?.size === 'L' ? 1.25 : 1;
    const toppingBonus = order?.toppings?.includes('boba') ? 4000 : 0;
    const factionBonusMultiplier = 1 + Math.min(0.15, Math.max(0, (Number(state.factionRep?.[state.orderFaction]) || 0)) * 0.004);
    const comboBonus = comboBonusPercent() / 100;
    const qualityMultiplier = 0.7 + Math.max(0, Number(qualityResult?.quality || 0)) / 100 * 0.75;
    const loyaltyBonus = 1 + Math.min(0.12, (Number(state.currentOrder?.customerLoyalty || 0) || 0) * 0.02);
    const subtotal = base * sizeModifier + toppingBonus;
    const tip = Math.round(subtotal * (qualityResult?.tipRate || 0));
    return Math.max(0, Math.round((subtotal * qualityMultiplier * (1 + comboBonus) * factionBonusMultiplier * loyaltyBonus + tip) * moneyMultiplier()));
  }
  function updateComboFromQuality(quality){
    const numericQuality = Number(quality) || 0;
    if(numericQuality >= 80){state.combo = (Number(state.combo) || 0) + 1;}
    else if(numericQuality < 60){state.combo = 0;}
    state.bestCombo = Math.max(Number(state.bestCombo) || 0, Number(state.combo) || 0);
    state.statistics = {...(state.statistics || {}), bestCombo: Math.max(Number(state.statistics?.bestCombo) || 0, Number(state.bestCombo) || 0)};
    return Number(state.combo) || 0;
  }
  function orderReputationDelta(correct, liked, vip){
    const percent = orderReviewPercent(correct, liked, vip);
    if(correct) return 2 + (percent >= 90 ? 1 : 0);
    return -2;
  }
  function expireOrderPenalty(){
    state.badOrders++;
    state.reputation = Math.max(0, state.reputation - 1);
    state.reviewScore = Math.max(0, state.reviewScore - 20);
    updateStarRating();
    if(sessionStarted&&!tutorialActive)setNeoMessage('⚠️','Đơn vừa hết giờ. Mình cùng chú ý khách tiếp theo nhé.');
    toast('Khách hết giờ — khách bực, danh tiếng giảm 1!');
    addLog('Khách hết giờ và rời quán. Danh tiếng giảm 1.','Hết giờ');
  }
  function autoCompleteOrderByBot(){
    const recipe = recipeById(state.orderId);
    if(!recipe)return false;
    const base = recipe.price * (recipe.legendary ? 5 : 1) * (0.85 + state.bots * 0.12);
    const earned = Math.max(12, Math.round(base * moneyMultiplier()));
    state.money += earned;
    state.served++;
    state.shiftServed++;
    state.shiftRevenue+=earned;
    state.reputation = Math.max(0, state.reputation + 1);
    state.reviewScore = Math.min(100, Math.max(0, state.reviewScore + 10));
    updateStarRating();
    addLog(`Robot hoàn tất đơn ${recipe.name} · +₫${format(earned)} · không trừ sao.`,'Robot');
    toast(`Robot hoàn tất đơn! +₫${format(earned)} · không mất sao.`);
    return true;
  }
  function beginInteractiveBrew(recipeId){
    if(activeBrew||interactiveBrew||state.shiftClosed)return;if(Date.now()<state.orderStarted){toast('Khách đang xem menu.');return}
    if(Date.now() >= state.orderExpires){
      expireOrderPenalty();
      recordShiftOrder();
      if(!state.shiftClosed)newOrder(false,true);
      render();
      save();
      toast('Khách đã rời quán vì hết giờ — danh tiếng giảm 1 sao.');
      return;
    }
    const recipe=recipeById(recipeId);if(!recipe)return;
    const prep={size:$('cupSize').value,sugar:Number($('sugarLevel').value),ice:Number($('iceLevel').value),topping:$('toppingChoice').value};
    const baseIngredients=recipeIngredientIds(recipe.id),usedIngredients=[...baseIngredients.flatMap(id=>Array(prep.size==='L'?2:1).fill(id)),...(prep.topping==='boba'?['boba']:[])],ingredientCounts=usedIngredients.reduce((counts,id)=>{counts[id]=(counts[id]||0)+1;return counts},{});
    const missingIngredient=Object.keys(ingredientCounts).find(id=>(state.inventory[id]||0)<ingredientCounts[id]);
    if(missingIngredient){const item=ingredients.find(entry=>entry.id===missingIngredient);toast(`Thiếu nguyên liệu ${item?item.name:missingIngredient}.`);return}
    const steps=[...(recipe.steps||['GRIND','BREW']),...(prep.topping==='boba'?['TOPPING']:[])];
    interactiveBrew={recipeId: recipe.id, prep, steps, stage:0, ingredientCounts, accuracies:[], stepStartedAt:Date.now()};
    updateBrewSequenceUI();
  }

  document.querySelectorAll('.game-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.game-tab').forEach(tab=>{tab.classList.toggle('active',tab===button);tab.setAttribute('aria-selected',String(tab===button))});const pageId=`view-${button.dataset.view}`;document.querySelectorAll('.view-page').forEach(view=>view.classList.toggle('active',view.id===pageId));if(button.dataset.view==='shop'){const shopView=document.getElementById('view-shop');if(shopView && shopView.dataset.previewOpen===undefined){shopView.dataset.previewOpen='false';}}if(guidedOutside)updateTutorialTarget();document.body.classList.add('glitch');setTimeout(()=>document.body.classList.remove('glitch'),180)}));
  document.querySelectorAll('[data-view-go]').forEach(button=>button.addEventListener('click',()=>{const target=document.querySelector(`.game-tab[data-view="${button.dataset.viewGo}"]`);if(target)target.click();}));
  document.addEventListener('click',event=>{
    const action = event.target.closest('[data-shop-action]');
    if(!action)return;
    const shopView=document.getElementById('view-shop');
    if(!shopView)return;
    if(action.dataset.shopAction==='open'){
      shopView.dataset.previewOpen='true';
      renderStoreExterior();
      return;
    }
    if(action.dataset.shopAction==='back'){
      const target=document.querySelector('.game-tab[data-view="home"]');
      if(target){target.click();}
      else {
        shopView.dataset.previewOpen='false';
        renderStoreExterior();
      }
    }
  });
  $('settingsShortcut').addEventListener('click',()=>{document.querySelector('.game-tab[data-view="more"]').click();$('view-more').scrollIntoView({block:'start',behavior:'smooth'})});$('settingsReturn').addEventListener('click',returnToTitleScreen);$('returnToTitle').addEventListener('click',returnToTitleScreen);
  $('researchButton').addEventListener('click',craftResearch);['ingredientA','ingredientB','ingredientC'].forEach(id=>$(id).addEventListener('change',renderFeatureViews));$('ingredientStock').addEventListener('click',event=>{const buy=event.target.closest('[data-buy-ingredient]'),recycle=event.target.closest('[data-recycle-waste]');if(buy)buyIngredient(buy.dataset.buyIngredient);if(recycle)recycleWaste()});$('decorGrid').addEventListener('click',event=>{const button=event.target.closest('[data-buy-decor]');if(button)buyDecor(button.dataset.buyDecor)});$('trackList').addEventListener('click',event=>{const button=event.target.closest('[data-track]');if(button)buyTrack(button.dataset.track)});$('questList').addEventListener('click',event=>{if(event.target.closest('[data-action="claim-quest"]'))claimDaily()});
  $('pourWaterBtn').addEventListener('click',hitBrewStep);
  $('finishBrewBtn').addEventListener('click',()=>{if(!interactiveBrew||interactiveBrew.stage<interactiveBrew.steps.length){toast('Hoàn tất từng bước pha trước khi giao ly.');return;}completeInteractiveBrew();});
  $('buyDrone').addEventListener('click',()=>{const cost=Math.ceil(220*Math.pow(1.7,state.drone));if(state.money<cost)return;state.money-=cost;state.drone++;addLog('Nâng cấp drone an ninh.','An ninh');render();save();toast('Drone an ninh đã nâng cấp.')});$('buyBouncer').addEventListener('click',()=>{const cost=Math.ceil(280*Math.pow(1.7,state.bouncer));if(state.money<cost)return;state.money-=cost;state.bouncer++;addLog('Thuê thêm robot bouncer.','An ninh');render();save();toast('Robot Bouncer đã vào ca.')});$('buyFirewall').addEventListener('click',buyFirewall);$('buyDeliveryDrone').addEventListener('click',buyDeliveryDrone);$('toggleDelivery').addEventListener('click',toggleDelivery);
  $('payThreat').addEventListener('click',()=>resolveThreat(false,true));$('reinstallThreat').addEventListener('click',()=>resolveThreat(false));$('hackThreat').addEventListener('click',hackRansomware);$('acceptUnion').addEventListener('click',()=>resolveUnion(true));$('formatRobots').addEventListener('click',()=>resolveUnion(false));$('acceptStory').addEventListener('click',()=>resolveStoryEvent(true));$('declineStory').addEventListener('click',()=>resolveStoryEvent(false));$('solveThreat').addEventListener('click',()=>{if(!activeThreat||activeStoryEvent)return;const typed=parseThreatAnswer($('threatAnswer').value);if(typed===activeThreat.answer)resolveThreat(true);else{$('threatAnswer').value='';$('threatAnswer').placeholder='Sai mã · thử lại nhanh';$('threatAnswer').focus()}});$('threatAnswer').addEventListener('keydown',event=>{if(event.key==='Enter')$('solveThreat').click()});
  $('crtToggle').addEventListener('click',()=>{state.crt=!state.crt;renderFeatureViews();save()});$('prestigeButton').addEventListener('click',doPrestige);
  $('themeSelect').addEventListener('change',()=>{uiSettings.theme=$('themeSelect').value;saveUiSettings();applyUiSettings()});$('languageSelect').addEventListener('change',()=>{uiSettings.language=$('languageSelect').value;saveUiSettings();render();applyUiSettings()});$('introLanguageSelect').addEventListener('change',()=>{uiSettings.language=$('introLanguageSelect').value;saveUiSettings();render();applyUiSettings()});
  $('exportSave').addEventListener('click',()=>{$('saveText').value=saveManager.encodeExport(state,EXPORT_VERSION);$('saveMessage').textContent='Đã tạo mã lưu. Hãy sao chép để chuyển sang thiết bị khác.'});$('copySave').addEventListener('click',async()=>{if(!$('saveText').value){$('exportSave').click()}try{await navigator.clipboard.writeText($('saveText').value);$('saveMessage').textContent='Đã sao chép mã lưu vào clipboard.'}catch{$('saveText').focus();$('saveText').select();document.execCommand('copy');$('saveMessage').textContent='Đã chọn mã lưu để sao chép.'}});
  $('importSave').addEventListener('click',()=>{try{saveManager.importSave($('saveText').value.trim(),{storage:localStorage,key:STORE_KEY,version:EXPORT_VERSION});$('saveMessage').textContent='Đã nhập save. Đang mở lại tiệm...';setTimeout(()=>location.reload(),250)}catch(error){$('saveMessage').textContent=error.message||'Không thể đọc mã lưu.'}});
  function ensureDaily(){if(state.daily.date===dayKey())return false;state.daily={date:dayKey(),espresso:0,hackers:0,seconds:0,rewarded:false};return true}
  function processWorldEvents(current){
    if(current>=state.weatherChangedAt){
      const choices=weathers.filter(weather=>weather.id!==state.weatherId),weather=choices[Math.floor(Math.random()*choices.length)]||weathers[0];
      state.weatherId=weather.id;state.weatherChangedAt=current+90000;addLog(`Thời tiết chuyển sang ${weather.name}.`,'Thành phố');toast(`${weather.icon} ${weather.name} · ${weather.effect}`);renderFeatureViews();
    }
    if(current<state.securityNextAt)return;
    state.securityNextAt=current+securityDelay();
    if(activeThreat||interactiveBrew||activeBrew||state.shiftClosed)return;
    const roll=Math.random();
    if(roll<.85)return;
    if(roll<.95){startThreat();return}
    if(Math.random()<.5)startMatrixLoop();
    else showStoryEvent(['bulk','arena','yakuza'][Math.floor(Math.random()*3)]);
  }
  function tick(){
    if(!sessionStarted||tutorialActive||state.shiftClosed)return;
    const current=Date.now(),visible=document.visibilityState==='visible',delta=Math.min(1.5,Math.max(0,(current-(Number(state.lastSeen)||current))/1000));if(ensureDaily())renderFeatureViews();
    if(visible)state.daily.seconds+=delta;state.lastSeen=current;
    if(state.gameOver)return;
    while(state.matrixCyclesLeft>0&&current>=state.matrixCycleEnds){state.matrixCyclesLeft--;if(state.matrixCyclesLeft>0)state.matrixCycleEnds+=eventRules.matrixDuration;else{state.matrixCycleEnds=0;state.matrixNextAt=current+180000;document.body.classList.remove('matrix-glitch');addLog('Glitch in the Matrix đã kết thúc.','Matrix');toast('Tín hiệu Matrix ổn định trở lại.')}}
    if(state.bulkOrder&&current>=state.bulkOrder.expires){state.bulkOrder=null;addLog('Đơn Corporate hết thời hạn.','Đơn lớn');toast('Đơn Corporate đã hết thời gian.')}
    if(activeThreat)state.orderExpires+=delta*1000;
    processWorldEvents(current);
    if(activeThreat&&current>=activeThreat.expires){if(activeStoryEvent)resolveStoryEvent(false);else resolveThreat(false)}
    if(state.starRating<2){state.inspectionProgress+=delta*1000;if(!state.inspectionActive){state.inspectionActive=true;toast('Kiểm tra thực phẩm bắt đầu: uy tín dưới 2 sao!');addLog('Uy tín dưới 2 sao. Bắt đầu kiểm tra thực phẩm.','Kiểm tra');}if(state.inspectionProgress>=30000)triggerGameOver('Uy tín dưới 2 sao quá lâu. Kiểm tra thực phẩm vào cuộc và quán bị đóng cửa.');}
    else{state.inspectionProgress=0;state.inspectionActive=false}
    if(current>=state.orderExpires&&!activeBrew&&!state.shiftClosed){
      if(timerNotice!==state.orderNumber){
        timerNotice=state.orderNumber;
        expireOrderPenalty();
        addLog('Khách hết kiên nhẫn và rời quầy.','Hết giờ');
      }
      recordShiftOrder();if(!state.shiftClosed){newOrder(false,true);render()}
    }
    const duration=Math.max(1,state.orderExpires-state.orderStarted),left=Math.min(100,Math.max(0,(state.orderExpires-current)/duration*100));$('orderTimer').style.width=left+'%';$('orderTimer').style.background=left<25?'var(--pink)':'var(--amber)';
    renderLive();
    if(current%5000<1000)save();
  }
  $('endShiftButton').addEventListener('click',closeShift);$('nextShiftButton').addEventListener('click',openNextShift);
  $('resetButton').addEventListener('click',()=>$('resetDialog').classList.add('show'));$('cancelReset').addEventListener('click',()=>$('resetDialog').classList.remove('show'));$('confirmReset').addEventListener('click',()=>{saveManager.clear([STORE_KEY,BACKUP_SAVE_KEY], localStorage);location.reload()});$('gameOverReset').addEventListener('click',()=>{saveManager.clear([STORE_KEY,BACKUP_SAVE_KEY], localStorage);location.reload()});$('resetDialog').addEventListener('click',event=>{if(event.target===$('resetDialog'))$('resetDialog').classList.remove('show')});document.addEventListener('keydown',event=>{if(event.key==='Escape')$('resetDialog').classList.remove('show')});
  function playAudioStep(){if(!audioContext)return;const notes=(tracks.find(item=>item.id===state.trackId)||tracks[0]).notes,time=audioContext.currentTime;const osc=audioContext.createOscillator(),gain=audioContext.createGain(),filter=audioContext.createBiquadFilter();osc.type='sine';osc.frequency.value=notes[audioStep%notes.length];filter.type='lowpass';filter.frequency.value=900;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(.022,time+.08);gain.gain.exponentialRampToValueAtTime(.0001,time+.72);osc.connect(filter);filter.connect(gain);gain.connect(audioContext.destination);osc.start(time);osc.stop(time+.75);if(audioStep%4===0){const bass=audioContext.createOscillator(),bassGain=audioContext.createGain();bass.type='sine';bass.frequency.value=notes[audioStep%notes.length]/2;bassGain.gain.setValueAtTime(.0001,time);bassGain.gain.exponentialRampToValueAtTime(.018,time+.08);bassGain.gain.exponentialRampToValueAtTime(.0001,time+.62);bass.connect(bassGain);bassGain.connect(audioContext.destination);bass.start(time);bass.stop(time+.65)}audioStep++}
  function toggleAudio(){if(state.audio){state.audio=false;clearInterval(audioLoop);if(audioContext){audioContext.close();audioContext=null}render();save();return}const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio){toast('Trình duyệt này chưa hỗ trợ phát nhạc.');return}audioContext=new Audio();audioContext.resume();audioStep=0;state.audio=true;playAudioStep();audioLoop=setInterval(playAudioStep,850);render();save();vibrate([15])}
  $('soundToggle').addEventListener('click',toggleAudio);$('fullscreenToggle').addEventListener('click',toggleFullscreen);window.addEventListener('pagehide',save);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')save()});window.addEventListener('online',updateConnectionStatus);window.addEventListener('offline',updateConnectionStatus);window.addEventListener('beforeunload',event=>{if(sessionStarted && !state.gameOver && !isResetting){event.preventDefault();event.returnValue='';}});if('serviceWorker' in navigator&&window.isSecureContext&&location.protocol!=='file:'){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
  function drawCafeScene(){const sceneNow=Date.now();visitorActors=visitorActors.filter(visitor=>{const elapsed=sceneNow-visitor.phaseAt;if(visitor.phase==='arriving'&&elapsed>=2200){visitor.phase='waiting';visitor.phaseAt=sceneNow}if(visitor.phase==='leaving'&&elapsed>=2300)return false;return true});const paint=(canvas)=>{if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,t=Date.now()/1000;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=true;const rect=(x,y,width,height,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,width,height)};const round=(x,y,width,height,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,width,height,r);ctx.fill()};const line=(x1,y1,x2,y2,color,width=3)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()};const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill()};
      rect(0,0,w,h,'#edf2e8');rect(0,0,w,h*.64,'#e6efe7');
      round(w*.06,h*.08,w*.43,h*.43,12,'#ffffff');round(w*.075,h*.105,w*.4,h*.375,5,'#b9d9d2');
      rect(w*.08,h*.13,w*.39,h*.3,'#c8e4df');rect(w*.08,h*.34,w*.39,h*.09,'#a9c5b5');
      for(let index=0;index<5;index++){const bx=w*(.1+index*.073),bh=h*(.09+(index%3)*.035);rect(bx,h*.34-bh,w*.045,bh,'#8ea99b');rect(bx+w*.012,h*.34-bh+h*.02,w*.01,h*.025,'#f8e5ad');rect(bx+w*.03,h*.34-bh+h*.055,w*.01,h*.025,'#f8e5ad')}
      line(w*.275,h*.105,w*.275,h*.48,'#fffaf1',5);line(w*.08,h*.295,w*.47,h*.295,'#fffaf1',5);
      round(w*.62,h*.08,w*.31,h*.3,8,'#36574c');round(w*.635,h*.1,w*.28,h*.26,4,'#f3eedf');
      ctx.fillStyle='#456455';ctx.font=`700 ${Math.max(14,w*.024)}px sans-serif`;ctx.fillText('MENU',w*.66,h*.16);ctx.fillStyle='#617568';ctx.font=`600 ${Math.max(10,w*.014)}px sans-serif`;ctx.fillText('LATTE     36.000',w*.66,h*.21);ctx.fillText('MOCHA    42.000',w*.66,h*.26);ctx.fillText('COLD BREW 39.000',w*.66,h*.31);
      rect(0,h*.61,w,h*.39,'#dce7dc');rect(0,h*.72,w,h*.28,'#d2dfd4');
      const workerBob=Math.sin(t*2.2)*h*.004,workerX=w*.5,workerFaceY=h*.3+workerBob,working=Boolean(interactiveBrew||activeBrew);
      round(workerX-w*.085,h*.36+workerBob,w*.17,h*.31,18,'#557c69');round(workerX-w*.045,h*.39+workerBob,w*.09,h*.25,12,'#d7b98c');
      ctx.fillStyle='#e8bd98';ctx.beginPath();ctx.arc(workerX,workerFaceY,w*.042,0,Math.PI*2);ctx.fill();
      round(workerX-w*.047,workerFaceY-w*.045,w*.094,w*.04,14,'#3d443f');round(workerX-w*.052,workerFaceY-w*.022,w*.025,w*.06,10,'#3d443f');
      ctx.fillStyle='#35483d';ctx.beginPath();ctx.arc(workerX-w*.014,workerFaceY,3,0,Math.PI*2);ctx.arc(workerX+w*.014,workerFaceY,3,0,Math.PI*2);ctx.fill();
      line(workerX-w*.065,h*.43+workerBob,working?w*.37:w*.44,h*.51,'#557c69',w*.022);line(workerX+w*.065,h*.43+workerBob,working?w*.62:w*.56,h*.51,'#557c69',w*.022);
      round(workerX-w*.018,h*.52,w*.036,h*.045,7,'#e8bd98');round(workerX-w*.085,h*.51,w*.17,h*.025,8,'#cfaa7c');
      polygon([[w*.14,h*.54],[w*.88,h*.54],[w*.91,h*.6],[w*.11,h*.6]],'#d8a77d');round(w*.15,h*.59,w*.72,h*.14,8,'#b57e57');rect(w*.2,h*.72,w*.035,h*.22,'#97694e');rect(w*.79,h*.72,w*.035,h*.22,'#97694e');
      round(w*.24,h*.32,w*.22,h*.23,11,'#536e61');round(w*.265,h*.34,w*.17,h*.13,5,'#c5d5c5');rect(w*.27,h*.455,w*.16,h*.075,'#405b50');round(w*.29,h*.4,w*.04,h*.05,4,'#e9d7b1');round(w*.365,h*.4,w*.04,h*.05,4,'#e9d7b1');line(w*.35,h*.32,w*.35,h*.27,'#435e53',5);line(w*.35,h*.27,w*.4,h*.27,'#435e53',5);
      round(w*.52,h*.49,w*.06,h*.07,5,'#fff9ec');line(w*.54,h*.49,w*.54,h*.46,'#f39b87',4);line(w*.56,h*.49,w*.56,h*.45+Math.sin(t*2)*2,'#f39b87',3);line(w*.58,h*.49,w*.58,h*.46,'#f39b87',4);
      round(w*.68,h*.48,w*.065,h*.07,7,'#fffaf0');round(w*.739,h*.5,w*.022,h*.035,8,'#fffaf0');rect(w*.682,h*.474,w*.06,h*.012,'#536e61');
      for(const [index,color] of ['#d59b59','#b7d2c3','#986c56'].entries()){const jarX=w*(.64+index*.044);round(jarX,h*.485,w*.032,h*.065,5,color);round(jarX+w*.008,h*.468,w*.016,h*.025,4,'#f0d3a2');rect(jarX+w*.009,h*.51,w*.014,h*.012,'rgba(255,250,235,.72)')}
      round(w*.79,h*.475,w*.065,h*.065,6,'#607d6e');polygon([[w*.795,h*.475],[w*.805,h*.43],[w*.845,h*.43],[w*.855,h*.475]],'#adcabd');round(w*.805,h*.515,w*.035,h*.025,4,'#d6b57d');rect(w*.815,h*.452,w*.02,h*.013,'#edf2e8');
      rect(w*.92,h*.45,w*.035,h*.1,'#bc7a5b');for(let leaf=0;leaf<5;leaf++){ctx.fillStyle=leaf%2?'#719978':'#5e886a';ctx.beginPath();ctx.ellipse(w*(.91+leaf*.018),h*(.38+(leaf%3)*.025),w*.018,h*.07,leaf*.4,0,Math.PI*2);ctx.fill()}
      for(let seat=0;seat<2;seat++){const sx=w*(.08+seat*.82);rect(sx,h*.78,w*.12,h*.025,'#b9805a');rect(sx+w*.015,h*.805,w*.012,h*.12,'#9b7054');rect(sx+w*.09,h*.805,w*.012,h*.12,'#9b7054');}
      rect(0,h*.95,w,h*.05,'#b8cbbb');
      const servingVisitor=visitorActors.find(visitor=>visitor.phase==='leaving'),serveElapsed=Date.now()-serveAnimationStarted,serveProgress=serveAnimationStarted?Math.min(1,serveElapsed/950):1,serveEase=serveProgress*serveProgress*(3-2*serveProgress),serveTargetX=servingVisitor?w*(servingVisitor.target+.055):w*.68;
      const reachX=serveProgress<1&&serveAnimationStarted?w*(.52+(.58*(serveTargetX/w-.52))*serveEase):working?w*.38:w*.52,reachY=serveProgress<1&&serveAnimationStarted?h*(.52+.13*serveEase):working?h*(.49+Math.sin(t*12)*.008):h*.52;
      line(workerX-w*.035,h*.43+workerBob,reachX,reachY,'#557c69',w*.02);round(reachX-w*.012,reachY-w*.012,w*.024,w*.024,8,'#e8bd98');
      if(working){for(let puff=0;puff<3;puff++){const steamY=h*.455-puff*h*.025-Math.sin(t*5+puff)*h*.008;line(w*.35+puff*w*.018,steamY,w*.35+puff*w*.018+Math.sin(t*3+puff)*w*.008,steamY-h*.025,'rgba(255,255,255,.65)',Math.max(2,w*.002))}}
      if(serveAnimationStarted&&serveProgress<1){const cupX=w*(.58+(serveTargetX/w-.58)*serveEase),cupY=h*(.48+.16*serveEase-Math.sin(serveProgress*Math.PI)*.08);round(cupX-w*.018,cupY,w*.036,h*.045,5,'#fff8e9');round(cupX-w*.022,cupY-h*.008,w*.044,h*.012,4,'#e0b07b');line(cupX,cupY-h*.01,cupX,cupY-h*.035,'#9a654d',3)}
      for(const visitor of visitorActors){
        const elapsed=Date.now()-visitor.phaseAt,duration=visitor.phase==='leaving'?2300:2200,progress=Math.max(0,Math.min(1,elapsed/duration)),ease=progress*progress*(3-2*progress),avatarWidth=w*.11,avatarHeight=h*.58,targetX=w*visitor.target;
        const moving=visitor.phase!=='waiting';
        const x=visitor.phase==='arriving'?(visitor.fromLeft?-avatarWidth+(targetX+avatarWidth)*ease:w+avatarWidth-(w+avatarWidth-targetX)*ease):visitor.phase==='leaving'?(visitor.fromLeft?targetX+(-avatarWidth-targetX)*ease:targetX+(w+avatarWidth-targetX)*ease):targetX;
        const bob=moving?Math.abs(Math.sin(t*11+visitor.id))*h*.012:Math.sin(t*2+visitor.id)*h*.004,baseY=h*.99-bob,headSize=avatarWidth*.36,centerX=x+avatarWidth*.5,headY=baseY-avatarHeight*.82;
        ctx.fillStyle='rgba(38,54,45,.18)';ctx.beginPath();ctx.ellipse(centerX,baseY,avatarWidth*.48,h*.018,0,0,Math.PI*2);ctx.fill();
        rect(x+avatarWidth*.28,baseY-avatarHeight*.3,avatarWidth*.16,avatarHeight*.28,'#68786c');rect(x+avatarWidth*.58,baseY-avatarHeight*.3+Math.sin(t*12+visitor.id)*avatarWidth*.05,avatarWidth*.16,avatarHeight*.28,'#68786c');
        round(x+avatarWidth*.18,baseY-avatarHeight*.58,avatarWidth*.64,avatarHeight*.34,avatarWidth*.12,visitor.shirt);
        const accepting=visitor.phase==='leaving'&&serveAnimationStarted&&serveProgress<1,swing=moving?Math.sin(t*11+visitor.id)*.045:Math.sin(t*2+visitor.id)*.018,shoulderY=baseY-avatarHeight*.5,elbowY=baseY-avatarHeight*(accepting?.42:.32),leftShoulder=centerX-avatarWidth*.27,rightShoulder=centerX+avatarWidth*.27,leftHandX=accepting?centerX-avatarWidth*.04:centerX-avatarWidth*(.43+swing),rightHandX=accepting?centerX+avatarWidth*.04:centerX+avatarWidth*(.43-swing),handY=accepting?baseY-avatarHeight*.47:baseY-avatarHeight*(.17+Math.abs(swing));
        ctx.save();ctx.lineCap='round';line(leftShoulder,shoulderY,leftHandX-avatarWidth*.06,elbowY,visitor.shirt,avatarWidth*.085);line(leftHandX-avatarWidth*.06,elbowY,leftHandX,handY,visitor.skin,avatarWidth*.06);line(rightShoulder,shoulderY,rightHandX+avatarWidth*.06,elbowY,visitor.shirt,avatarWidth*.085);line(rightHandX+avatarWidth*.06,elbowY,rightHandX,handY,visitor.skin,avatarWidth*.06);ctx.restore();
        ctx.fillStyle=visitor.skin;ctx.beginPath();ctx.arc(leftHandX,handY,avatarWidth*.045,0,Math.PI*2);ctx.arc(rightHandX,handY,avatarWidth*.045,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=visitor.skin;ctx.beginPath();ctx.arc(centerX,headY,headSize,0,Math.PI*2);ctx.fill();
        round(centerX-headSize*1.05,headY-headSize*.92,headSize*2.1,headSize*.72,headSize*.35,visitor.hair);
        if(visitor.cap){round(centerX-headSize*1.1,headY-headSize*1.18,headSize*2.2,headSize*.42,headSize*.2,'#526d5d');round(centerX-headSize*.95,headY-headSize*.84,headSize*1.9,headSize*.16,headSize*.08,'#526d5d')}
        ctx.fillStyle='#34463b';ctx.beginPath();ctx.arc(centerX-headSize*.35,headY+headSize*.08,headSize*.07,0,Math.PI*2);ctx.arc(centerX+headSize*.3,headY+headSize*.08,headSize*.07,0,Math.PI*2);ctx.fill();
        const factionAccent={hackers:'#63b89a',samurai:'#d98270',corporate:'#7194bd',cyborgs:'#a481bc'}[visitor.factionId]||'#f0ca7c';
        round(centerX-avatarWidth*.08,baseY-avatarHeight*.56,avatarWidth*.16,avatarHeight*.19,avatarWidth*.04,factionAccent);
        if(visitor.bag){line(centerX-avatarWidth*.24,baseY-avatarHeight*.55,centerX+avatarWidth*.22,baseY-avatarHeight*.25,'#72564b',Math.max(2,w*.003));round(centerX+avatarWidth*.12,baseY-avatarHeight*.36,avatarWidth*.2,avatarHeight*.16,avatarWidth*.05,'#bd8c69')}
        if(visitor.phase==='waiting'){
          round(centerX-avatarWidth*.28,headY-headSize*1.7,avatarWidth*.56,avatarHeight*.12,avatarHeight*.05,'#fffaf0');
          ctx.fillStyle='#79a38c';ctx.beginPath();ctx.arc(centerX-avatarWidth*.12,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.arc(centerX,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.arc(centerX+avatarWidth*.12,headY-headSize*1.64,avatarWidth*.025,0,Math.PI*2);ctx.fill();
        }
      }
    };paint($('cafeScene'));if(!sessionStarted)paint($('introScene'))}
  if(!visitorActors.length&&!state.shiftClosed)createVisitor();
  drawCafeScene();setInterval(()=>{if(document.visibilityState==='visible')drawCafeScene()},60);$('waveBars').innerHTML='<i></i>'.repeat(28);checkBadges();
  if(awaySeconds>0&&offlineGain===0&&awaySeconds>=OFFLINE_CAP)toast('Bạn đã vắng mặt hơn 8 giờ. Thu nhập offline đã chạm giới hạn.');
  $('tutorialScreen').hidden=true;$('tutorialDock').hidden=true;$('gameShell').inert=true;$('gameShell').setAttribute('aria-hidden','true');
  $('introScreen').style.pointerEvents='auto';
  $('introEnter').style.pointerEvents='auto';
  $('introEnter').disabled=false;
  if(!sessionStarted){$('tutorialScreen').hidden=true;$('tutorialDock').hidden=true;}
  addCreatorProjectCard();advanceXpProgression();ensureBrewFeedbackUI();render();save();applyUiSettings();if(state.shiftClosed)closeShift();
  $('replayTutorial').addEventListener('click',replayTutorial);
  $('tutorialContinue').addEventListener('click',doTutorialAction);$('tutorialSkip').addEventListener('click',skipTutorial);
  $('tutorialScreen').addEventListener('click',event=>{if(event.target===$('tutorialScreen'))enableOutsideTutorial()});$('tutorialDockExpand').addEventListener('click',()=>{if(tutorialActive)doTutorialAction();else replayTutorial()});$('tutorialDockSkip').addEventListener('click',skipTutorial);
  $('introEnter').addEventListener('click',()=>{document.body.classList.remove('intro-open');$('introScreen').hidden=true;$('tutorialScreen').hidden=true;$('gameShell').inert=false;$('gameShell').removeAttribute('aria-hidden');startGameSession();if(!state.tutorialDone){window.setTimeout(()=>{if(!state.tutorialDone)startTutorial();},220)}});
  let creatorTrigger=$('creatorCreditOpen');const openCreatorDialog=event=>{creatorTrigger=event.currentTarget;$('creatorDialog').hidden=false;$('creatorClose').focus()};$('creatorCreditOpen').addEventListener('click',openCreatorDialog);$('creatorClose').addEventListener('click',()=>{$('creatorDialog').hidden=true;creatorTrigger.focus()});$('creatorDialog').addEventListener('click',event=>{if(event.target===$('creatorDialog'))$('creatorClose').click()});$('creatorDialog').addEventListener('keydown',event=>{if(event.key==='Escape')$('creatorClose').click()});
})();