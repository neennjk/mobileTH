/**
 * Live App - แอปไลฟ์สด
 * 基于รูปแบบของ task-app.js ให้ฟังก์ชันไลฟ์สดสำหรับ mobile-phone.js
 * ฟังบริบท SillyTavern วิเคราะห์ข้อมูลไลฟ์สด แสดง弹幕และ互动แบบเรียลไทม์
 */

// @ts-nocheck
// หลีกเลี่ยงการกำหนดซ้ำ
if (typeof window.LiveApp === 'undefined') {
  /**
   * ตัวฟังเหตุการณ์ไลฟ์สด
   * รับผิดชอบฟังเหตุการณ์ข้อความของ SillyTavern และกระตุ้นการวิเคราะห์ข้อมูล
   */
  class LiveEventListener {
    constructor(liveApp) {
      this.liveApp = liveApp;
      this.isListening = false;
      this.lastMessageCount = 0;
      this.pollingInterval = null;
      this.messageReceivedHandler = this.onMessageReceived.bind(this);
    }

    /**
     * เริ่มฟังเหตุการณ์ของ SillyTavern
     */
    startListening() {
      if (this.isListening) {
        console.log('[Live App] ตัวฟังกำลังทำงานอยู่แล้ว');
        return;
      }

      try {
        // ตรวจสอบความพร้อมของอินเทอร์เฟซ SillyTavern
        console.log('[Live App] ตรวจสอบความพร้อมของอินเทอร์เฟซ SillyTavern:', {
          'window.SillyTavern': !!window?.SillyTavern,
          'window.SillyTavern.getContext': typeof window?.SillyTavern?.getContext,
          eventOn: typeof eventOn,
          tavern_events: typeof tavern_events,
          mobileContextEditor: !!window?.mobileContextEditor,
        });

        // วิธีที่ 1: 優先ใช้ SillyTavern.getContext().eventSource (แนะนำสำหรับสภาพแวดล้อม iframe)
        if (
          typeof window !== 'undefined' &&
          window.SillyTavern &&
          typeof window.SillyTavern.getContext === 'function'
        ) {
          const context = window.SillyTavern.getContext();
          if (context && context.eventSource && typeof context.eventSource.on === 'function' && context.event_types) {
            console.log('[Live App] ใช้ SillyTavern.getContext().eventSource ฟังเหตุการณ์ MESSAGE_RECEIVED');
            context.eventSource.on(context.event_types.MESSAGE_RECEIVED, this.messageReceivedHandler);
            this.isListening = true;
            console.log('[Live App] ✅ เริ่มฟังเหตุการณ์ข้อความ SillyTavern สำเร็จ (context.eventSource)');
            this.updateMessageCount();
            return;
          }
        }

        // วิธีที่ 2: ลองใช้ฟังก์ชัน eventOn ทั่วไป (หากใช้งานได้)
        if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined' && tavern_events.MESSAGE_RECEIVED) {
          console.log('[Live App] ใช้ eventOn ทั่วไปฟังเหตุการณ์ MESSAGE_RECEIVED');
          eventOn(tavern_events.MESSAGE_RECEIVED, this.messageReceivedHandler);
          this.isListening = true;
          console.log('[Live App] ✅ เริ่มฟังเหตุการณ์ข้อความ SillyTavern สำเร็จ (eventOn)');
          this.updateMessageCount();
          return;
        }

        // วิธีที่ 3: ลองใช้ eventSource จากหน้าต่างหลัก
        if (
          typeof window !== 'undefined' &&
          window.parent &&
          window.parent.eventSource &&
          typeof window.parent.eventSource.on === 'function'
        ) {
          console.log('[Live App] ใช้ eventSource หน้าต่างหลักฟังเหตุการณ์ MESSAGE_RECEIVED');
          if (window.parent.event_types && window.parent.event_types.MESSAGE_RECEIVED) {
            window.parent.eventSource.on(window.parent.event_types.MESSAGE_RECEIVED, this.messageReceivedHandler);
            this.isListening = true;
            console.log('[Live App] ✅ เริ่มฟังเหตุการณ์ข้อความ SillyTavern สำเร็จ (parent eventSource)');
            this.updateMessageCount();
            return;
          }
        }

        // หากทุกวิธีล้มเหลว ใช้การโพลลิงเป็นแผนสำรอง
        console.warn('[Live App] ไม่สามารถตั้งค่าฟังเหตุการณ์ได้ ใช้แผนโพลลิง');
        this.startPolling();
      } catch (error) {
        console.error('[Live App] ตั้งค่าฟังเหตุการณ์ล้มเหลว:', error);
        this.startPolling();
      }
    }

    /**
     * หยุดฟัง
     */
    stopListening() {
      if (!this.isListening) return;

      try {
        // ลองลบตัวฟังเหตุการณ์
        if (
          typeof window !== 'undefined' &&
          window.SillyTavern &&
          typeof window.SillyTavern.getContext === 'function'
        ) {
          const context = window.SillyTavern.getContext();
          if (context && context.eventSource && typeof context.eventSource.off === 'function' && context.event_types) {
            context.eventSource.off(context.event_types.MESSAGE_RECEIVED, this.messageReceivedHandler);
          }
        }

        // ล้างโพลลิง
        if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
        }

        this.isListening = false;
        console.log('[Live App] หยุดฟังเหตุการณ์ SillyTavern แล้ว');
      } catch (error) {
        console.error('[Live App] หยุดฟังล้มเหลว:', error);
      }
    }

    /**
     * เริ่มแผนโพลลิง
     */
    startPolling() {
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }

      this.updateMessageCount();
      this.pollingInterval = setInterval(() => {
        this.checkForNewMessages();
      }, 2000); // ตรวจสอบทุก 2 วินาที

      this.isListening = true;
      console.log('[Live App] ✅ เริ่มแผนฟังโพลลิง');
    }

    /**
     * ตรวจสอบข้อความใหม่
     */
    checkForNewMessages() {
      const currentMessageCount = this.getCurrentMessageCount();
      if (currentMessageCount > this.lastMessageCount) {
        console.log(`[Live App] โพลลิงตรวจพบข้อความใหม่: ${this.lastMessageCount} → ${currentMessageCount}`);
        this.onMessageReceived(currentMessageCount);
      }
    }

    /**
     * จัดการเหตุการณ์รับข้อความ AI
     * @param {number} messageId - ID ข้อความที่รับ
     */
    async onMessageReceived(messageId) {
      try {
        console.log(`[Live App] 🎯 รับเหตุการณ์ข้อความ AI ID: ${messageId}`);

        // ตรวจสอบว่าการไลฟ์สดใช้งานหรือไม่
        if (!this.liveApp || !this.liveApp.isLiveActive) {
          console.log('[Live App] ไลฟ์สดไม่ทำงาน ข้ามการจัดการ');
          return;
        }

        // ตรวจสอบว่ามีข้อความใหม่หรือไม่
        const currentMessageCount = this.getCurrentMessageCount();
        console.log(`[Live App] ตรวจสอบจำนวนข้อความ: ปัจจุบัน=${currentMessageCount}, ก่อนหน้า=${this.lastMessageCount}`);

        if (currentMessageCount <= this.lastMessageCount) {
          console.log('[Live App] ไม่ตรวจพบข้อความใหม่ ข้ามการวิเคราะห์');
          return;
        }

        console.log(`[Live App] ✅ ตรวจพบข้อความใหม่ จำนวนข้อความจาก ${this.lastMessageCount} เพิ่มเป็น ${currentMessageCount}`);
        this.lastMessageCount = currentMessageCount;

        // กระตุ้นการวิเคราะห์ข้อมูล
        console.log('[Live App] เริ่มวิเคราะห์ข้อมูลไลฟ์สดใหม่...');
        await this.liveApp.parseNewLiveData();
      } catch (error) {
        console.error('[Live App] จัดการเหตุการณ์รับข้อความล้มเหลว:', error);
      }
    }

    /**
     * ดึงจำนวนข้อความปัจจุบัน
     */
    getCurrentMessageCount() {
      try {
        // วิธีที่ 1: ใช้ SillyTavern.getContext().chat (อินเทอร์เฟซที่ถูกต้อง)
        if (
          typeof window !== 'undefined' &&
          window.SillyTavern &&
          typeof window.SillyTavern.getContext === 'function'
        ) {
          const context = window.SillyTavern.getContext();
          if (context && context.chat && Array.isArray(context.chat)) {
            const count = context.chat.length;
            console.log(`[Live App] ดึง ${count} ข้อความผ่าน SillyTavern.getContext().chat`);
            return count;
          }
        }

        // วิธีที่ 2: ใช้ mobileContextEditor เป็นสำรอง
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor && typeof mobileContextEditor.getCurrentChatData === 'function') {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && Array.isArray(chatData.messages)) {
            console.log(`[Live App] ดึง ${chatData.messages.length} ข้อความผ่าน mobileContextEditor`);
            return chatData.messages.length;
          }
        }

        // วิธีที่ 3: ลองดึงจากหน้าต่างหลัก chat ตัวแปร
        if (typeof window !== 'undefined' && window.parent && window.parent.chat && Array.isArray(window.parent.chat)) {
          const count = window.parent.chat.length;
          console.log(`[Live App] ดึง ${count} ข้อความผ่านตัวแปร chat หน้าต่างหลัก`);
          return count;
        }

        // วิธีที่ 4: ใช้ getContext() (หากใช้งานได้)
        if (typeof window !== 'undefined' && window.getContext && typeof window.getContext === 'function') {
          const context = window.getContext();
          if (context && context.chat && Array.isArray(context.chat)) {
            const count = context.chat.length;
            console.log(`[Live App] ดึง ${count} ข้อความผ่าน getContext()`);
            return count;
          }
        }

        console.warn('[Live App] ไม่สามารถดึงจำนวนข้อความได้ ใช้ค่าเริ่มต้น 0');
        return 0;
      } catch (error) {
        console.warn('[Live App] ดึงจำนวนข้อความล้มเหลว:', error);
        return 0;
      }
    }

    /**
     * อัปเดตจำนวนข้อความ
     */
    updateMessageCount() {
      this.lastMessageCount = this.getCurrentMessageCount();
      console.log(`[Live App] 初始化จำนวนข้อความ: ${this.lastMessageCount}`);
    }
  }

  /**
   * ตัววิเคราะห์ข้อมูลไลฟ์สด
   * รับผิดชอบวิเคราะห์ข้อมูลรูปแบบไลฟ์สดจากข้อความ SillyTavern
   */
  class LiveDataParser {
    constructor() {
      // รูปแบบ regex
      this.patterns = {
        viewerCount: /\[ไลฟ์สด\|จำนวนผู้ชม\|([^\]]+)\]/g,
        liveContent: /\[ไลฟ์สด\|เนื้อหาไลฟ์สด\|([^\]]+)\]/g,
        normalDanmaku: /\[ไลฟ์สด\|([^\|]+)\|弹幕\|([^\]]+)\]/g,
        giftDanmaku: /\[ไลฟ์สด\|([^\|]+)\|打赏\|([^\]]+)\]/g,
        recommendedInteraction: /\[ไลฟ์สด\|แนะนำ互动\|([^\]]+)\]/g,
      };
    }

    /**
     * วิเคราะห์ข้อมูลไลฟ์สด
     * @param {string} content - เนื้อหาข้อความที่ต้องวิเคราะห์
     * @returns {Object} ข้อมูลไลฟ์สดที่วิเคราะห์แล้ว
     */
    parseLiveData(content) {
      const liveData = {
        viewerCount: 0,
        liveContent: '',
        danmakuList: [],
        giftList: [],
        recommendedInteractions: [],
      };

      if (!content || typeof content !== 'string') {
        return liveData;
      }

      // 1. วิเคราะห์จำนวนผู้ชมไลฟ์สด
      liveData.viewerCount = this.parseViewerCount(content);

      // 2. วิเคราะห์เนื้อหาไลฟ์สด
      liveData.liveContent = this.parseLiveContent(content);

      // 3. วิเคราะห์弹幕ทั้งหมด (รักษาลำดับเดิม)
      const { danmakuList, giftList } = this.parseAllDanmaku(content);
      liveData.danmakuList = danmakuList;
      liveData.giftList = giftList;

      // 5. วิเคราะห์แนะนำ互动
      liveData.recommendedInteractions = this.parseRecomm...(truncated 55600 characters)...st danmakuList = document.getElementById('danmaku-list');
        if (danmakuList) {
          const nodes = Array.from(danmakuList.querySelectorAll('.danmaku-item.need-appear'));
          // ในการเรนเดอร์เริ่มต้น ซ่อนโหนดที่ต้อง动画เหล่านี้ก่อน (ใช้ display:none เพื่อหลีกเลี่ยงช่องว่าง)
          nodes.forEach(el => {
            el.style.display = 'none';
          });
          this.sequentialReveal(nodes);
        }

        const giftList = document.querySelector('.gift-list');
        if (giftList) {
          const giftNodes = Array.from(giftList.querySelectorAll('li.need-appear'));
          giftNodes.forEach(el => {
            el.style.display = 'none';
          });
          this.sequentialReveal(giftNodes);
        }

        // ล้างชุดรอ动画 เพื่อหลีกเลี่ยงการ动画ซ้ำ
        this.pendingAppearDanmakuSigs.clear();
        this.pendingAppearGiftSigs.clear();
      } catch (e) {
        console.warn('[Live App] การ动画ปรากฏทีละรายการล้มเหลว:', e);
      }
    }

    /** เพิ่ม appear-init → appear-show ทีละรายการ (พร้อมช่องว่าง) */
    sequentialReveal(nodes) {
      if (!nodes || nodes.length === 0) return;

      // สถานะเริ่มต้น (ซ่อนก่อน เพื่อหลีกเลี่ยง "กระโดด") จากนั้นมอบให้ CSS เปลี่ยนผ่าน
      nodes.forEach(el => {
        el.classList.remove('need-appear', 'appear-show');
        el.classList.add('appear-init');
        // ใช้ display:none เพื่อหลีกเลี่ยงการยึดพื้นที่
        el.style.display = 'none';
      });

      // แสดงทีละรายการ: ทุกชิ้นประมาณ 700ms (ช้ากว่า) การเปลี่ยนผ่านชิ้นเดียว ~300ms (ดู CSS)
      const baseDelay = 150;
      const stepDelay = 700; // ≈ 0.7 วินาที/ชิ้น
      nodes.forEach((el, idx) => {
        setTimeout(() => {
          // แสดงและกระตุ้นการเปลี่ยนผ่าน
          el.style.display = '';
          // บังคับกระตุ้น reflow ครั้งหนึ่ง เพื่อให้แน่ใจว่าการเปลี่ยนผ่านทำงาน
          // eslint-disable-next-line no-unused-expressions
          el.offsetHeight;
          el.classList.add('appear-show');
          // หลังจากปรากฏทุกชิ้น หากคอนเทนเนอร์มีอยู่ ก็เลื่อนไปที่ด้านล่างที่มองเห็น (ทันที ไม่มี动画)
          const container = document.getElementById('danmaku-container');
          if (container && el?.scrollIntoView) {
            el.scrollIntoView({ block: 'end', inline: 'nearest' });
          }
        }, baseDelay + idx * stepDelay);
      });
    }
  }

  // สร้างอินสแตนซ์ทั่วไป
  window.LiveApp = LiveApp;
  window.liveApp = new LiveApp();
} // สิ้นสุดการตรวจสอบนิยามคลาส

