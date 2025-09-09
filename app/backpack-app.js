/**
 * Backpack App - แอปกระเป๋าเป้
 * ให้ฟังก์ชันกระเป๋าเป้สำหรับ mobile-phone.js
 * 基于ลอจิกของ shop-app จัดการเฉพาะไอเท็มกระเป๋าเป้
 */

// @ts-nocheck
// หลีกเลี่ยงการกำหนดซ้ำ
if (typeof window.BackpackApp === 'undefined') {
  class BackpackApp {
    constructor() {
      this.items = [];
      this.contextMonitor = null;
      this.lastItemCount = 0;
      this.isAutoRenderEnabled = true;
      this.lastRenderTime = 0;
      this.renderCooldown = 1000;
      this.eventListenersSetup = false;
      this.contextCheckInterval = null;

      // คุณสมบัติที่เกี่ยวข้องกับการจำแนกและค้นหา
      this.currentItemType = 'all'; // ประเภทไอเท็มที่เลือกปัจจุบัน
      this.showCategories = false; // แสดงแถบแท็กจำแนกหรือไม่
      this.showSearchBar = false; // แสดงแถบค้นหาหรือไม่
      this.searchQuery = ''; // คำค้นหา
      this.searchDebounceTimer = null; // ตัวจับเวลาป้องกันการเด้งของการค้นหา

      this.init();
    }

    init() {
      console.log('[Backpack App] เริ่ม初始化แอปกระเป๋าเป้ - เวอร์ชัน 1.0 (จัดการไอเท็มกระเป๋าเป้)');

      // วิเคราะห์ข้อมูลกระเป๋าเป้ทันที
      this.parseItemsFromContext();

      // 初始化การตรวจสอบแบบอะซิงโครนัส เพื่อหลีกเลี่ยงการบล็อกการเรนเดอร์อินเทอร์เฟซ
      setTimeout(() => {
        this.setupContextMonitor();
      }, 100);

      console.log('[Backpack App] 初始化แอปกระเป๋าเป้เสร็จ - เวอร์ชัน 1.0');
    }

    // ตั้งค่าการตรวจสอบบริบท
    setupContextMonitor() {
      console.log('[Backpack App] ตั้งค่าการตรวจสอบบริบท...');

      // ฟังก์ชันฟังเหตุการณ์การเปลี่ยนแปลงบริบท
      if (window.addEventListener) {
        window.addEventListener('contextUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การอัปเดตข้อความ
        window.addEventListener('messageUpdate', event => {
          this.handleContextChange(event);
        });

        // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
        window.addEventListener('chatChanged', event => {
          this.handleContextChange(event);
        });
      }

      // ลดความถี่การตรวจสอบ定时 จาก 2 วินาทีเป็น 10 วินาที
      this.contextCheckInterval = setInterval(() => {
        this.checkContextChanges();
      }, 10000);

      // ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern
      this.setupSillyTavernEventListeners();
    }

    // จัดการการเปลี่ยนแปลงบริบท
    handleContextChange(event) {
      console.log('[Backpack App] การเปลี่ยนแปลงบริบท:', event);
      this.parseItemsFromContext();
    }

    // ตรวจสอบการเปลี่ยนแปลงบริบท
    checkContextChanges() {
      if (!this.isAutoRenderEnabled) return;

      const currentTime = Date.now();
      if (currentTime - this.lastRenderTime < this.renderCooldown) {
        return;
      }

      this.parseItemsFromContext();
      this.lastRenderTime = currentTime;
    }

    // ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern
    setupSillyTavernEventListeners() {
      // ป้องกันการตั้งค่าซ้ำ
      if (this.eventListenersSetup) {
        return;
      }

      try {
        // ฟังระบบเหตุการณ์ของ SillyTavern
        const eventSource = window['eventSource'];
        const event_types = window['event_types'];

        if (eventSource && event_types) {
          this.eventListenersSetup = true;

          // สร้างฟังก์ชันเด้ง เพื่อหลีกเลี่ยงการวิเคราะห์บ่อยเกินไป
          const debouncedParse = this.debounce(() => {
            this.parseItemsFromContext();
          }, 1000);

          // ฟังเหตุการณ์ส่งข้อความ
          if (event_types.MESSAGE_SENT) {
            eventSource.on(event_types.MESSAGE_SENT, debouncedParse);
          }

          // ฟังเหตุการณ์รับข้อความ
          if (event_types.MESSAGE_RECEIVED) {
            eventSource.on(event_types.MESSAGE_RECEIVED, debouncedParse);
          }

          // ฟังเหตุการณ์การเปลี่ยนแปลงแชท
          if (event_types.CHAT_CHANGED) {
            eventSource.on(event_types.CHAT_CHANGED, debouncedParse);
          }
        } else {
          // ลดความถี่การลองใหม่ จาก 2 วินาทีเป็น 5 วินาที
          setTimeout(() => {
            this.setupSillyTavernEventListeners();
          }, 5000);
        }
      } catch (error) {
        console.warn('[Backpack App] ตั้งค่าฟังก์ชันฟังเหตุการณ์ของ SillyTavern ล้มเหลว:', error);
      }
    }

    // ฟังก์ชันเด้ง
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    // วิเคราะห์ข้อมูลไอเท็มกระเป๋าเป้จากบริบท
    parseItemsFromContext() {
      try {
        // ดึงข้อมูลกระเป๋าเป้ปัจจุบัน
        const backpackData = this.getCurrentBackpackData();

        // อัปเดตรายการไอเท็ม
        if (backpackData.items.length !== this.items.length || this.hasItemsChanged(backpackData.items)) {
          this.items = backpackData.items;
          this.updateItemList();
        }
      } catch (error) {
        console.error('[Backpack App] วิเคราะห์ข้อมูลไอเท็มกระเป๋าเป้ล้มเหลว:', error);
      }
    }

    /**
     * ดึงข้อมูลกระเป๋าเป้ปัจจุบันจากข้อความ (อ้างอิง getCurrentShopData ของ shop-app)
     */
    getCurrentBackpackData() {
      try {
        // 優先ใช้ mobileContextEditor เพื่อดึงข้อมูล
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            // ค้นหาทุกข้อความ ไม่จำกัดข้อความแรก
            const allContent = chatData.messages.map(msg => msg.mes || '').join('\n');
            return this.parseBackpackContent(allContent);
          }
        }

        // หากไม่มี mobileContextEditor ลองวิธีอื่น
        const chatData = this.getChatData();
        if (chatData && chatData.length > 0) {
          // รวมเนื้อหาข้อความทั้งหมดเพื่อวิเคราะห์
          const allContent = chatData.map(msg => msg.mes || '').join('\n');
          return this.parseBackpackContent(allContent);
        }
      } catch (error) {
        console.warn('[Backpack App] ดึงข้อมูลกระเป๋าเป้ล้มเหลว:', error);
      }

      return { items: [] };
    }

    /**
     * วิเคราะห์เนื้อหากระเป๋าเป้แบบเรียลไทม์จากข้อความ
     */
    parseBackpackContent(content) {
      const items = [];

      // วิเคราะห์รูปแบบกระเป๋าเป้: [กระเป๋าเป้|ชื่อสินค้า|ประเภทสินค้า|คำอธิบายสินค้า|จำนวน] (‘กระเป๋าเป้’ เป็นตัวบ่งชี้คงที่)
      const itemRegex = /\[กระเป๋าเป้\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\]]+)\]/g;

      let itemMatch;
      while ((itemMatch = itemRegex.exec(content)) !== null) {
        const [fullMatch, name, type, description, quantity] = itemMatch;

        // ตรวจสอบว่ามีไอเท็มเดียวกันอยู่แล้วหรือไม่ (ตัดสินจากชื่อและประเภท)
        const existingItem = items.find(p => p.name.trim() === name.trim() && p.type.trim() === type.trim());

        if (existingItem) {
          // หากมีอยู่แล้ว ให้บวกจำนวน
          existingItem.quantity += parseInt(quantity.trim()) || 1;
        } else {
          const newItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name.trim(),
            type: type.trim(),
            description: description.trim(),
            quantity: parseInt(quantity.trim()) || 1,
            image: this.getItemImage(type.trim()),
            timestamp: new Date().toLocaleString(),
          };
          items.push(newItem);
        }
      }

      console.log('[Backpack App] วิเคราะห์เสร็จ จำนวนไอเท็ม:', items.length);
      return { items };
    }

    // ตรวจสอบว่าไอเท็มมีการเปลี่ยนแปลงหรือไม่ (วิธีเปรียบเทียบที่มีประสิทธิภาพมากขึ้น)
    hasItemsChanged(newItems) {
      if (newItems.length !== this.items.length) {
        return true;
      }

      for (let i = 0; i < newItems.length; i++) {
        const newItem = newItems[i];
        const oldItem = this.items[i];

        if (
          !oldItem ||
          newItem.name !== oldItem.name ||
          newItem.type !== oldItem.type ||
          newItem.description !== oldItem.description ||
          newItem.quantity !== oldItem.quantity
        ) {
          return true;
        }
      }

      return false;
    }

    // ดึงรูปภาพไอเท็ม
    getItemImage(type) {
      const imageMap = {
        อาหาร: '🍎',
        อาหาร: '🍎', // รองรับการเขียน "อาหาร"
        เครื่องดื่ม: '🥤',
        เสื้อผ้า: '👔',
        ดิจิทัล: '📱',
        ของใช้ในบ้าน: '🏠',
        เครื่องสำอาง: '💄',
        กีฬา: '⚽',
        หนังสือ: '📚',
        ของเล่น: '🧸',
        ดนตรี: '🎵',
        เครื่องมือ: '🔧',
        อาวุธ: '⚔️',
        ยา: '💊',
        วัสดุ: '🧱',
        อัญมณี: '💎',
        กุญแจ: '🔑',
        เหรียญทอง: '🪙',
        ค่าเริ่มต้น: '📦',
      };
      return imageMap[type] || imageMap['ค่าเริ่มต้น'];
    }

    // ดึงข้อมูลแชท
    getChatData() {
      try {
        // 優先ใช้ mobileContextEditor เพื่อดึงข้อมูล
        const mobileContextEditor = window['mobileContextEditor'];
        if (mobileContextEditor) {
          const chatData = mobileContextEditor.getCurrentChatData();
          if (chatData && chatData.messages && chatData.messages.length > 0) {
            return chatData.messages;
          }
        }

        // ลองดึงจากตัวแปรทั่วไป
        const chat = window['chat'];
        if (chat && Array.isArray(chat)) {
          return chat;
        }

        // ลองดึงจากตำแหน่งอื่นที่เป็นไปได้
        const SillyTavern = window['SillyTavern'];
        if (SillyTavern && SillyTavern.chat) {
          return SillyTavern.chat;
        }

        return [];
      } catch (error) {
        console.error('[Backpack App] ดึงข้อมูลแชตล้มเหลว:', error);
        return [];
      }
    }

    // ดึงเนื้อหาแอป
    getAppContent() {
      return this.renderItemList();
    }

    // เรนเดอร์รายการไอเท็ม
    renderItemList() {
      console.log('[Backpack App] เรนเดอร์รายการไอเท็ม...');

      if (!this.items.length) {
        return `
                <div class="backpack-empty-state">
                    <div class="empty-icon" style="color: #333;">🎒</div>
                    <div class="empty-title" style="color: #333;">กระเป๋าเป้ว่างเปล่า</div>
                </div>
            `;
      }

      // คำนวณจำนวนไอเท็มทั้งหมด
      const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);

      // ดึงประเภทไอเท็มทั้งหมด
      const allTypes = ['all', ...new Set(this.items.map(item => item.type))];

      // กรองไอเท็ม (ตามการจำแนกและค้นหา)
      const filteredItems = this.getFilteredItems();

      const itemCards = filteredItems
        .map(
          item => `
            <div class="backpack-item" data-item-id="${item.id}">
                <div class="backpack-item-info">
                    <div class="backpack-item-header">
                        <div class="backpack-item-name">${item.name}</div>
                        <div class="backpack-item-type">${item.type}</div>
                    ...(truncated 15516 characters)... {
      // สร้าง regex เพื่อจับคู่ไอเท็มเฉพาะ
      const itemPattern = new RegExp(
        `\\[กระเป๋าเป้\\|${this.escapeRegex(item.name)}\\|([^\\|]+)\\|([^\\|]+)\\|(\\d+)\\]`,
        'g',
      );

      let convertedContent = content;

      // ไม่ว่าจะเหลือหรือไม่ ก็ทำเครื่องหมายไอเท็มในบริบทว่าใช้แล้ว เพื่อหลีกเลี่ยงการจับซ้ำ
      convertedContent = convertedContent.replace(itemPattern, (match, type, description, quantity) => {
        return `[ใช้แล้ว|${item.name}|${type}|${description}|${usedQuantity}]`;
      });

      return convertedContent;
    }

    // หลีกเลี่ยงตัวอักษรพิเศษ regex
    escapeRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // อัปเดตเนื้อหาข้อความ
    async updateMessageContent(messageIndex, newContent) {
      try {
        console.log(`[Backpack App] กำลังอัปเดตข้อความ ${messageIndex}:`, newContent.substring(0, 100) + '...');

        // วิธีที่ 1: อัปเดตโดยตรงโดยใช้ array chat ทั่วไป
        const chat = window['chat'];
        if (chat && Array.isArray(chat) && chat[messageIndex]) {
          const originalContent = chat[messageIndex].mes;
          chat[messageIndex].mes = newContent;

          // หากข้อความมี swipes ก็ต้องอัปเดตด้วย
          if (chat[messageIndex].swipes && chat[messageIndex].swipe_id !== undefined) {
            chat[messageIndex].swipes[chat[messageIndex].swipe_id] = newContent;
          }

          // ทำเครื่องหมายว่าข้อมูลแชทถูกแก้ไข
          if (window.chat_metadata) {
            window.chat_metadata.tainted = true;
          }

          console.log(
            `[Backpack App] อัปเดตข้อความ ${messageIndex} แล้ว ความยาวเดิม:${originalContent.length} ความยาวใหม่:${newContent.length}`,
          );
          return true;
        }

        // วิธีที่ 2: ลองอัปเดตผ่านฟังก์ชันแก้ไข
        if (window.mobileContextEditor && window.mobileContextEditor.modifyMessage) {
          await window.mobileContextEditor.modifyMessage(messageIndex, newContent);
          return true;
        }

        // วิธีที่ 3: ลองอัปเดตผ่าน context-editor
        if (window.contextEditor && window.contextEditor.modifyMessage) {
          await window.contextEditor.modifyMessage(messageIndex, newContent);
          return true;
        }

        console.warn('[Backpack App] ไม่พบวิธีอัปเดตข้อความที่ถูกต้อง');
        return false;
      } catch (error) {
        console.error('[Backpack App] อัปเดตเนื้อหาเวสข้อความล้มเหลว:', error);
        return false;
      }
    }

    // บันทึกข้อมูลแชท
    async saveChatData() {
      try {
        console.log('[Backpack App] เริ่มบันทึกข้อมูลแชท...');

        // วิธีที่ 1: ใช้ฟังก์ชันบันทึกของ SillyTavern
        if (typeof window.saveChatConditional === 'function') {
          await window.saveChatConditional();
          console.log('[Backpack App] บันทึกข้อมูลแชทผ่าน saveChatConditional แล้ว');
          return true;
        }

        // วิธีที่ 2: ใช้บันทึกแบบล่าช้า
        if (typeof window.saveChatDebounced === 'function') {
          window.saveChatDebounced();
          console.log('[Backpack App] บันทึกข้อมูลแชทผ่าน saveChatDebounced แล้ว');
          // รอสักครู่เพื่อให้แน่ใจว่าบันทึกเสร็จ
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true;
        }

        // วิธีที่ 3: ใช้ฟังก์ชันบันทึกของตัวแก้ไข
        if (window.mobileContextEditor && typeof window.mobileContextEditor.saveChatData === 'function') {
          await window.mobileContextEditor.saveChatData();
          console.log('[Backpack App] บันทึกข้อมูลแชทผ่าน mobileContextEditor แล้ว');
          return true;
        }

        // วิธีที่ 4: ใช้ฟังก์ชันบันทึกของ context-editor
        if (window.contextEditor && typeof window.contextEditor.saveChatData === 'function') {
          await window.contextEditor.saveChatData();
          console.log('[Backpack App] บันทึกข้อมูลแชทผ่าน contextEditor แล้ว');
          return true;
        }

        console.warn('[Backpack App] ไม่พบวิธีบันทึกที่ถูกต้อง');
        return false;
      } catch (error) {
        console.error('[Backpack App] บันทึกข้อมูลแชตล้มเหลว:', error);
        return false;
      }
    }

    // วิธีส่งข้อความที่เป็นเอกภาพ (อ้างอิงวิธีส่งของ shop-app)
    async sendToSillyTavern(message) {
      try {
        console.log('[Backpack App] 🔄 ส่งข้อความไปยัง SillyTavern:', message);

        // วิธีที่ 1: ใช้ DOM element โดยตรง (เหมือนกับ message app)
        const originalInput = document.getElementById('send_textarea');
        const sendButton = document.getElementById('send_but');

        if (!originalInput || !sendButton) {
          console.error('[Backpack App] ไม่พบช่องกรอกหรือปุ่มส่ง');
          return this.sendToSillyTavernBackup(message);
        }

        // ตรวจสอบว่าช่องกรอกใช้งานได้หรือไม่
        if (originalInput.disabled) {
          console.warn('[Backpack App] ช่องกรอกถูกปิดใช้งาน');
          return false;
        }

        // ตรวจสอบว่าปุ่มส่งใช้งานได้หรือไม่
        if (sendButton.classList.contains('disabled')) {
          console.warn('[Backpack App] ปุ่มส่งถูกปิดใช้งาน');
          return false;
        }

        // ตั้งค่า
        originalInput.value = message;
        console.log('[Backpack App] ตั้งค่าค่าช่องกรอกแล้ว:', originalInput.value);

        // กระตุ้นเหตุการณ์กรอก
        originalInput.dispatchEvent(new Event('input', { bubbles: true }));
        originalInput.dispatchEvent(new Event('change', { bubbles: true }));

        // ล่าช้าในการคลิกปุ่มส่ง
        await new Promise(resolve => setTimeout(resolve, 300));
        sendButton.click();
        console.log('[Backpack App] คลิกปุ่มส่งแล้ว');

        return true;
      } catch (error) {
        console.error('[Backpack App] เกิดข้อผิดพลาดในการส่งข้อความ:', error);
        return this.sendToSillyTavernBackup(message);
      }
    }

    // วิธีส่งสำรอง
    async sendToSillyTavernBackup(message) {
      try {
        console.log('[Backpack App] ลองวิธีส่งสำรอง:', message);

        // ลองหาช่องกรอกอื่นที่เป็นไปได้
        const textareas = document.querySelectorAll('textarea');

        if (textareas.length > 0) {
          const textarea = textareas[0];
          textarea.value = message;
          textarea.focus();

          // จำลองเหตุการณ์คีย์บอร์ด
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          return true;
        }

        return false;
      } catch (error) {
        console.error('[Backpack App] วิธีส่งสำรองล้มเหลว:', error);
        return false;
      }
    }

    // รีเฟรชรายการไอเท็มด้วยตนเอง
    refreshItemList() {
      console.log('[Backpack App] รีเฟรชรายการไอเท็มด้วยตนเอง');
      this.parseItemsFromContext();
      this.updateAppContent();
    }

    // ทำลายแอป ทำความสะอาดทรัพยากร
    destroy() {
      console.log('[Backpack App] ทำลายแอป ทำความสะอาดทรัพยากร');

      // ทำความสะอาดตัวจับเวลา
      if (this.contextCheckInterval) {
        clearInterval(this.contextCheckInterval);
        this.contextCheckInterval = null;
      }

      // ทำความสะอาดตัวจับเวลาป้องกันการเด้งของการค้นหา
      if (this.searchDebounceTimer) {
        clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = null;
      }

      // รีเซ็ตสถานะ
      this.eventListenersSetup = false;
      this.isAutoRenderEnabled = false;

      // ล้างข้อมูล
      this.items = [];
    }

    // อัปเดต header
    updateHeader() {
      // แจ้ง mobile-phone เพื่ออัปเดต header
      if (window.mobilePhone && window.mobilePhone.updateAppHeader) {
        const state = {
          app: 'backpack',
          title: 'กระเป๋าเป้ของฉัน',
          view: 'itemList',
        };
        window.mobilePhone.updateAppHeader(state);
      }
    }

    // แสดงข้อความแจ้งเตือน
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `backpack-toast ${type}`;
      toast.textContent = message;

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('show');
      }, 100);

      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
    }
  }

  // สร้างอินสแตนซ์ทั่วไป
  window.BackpackApp = BackpackApp;
  window.backpackApp = new BackpackApp();
} // สิ้นสุดการตรวจสอบนิยามคลาส

// ฟังก์ชันทั่วไปสำหรับ mobile-phone.js เรียกใช้
window.getBackpackAppContent = function () {
  console.log('[Backpack App] ดึงเนื้อหาแอปกระเป๋าเป้');

  if (!window.backpackApp) {
    console.error('[Backpack App] อินสแตนซ์ backpackApp ไม่มี');
    return '<div class="error-message">โหลดแอปกระเป๋าเป้ล้มเหลว</div>';
  }

  try {
    return window.backpackApp.getAppContent();
  } catch (error) {
    console.error('[Backpack App] ดึงเนื้อหาแอปล้มเหลว:', error);
    return '<div class="error-message">ดึงเนื้อหาล้มเหลว</div>';
  }
};

window.bindBackpackAppEvents = function () {
  console.log('[Backpack App] ผูกเหตุการณ์แอปกระเป๋าเป้');

  if (!window.backpackApp) {
    console.error('[Backpack App] อินสแตนซ์ backpackApp ไม่มี');
    return;
  }

  try {
    window.backpackApp.bindEvents();
  } catch (error) {
    console.error('[Backpack App] ผูกเหตุการณ์ล้มเหลว:', error);
  }
};

// ฟังก์ชันดีบักและทดสอบ
window.backpackAppRefresh = function () {
  if (window.backpackApp) {
    window.backpackApp.refreshItemList();
  }
};

window.backpackAppToggleCategories = function () {
  if (window.backpackApp) {
    window.backpackApp.toggleCategories();
  }
};

window.backpackAppToggleSearch = function () {
  if (window.backpackApp) {
    window.backpackApp.toggleSearchBar();
  }
};

window.backpackAppDebugInfo = function () {
  if (window.backpackApp) {
    console.log('[Backpack App Debug] จำนวนไอเท็มปัจจุบัน:', window.backpackApp.items.length);
    console.log('[Backpack App Debug] รายการไอเท็ม:', window.backpackApp.items);
    console.log('[Backpack App Debug] ตั้งค่าฟังก์ชันฟังเหตุการณ์:', window.backpackApp.eventListenersSetup);
    console.log('[Backpack App Debug] เปิดใช้งานการเรนเดอร์อัตโนมัติ:', window.backpackApp.isAutoRenderEnabled);
  }
};

// ปรับปรุงประสิทธิภาพ: ทำลายอินสแตนซ์แอป
window.backpackAppDestroy = function () {
  if (window.backpackApp) {
    window.backpackApp.destroy();
    console.log('[Backpack App] แอปถูกทำลายแล้ว');
  }
};

// โหลดแอปใหม่แบบบังคับ (ล้างแคช)
window.backpackAppForceReload = function () {
  console.log('[Backpack App] 🔄 โหลดแอปใหม่แบบบังคับ...');

  // ทำลายอินสแตนซ์ที่มีอยู่
  if (window.backpackApp) {
    window.backpackApp.destroy();
  }

  // สร้างอินสแตนซ์ใหม่
  window.backpackApp = new BackpackApp();
  console.log('[Backpack App] ✅ โหลดแอปใหม่แล้ว - เวอร์ชัน 1.0');
};

// 初始化
console.log('[Backpack App] โหลดโมดูลแอปกระเป๋าเป้เสร็จ - เวอร์ชัน 1.0 (จัดการไอเท็มกระเป๋าเป้)');