// ฟังก์ชันทั่วไปสำหรับเรียกใช้
window.getLiveAppContent = function () {
  console.log('[Live App] ดึงเนื้อหาแอปไลฟ์สด');

  if (!window.liveApp) {
    console.error('[Live App] อินสแตนซ์ liveApp ไม่มี');
    return '<div class="error-message">โหลดแอปไลฟ์สดล้มเหลว</div>';
  }

  try {
    // ทุกครั้งที่ดึงเนื้อหา ตรวจสอบสถานะไลฟ์สดที่ใช้งานอีกครั้ง
    window.liveApp.detectActiveLive();
    return window.liveApp.getAppContent();
  } catch (error) {
    console.error('[Live App] ดึงเนื้อหาแอปล้มเหลว:', error);
    return '<div class="error-message">โหลดเนื้อหาแอปไลฟ์สดล้มเหลว</div>';
  }
};

window.bindLiveAppEvents = function () {
  console.log('[Live App] ผูกเหตุการณ์แอปไลฟ์สด');

  if (!window.liveApp) {
    console.error('[Live App] อินสแตนซ์ liveApp ไม่มี');
    return;
  }

  try {
    // ล่าช้าผูก เพื่อให้แน่ใจว่า DOM โหลดสมบูรณ์
    setTimeout(() => {
      window.liveApp.bindEvents();
      window.liveApp.updateHeader();
    }, 100);
  } catch (error) {
    console.error('[Live App] ผูกเหตุการณ์ล้มเหลว:', error);
  }
};

// ฟังก์ชันทั่วไปอื่นๆ
window.liveAppStartLive = function (interaction) {
  if (window.liveApp) {
    window.liveApp.startLive(interaction);
  }
};

window.liveAppEndLive = function () {
  if (window.liveApp) {
    window.liveApp.endLive();
  }
};

window.liveAppShowModal = function (modalId) {
  if (window.liveApp) {
    window.liveApp.showModal(modalId);
  }
};

window.liveAppHideModal = function (modalId) {
  if (window.liveApp) {
    window.liveApp.hideModal(modalId);
  }
};

window.liveAppDestroy = function () {
  if (window.liveApp) {
    window.liveApp.destroy();
    console.log('[Live App] แอปถูกทำลายแล้ว');
  }
};

window.liveAppDetectActive = function () {
  if (window.liveApp) {
    console.log('[Live App] 🔍 ตรวจสอบสถานะไลฟ์สดที่ใช้งานด้วยตนเอง...');
    window.liveApp.detectActiveLive();

    // อัปเดตอินเทอร์เฟซ
    if (typeof window.bindLiveAppEvents === 'function') {
      window.bindLiveAppEvents();
    }

    console.log('[Live App] ✅ ตรวจสอบเสร็จ สถานะปัจจุบัน:', {
      view: window.liveApp.currentView,
      isLiveActive: window.liveApp.isLiveActive,
    });
  } else {
    console.error('[Live App] อินสแตนซ์ liveApp ไม่มี');
  }
};

window.liveAppForceReload = function () {
  console.log('[Live App] 🔄 โหลดแอปใหม่แบบบังคับ...');

  // ทำลายอินสแตนซ์เก่าก่อน
  if (window.liveApp) {
    window.liveApp.destroy();
  }

  // สร้างอินสแตนซ์ใหม่
  window.liveApp = new LiveApp();
  console.log('[Live App] ✅ โหลดแอปใหม่แล้ว');
};

// ทดสอบฟังก์ชันแปลง
window.liveAppTestConversion = function () {
  console.log('[Live App] 🧪 ทดสอบฟังก์ชันแปลง...');

  if (!window.liveApp) {
    console.error('[Live App] อินสแตนซ์ liveApp ไม่มี');
    return;
  }

  const testContent = `นี่คือข้อความทดสอบ
[ไลฟ์สด|小明|弹幕|สวัสดีเจ้าของสตรีม! วันนี้กินอะไร呀?]
[ไลฟ์สด|小红|礼物|จรวดประกาย*2]
[ไลฟ์สด|แนะนำ互动|ตอบคำถาม弹幕ของ小明]
[ไลฟ์สด|แนะนำ互动|ขอบคุณ礼物ของ小红]
[ไลฟ์สด|จำนวนผู้ชม|55535]
[ไลฟ์สด|เนื้อหาไลฟ์สด|คุณยิ้มปรับหูฟัง เตรียมเริ่มไลฟ์雑談วันนี้。]
สิ้นสุดการทดสอบ`;

  console.log('เนื้อหาเดิม:', testContent);
  const converted = window.liveApp.convertLiveFormats(testContent);
  console.log('เนื้อหาหลังแปลง:', converted);

  return converted;
};

// ทดสอบความสูงレイเอาต์
window.liveAppTestLayout = function () {
  console.log('[Live App] 📐 ทดสอบความสูงレイเอาต์...');

  const appContent = document.getElementById('app-content');
  if (!appContent) {
    console.error('[Live App] องค์ประกอบ app-content ไม่มี');
    return;
  }

  const liveContainer = appContent.querySelector('.live-container');
  if (!liveContainer) {
    console.error('[Live App] องค์ประกอบ live-container ไม่มี');
    return;
  }

  const videoBox = liveContainer.querySelector('.video-placeholder');
  const interactionPanel = liveContainer.querySelector('.interaction-panel');
  const danmakuContainer = liveContainer.querySelector('.danmaku-container');

  const measurements = {
    appContent: {
      height: appContent.offsetHeight,
      scrollHeight: appContent.scrollHeight,
      clientHeight: appContent.clientHeight,
    },
    liveContainer: {
      height: liveContainer.offsetHeight,
      scrollHeight: liveContainer.scrollHeight,
      clientHeight: liveContainer.clientHeight,
    },
    videoBox: videoBox
      ? {
          height: videoBox.offsetHeight,
          scrollHeight: videoBox.scrollHeight,
          clientHeight: videoBox.clientHeight,
        }
      : null,
    interactionPanel: interactionPanel
      ? {
          height: interactionPanel.offsetHeight,
          scrollHeight: interactionPanel.scrollHeight,
          clientHeight: interactionPanel.clientHeight,
        }
      : null,
    danmakuContainer: danmakuContainer
      ? {
          height: danmakuContainer.offsetHeight,
          scrollHeight: danmakuContainer.scrollHeight,
          clientHeight: danmakuContainer.clientHeight,
        }
      : null,
  };

  console.log('[Live App] 📐 ผลวัดレイเอาต์:', measurements);

  // ตรวจสอบว่ามีการล้นหรือไม่
  const hasOverflow = measurements.liveContainer.scrollHeight > measurements.liveContainer.clientHeight;
  const danmakuCanScroll =
    measurements.danmakuContainer &&
    measurements.danmakuContainer.scrollHeight > measurements.danmakuContainer.clientHeight;

  console.log('[Live App] 📐 ตรวจสอบレイเอาต์:');
  console.log(`- คอนเทนเนอร์ล้นหรือไม่: ${hasOverflow ? '❌ ใช่' : '✅ ไม่'}`);
  console.log(`- 弹幕เลื่อนได้หรือไม่: ${danmakuCanScroll ? '✅ ใช่' : '❌ ไม่'}`);

  return measurements;
};

// ฟังก์ชันทดสอบ
window.liveAppTest = function () {
  console.log('[Live App] 🧪 เริ่มทดสอบแอปไลฟ์สด...');

  const tests = [
    {
      name: 'ตรวจสอบว่าคลาส LiveApp มีอยู่หรือไม่',
      test: () => typeof window.LiveApp === 'function',
    },
    {
      name: 'ตรวจสอบว่าอินสแตนซ์ liveApp มีอยู่หรือไม่',
      test: () => window.liveApp instanceof window.LiveApp,
    },
    {
      name: 'ตรวจสอบว่าฟังก์ชันทั่วไปมีอยู่หรือไม่',
      test: () => typeof window.getLiveAppContent === 'function' && typeof window.bindLiveAppEvents === 'function',
    },
    {
      name: 'ตรวจสอบตัววิเคราะห์ข้อมูล',
      test: () => {
        const parser = new window.LiveApp().dataParser;
        const testData = parser.parseLiveData('[ไลฟ์สด|จำนวนผู้ชม|1234][ไลฟ์สด|เนื้อหาไลฟ์สด|เนื้อหาทดสอบ][ไลฟ์สด|ผู้ใช้1|弹幕|弹幕ทดสอบ]');
        return (
          testData.viewerCount === '1.2K' && testData.liveContent === 'เนื้อหาทดสอบ' && testData.danmakuList.length === 1
        );
      },
    },
    {
      name: 'ตรวจสอบการสร้างเนื้อหาแอป',
      test: () => {
        const content = window.getLiveAppContent();
        return typeof content === 'string' && content.includes('live-app');
      },
    },
    {
      name: 'ตรวจสอบการตรวจสอบไลฟ์สดที่ใช้งาน',
      test: () => {
        const app = new window.LiveApp();
        const testContent1 = '[ไลฟ์สด|จำนวนผู้ชม|1234][ไลฟ์สด|เนื้อหาไลฟ์สด|เนื้อหาทดสอบ]';
        const testContent2 = '[ไลฟ์สดเก่า|จำนวนผู้ชม|1234][ไลฟ์สดเก่า|เนื้อหาไลฟ์สด|เนื้อหาทดสอบ]';
        const testContent3 = 'แชทธรรมดาไม่มีเนื้อหาไลฟ์สด';

        return (
          app.hasActiveLiveFormats(testContent1) === true &&
          app.hasActiveLiveFormats(testContent2) === false &&
          app.hasActiveLiveFormats(testContent3) === false
        );
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    try {
      const result = test.test();
      if (result) {
        console.log(`✅ ${test.name}: ผ่าน`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: ล้มเหลว`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ข้อผิดพลาด - ${error.message}`);
      failed++;
    }
  });

  console.log(`[Live App] 🧪 ทดสอบเสร็จ: ${passed} ผ่าน, ${failed} ล้มเหลว`);

  if (failed === 0) {
    console.log('[Live App] 🎉 ทดสอบทั้งหมดผ่าน! แอปไลฟ์สดพร้อมใช้งาน');
  } else {
    console.log('[Live App] ⚠️ ทดสอบบางส่วนล้มเหลว กรุณาตรวจสอบฟังก์ชันที่เกี่ยวข้อง');
  }

  return { passed, failed, total: tests.length };
};

console.log('[Live App] โหลดโมดูลแอปไลฟ์สดเสร็จ');
console.log('[Live App] 💡 ฟังก์ชันที่ใช้งานได้:');
console.log('[Live App] - liveAppTest() ทดสอบฟังก์ชันแอป');
console.log('[Live App] - liveAppTestConversion() ทดสอบฟังก์ชันแปลงรูปแบบ');
console.log('[Live App] - liveAppTestLayout() ทดสอบความสูงレイเอาต์');
console.log('[Live App] - liveAppDetectActive() ตรวจสอบสถานะไลฟ์สดที่ใช้งานด้วยตนเอง');
console.log('[Live App] - liveAppForceReload() โหลดแอปใหม่แบบบังคับ');